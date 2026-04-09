import { config } from '../config';
import { TrainService } from '../types';

const WSDL_URL =
  'https://lite.realtime.nationalrail.co.uk/OpenLDBWS/wsdl.aspx?ver=2021-11-01';

export interface DepartureSummary {
  services: TrainService[];
  messages: string[];
}

let darwinClient: any = null;
let darwinKeyUsed = '';

async function getDarwin(): Promise<any> {
  const key = config.darwinApiKey;
  if (darwinClient && darwinKeyUsed === key) {
    return darwinClient;
  }
  // Use Function() to hide the dynamic import from TypeScript's CommonJS
  // downleveler, which would otherwise rewrite it to require() and fail at
  // runtime because darwin-ldb-node is an ESM-only package.
  const darwinModule: any = await (new Function('return import("darwin-ldb-node")')());
  const { Darwin } = darwinModule;
  darwinClient = await Darwin.make(WSDL_URL, key);
  darwinKeyUsed = key;
  return darwinClient;
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

/**
 * Minutes between now and today's `HH:MM` target (can be negative if target
 * has already passed today).
 */
function minutesUntilToday(targetTime: string): number {
  const now = new Date();
  const [h, m] = targetTime.split(':').map(Number);
  const target = new Date(now);
  target.setHours(h, m, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 60000);
}

export async function getDepartures(
  originCRS: string,
  destinationCRS: string,
  targetTime: string
): Promise<DepartureSummary> {
  try {
    const darwin = await getDarwin();

    // Darwin's station board is a "next departures" feed covering ~120 minutes
    // from now. If the target departure is further out than that, none of the
    // returned services will overlap the ±30 min target window, so short-circuit
    // with an explanatory message instead of showing "No services found".
    // (We intentionally don't pass Darwin's timeOffset/timeWindow parameters —
    // doing so via darwin-ldb-node caused the SOAP call to return no services.)
    const minsUntil = minutesUntilToday(targetTime);
    if (minsUntil - 30 > 120) {
      return {
        services: [],
        messages: ['Services will appear closer to the departure time.'],
      };
    }

    let result: any;
    try {
      result = await darwin.arrivalsAndDepartures({
        crs: originCRS,
        filterCrs: destinationCRS,
        filterType: 'to',
        numRows: 20,
      });
    } catch (darwinErr: any) {
      // darwin-ldb-node crashes when there are no train services
      // (accesses result.trainServices.service when trainServices is undefined)
      if (darwinErr?.message?.includes("Cannot read properties of undefined (reading 'service')")) {
        return { services: [], messages: [] };
      }
      throw darwinErr;
    }

    const services: TrainService[] = [];

    for (const svc of result.trainServices ?? []) {
      const std = svc.std ? String(svc.std) : null;
      if (!std) continue;

      if (!isWithinWindow(std, targetTime, 30)) continue;

      const isCancelled = svc.cancelled === true;
      let status: TrainService['status'];
      let expectedTime: string;

      if (isCancelled) {
        status = 'cancelled';
        expectedTime = std;
      } else if (svc.etd === 'On time') {
        status = 'on-time';
        expectedTime = std;
      } else if (svc.etd) {
        status = 'delayed';
        expectedTime = String(svc.etd);
      } else {
        status = 'on-time';
        expectedTime = std;
      }

      const callingPoints: string[] = [];
      if (svc.callingPoints?.to) {
        for (const key of Object.keys(svc.callingPoints.to)) {
          for (const cp of svc.callingPoints.to[key]) {
            if (cp.locationName) callingPoints.push(cp.locationName);
          }
        }
      }

      services.push({
        scheduledTime: std,
        expectedTime,
        platform: svc.platform ?? null,
        operator: svc.operator ?? 'Unknown',
        callingPoints,
        status,
      });
    }

    services.sort((a, b) => parseTime(a.scheduledTime) - parseTime(b.scheduledTime));
    return { services, messages: [] };
  } catch (error: any) {
    console.error(`Rail getDepartures failed for ${originCRS}→${destinationCRS}:`, error.message);
    throw error;
  }
}

export async function getServiceMessages(crs: string): Promise<string[]> {
  try {
    const darwin = await getDarwin();

    const result = await darwin.arrivalsAndDepartures({
      crs,
      numRows: 1,
    });

    // The darwin-ldb-node package doesn't expose nrccMessages directly,
    // so we return an empty array for now
    return [];
  } catch {
    return [];
  }
}
