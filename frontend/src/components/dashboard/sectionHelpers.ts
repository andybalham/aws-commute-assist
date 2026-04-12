import type { DashboardResponse, SourceResult } from '../../api/types';

export function parseHHMM(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function minutesUntil(departureTime: string, now: Date): number {
  const nowMins = now.getHours() * 60 + now.getMinutes();
  return parseHHMM(departureTime) - nowMins;
}

export function isDepartureInPast(departureTime: string, now: Date): boolean {
  return minutesUntil(departureTime, now) < 0;
}

export function isOutsideDarwinWindow(departureTime: string, now: Date): boolean {
  const delta = minutesUntil(departureTime, now);
  return delta < 0 || delta > 150;
}

export function weatherIcon(condition: string): string {
  const lower = condition.toLowerCase();
  if (lower.includes('clear') || lower.includes('sunny')) return '☀️';
  if (lower.includes('partly') || lower.includes('mainly clear')) return '⛅';
  if (lower.includes('overcast') || lower.includes('cloudy')) return '☁️';
  if (lower.includes('fog') || lower.includes('mist')) return '🌫️';
  if (lower.includes('drizzle')) return '🌦️';
  if (lower.includes('rain') || lower.includes('shower')) return '🌧️';
  if (lower.includes('snow') || lower.includes('flurr')) return '🌨️';
  if (lower.includes('thunder') || lower.includes('storm')) return '⛈️';
  if (lower.includes('sleet') || lower.includes('freezing')) return '🌨️';
  return '🌤️';
}

export function unwrap<T>(
  sources: DashboardResponse['sources'],
  key: string
): { data?: T; error?: string } {
  const s = sources[key] as SourceResult<T> | undefined;
  if (!s) return {};
  return s.status === 'ok' ? { data: s.data } : { error: s.error };
}
