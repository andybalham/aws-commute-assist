import { Darwin } from 'darwin-ldb-node';
import { config } from '../config';
import { TrainService } from '../types';

const WSDL_URL =
  'https://lite.realtime.nationalrail.co.uk/OpenLDBWS/wsdl.aspx?ver=2021-11-01';

export interface DepartureSummary {
  services: TrainService[];
  messages: string[];
}

let darwinClient: InstanceType<typeof Darwin> | null = null;
let darwinKeyUsed = '';

async function getDarwin(): Promise<InstanceType<typeof Darwin>> {
  const key = config.darwinApiKey;
  if (darwinClient && darwinKeyUsed === key) {
    return darwinClient;
  }
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

export async function getDepartures(
  originCRS: string,
  destinationCRS: string,
  targetTime: string
): Promise<DepartureSummary> {
  try {
    const darwin = await getDarwin();

    const result = await darwin.arrivalsAndDepartures({
      crs: originCRS,
      filterCrs: destinationCRS,
      filterType: 'to',
      numRows: 20,
    });

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
