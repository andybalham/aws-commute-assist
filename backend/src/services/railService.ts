// XML parsing: we use fast-xml-parser rather than regex to traverse the Darwin
// SOAP response. Darwin's XML uses namespace prefixes (e.g. lt:std, lt4:service)
// that can change between API versions, and its structure has variable nesting
// (callingPoints inside services inside trainServices). A proper parser handles
// namespaces, nesting depth, CDATA sections, and self-closing tags correctly
// where regex would be brittle and hard to reason about.
// fast-xml-parser was chosen for its zero-dependency footprint (~40 KB) and
// built-in namespace-stripping support (removeNSPrefix option).

import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { config } from '../config';
import { TrainService } from '../types';

const DARWIN_ENDPOINT =
  'https://lite.realtime.nationalrail.co.uk/OpenLDBWS/ldb12.asmx';

const xmlParser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true,
  isArray: (name) => ['service', 'callingPoint', 'message', 'location'].includes(name),
});

export interface DepartureSummary {
  services: TrainService[];
  messages: string[];
}

function buildSoapEnvelope(action: string, body: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:typ="http://thalesgroup.com/RTTI/2013-11-28/Token/types"
               xmlns:ldb="http://thalesgroup.com/RTTI/2021-11-01/ldb/">
  <soap:Header>
    <typ:AccessToken>
      <typ:TokenValue>${config.darwinApiKey}</typ:TokenValue>
    </typ:AccessToken>
  </soap:Header>
  <soap:Body>
    <ldb:${action}>
      ${body}
    </ldb:${action}>
  </soap:Body>
</soap:Envelope>`;
}

function stripHtml(text: string): string {
  return String(text).replace(/<[^>]+>/g, '').trim();
}

function parseTime(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function isWithinWindow(
  scheduledTime: string,
  targetTime: string,
  windowMinutes: number
): boolean {
  const scheduled = parseTime(scheduledTime);
  const target = parseTime(targetTime);
  return Math.abs(scheduled - target) <= windowMinutes;
}

function parseServiceStatus(
  etd: string | null | undefined
): { expectedTime: string; status: TrainService['status'] } {
  if (!etd || etd === 'On time') {
    return { expectedTime: '', status: 'on-time' };
  }
  if (etd === 'Cancelled') {
    return { expectedTime: '', status: 'cancelled' };
  }
  if (etd === 'Delayed') {
    return { expectedTime: '', status: 'delayed' };
  }
  // etd is an actual time like "07:35"
  return { expectedTime: etd, status: 'delayed' };
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function parseServices(
  parsed: any,
  targetTime: string,
  destinationCRS: string
): TrainService[] {
  const body = parsed?.Envelope?.Body;
  const result =
    body?.GetDepartureBoardResponse?.GetStationBoardResult ??
    body?.GetDepBoardWithDetailsResponse?.GetStationBoardResult;
  if (!result) return [];

  const rawServices = asArray(result?.trainServices?.service);
  const services: TrainService[] = [];

  for (const svc of rawServices) {
    const std = svc.std ? String(svc.std) : null;
    if (!std) continue;

    if (!isWithinWindow(std, targetTime, 30)) continue;

    const etd = svc.etd ? String(svc.etd) : null;
    const { expectedTime, status } = parseServiceStatus(etd);

    const platform = svc.platform ? String(svc.platform) : null;
    const operator = svc.operatorName ?? svc.operator ?? 'Unknown';

    // Extract calling points from all calling-point lists
    const callingPoints: string[] = [];
    const cpLists = asArray(
      svc.subsequentCallingPoints?.callingPointList
    );
    for (const list of cpLists) {
      for (const cp of asArray(list?.callingPoint)) {
        if (cp.locationName) callingPoints.push(String(cp.locationName));
      }
    }

    // Destination filtering — best-effort via the destination block
    if (destinationCRS) {
      const destinations = asArray(svc.destination?.location);
      const destCodes = destinations.map((d: any) => d.crs).filter(Boolean);
      if (destCodes.length > 0 && !destCodes.includes(destinationCRS)) {
        // Check calling points as fallback
        const cpCodes = cpLists.flatMap((list: any) =>
          asArray(list?.callingPoint).map((cp: any) => cp.crs).filter(Boolean)
        );
        if (!cpCodes.includes(destinationCRS)) continue;
      }
    }

    services.push({
      scheduledTime: std,
      expectedTime: expectedTime || std,
      platform,
      operator: String(operator),
      callingPoints,
      status,
    });
  }

  services.sort((a, b) => parseTime(a.scheduledTime) - parseTime(b.scheduledTime));
  return services;
}

export async function getDepartures(
  originCRS: string,
  destinationCRS: string,
  targetTime: string
): Promise<DepartureSummary> {
  const body = `
    <ldb:numRows>20</ldb:numRows>
    <ldb:crs>${originCRS}</ldb:crs>
    <ldb:filterCrs>${destinationCRS}</ldb:filterCrs>
    <ldb:filterType>to</ldb:filterType>
    <ldb:timeOffset>-30</ldb:timeOffset>
    <ldb:timeWindow>60</ldb:timeWindow>`;

  const envelope = buildSoapEnvelope('GetDepartureBoardRequest', body);

  const response = await axios.post(DARWIN_ENDPOINT, envelope, {
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction:
        'http://thalesgroup.com/RTTI/2021-11-01/ldb/GetDepartureBoard',
    },
    timeout: 10000,
  });

  const parsed = xmlParser.parse(response.data);
  const services = parseServices(parsed, targetTime, destinationCRS);

  return { services, messages: [] };
}

export async function getServiceMessages(crs: string): Promise<string[]> {
  const body = `<ldb:crs>${crs}</ldb:crs>`;
  const envelope = buildSoapEnvelope('GetStationBoardRequest', body);

  try {
    const response = await axios.post(DARWIN_ENDPOINT, envelope, {
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction:
          'http://thalesgroup.com/RTTI/2021-11-01/ldb/GetStationBoard',
      },
      timeout: 5000,
    });

    // Messages contain embedded HTML (e.g. <p>…</p>). We parse the raw XML
    // with a second parser that treats message content as text, not elements.
    const msgParser = new XMLParser({
      ignoreAttributes: true,
      removeNSPrefix: true,
      isArray: (name) => ['message'].includes(name),
      stopNodes: ['*.message'],
    });
    const parsed = msgParser.parse(response.data);
    const result =
      parsed?.Envelope?.Body?.GetStationBoardResponse?.GetStationBoardResult;
    const messages = asArray(result?.nrccMessages?.message);
    return messages.map((m) => stripHtml(String(m))).filter((m) => m.length > 0);
  } catch {
    return [];
  }
}
