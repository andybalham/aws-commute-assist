import axios from 'axios';
import { config } from '../config';
import { TflLineSummary } from '../types';
import { TtlCache } from './cache';

const tflCache = new TtlCache<TflLineSummary[]>(60 * 1000);

// TfL line ID → display name mapping
const LINE_NAMES: Record<string, string> = {
  bakerloo: 'Bakerloo',
  central: 'Central',
  circle: 'Circle',
  district: 'District',
  elizabeth: 'Elizabeth',
  'hammersmith-city': 'Hammersmith & City',
  jubilee: 'Jubilee',
  metropolitan: 'Metropolitan',
  northern: 'Northern',
  piccadilly: 'Piccadilly',
  victoria: 'Victoria',
  'waterloo-city': 'Waterloo & City',
  dlr: 'DLR',
  'london-overground': 'London Overground',
  tram: 'Tram',
};

/**
 * Fetches the current line status for one or more TfL lines via the TfL
 * Unified API. Returns an empty array if `lineIds` is empty.
 *
 * @param lineIds TfL line identifiers (e.g. `['central', 'jubilee']`).
 * @returns Array of line summaries — line ID, friendly name, status text and
 *          (optional) reason. Length matches the number of valid IDs returned
 *          by the upstream API.
 * @throws  If the upstream API fails or times out (5 s).
 */
export async function getLineStatuses(
  lineIds: string[]
): Promise<TflLineSummary[]> {
  if (lineIds.length === 0) return [];

  const sortedIds = [...lineIds].sort();
  const cacheKey = sortedIds.join(',');
  const cached = tflCache.get(cacheKey);
  if (cached) return cached;

  const ids = sortedIds.join(',');
  const response = await axios.get(
    `https://api.tfl.gov.uk/Line/${ids}/Status`,
    {
      params: {
        app_id: config.tflAppId && config.tflAppId !== 'PLACEHOLDER' ? config.tflAppId : undefined,
        app_key: config.tflAppKey && config.tflAppKey !== 'PLACEHOLDER' ? config.tflAppKey : undefined,
      },
      timeout: 5000,
    }
  );

  const summaries: TflLineSummary[] = response.data.map((line: any) => {
    const status = line.lineStatuses?.[0];
    return {
      lineId: line.id,
      lineName: LINE_NAMES[line.id] ?? line.name ?? line.id,
      status: status?.statusSeverityDescription ?? 'Unknown',
      reason: status?.reason ?? null,
    };
  });

  tflCache.set(cacheKey, summaries);
  return summaries;
}
