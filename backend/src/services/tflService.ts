import axios from 'axios';
import { config } from '../config';
import { TflLineSummary } from '../types';

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

export async function getLineStatuses(
  lineIds: string[]
): Promise<TflLineSummary[]> {
  if (lineIds.length === 0) return [];

  const ids = lineIds.join(',');
  const response = await axios.get(
    `https://api.tfl.gov.uk/Line/${ids}/Status`,
    {
      params: {
        app_id: config.tflAppId || undefined,
        app_key: config.tflAppKey || undefined,
      },
      timeout: 5000,
    }
  );

  return response.data.map((line: any) => {
    const status = line.lineStatuses?.[0];
    return {
      lineId: line.id,
      lineName: LINE_NAMES[line.id] ?? line.name ?? line.id,
      status: status?.statusSeverityDescription ?? 'Unknown',
      reason: status?.reason ?? null,
    };
  });
}
