import { CommuteProfile, SourceResult, TrainService } from '../types';
import { CommuteDataSource } from './dataSource';
import { getDepartures, getServiceMessages } from './railService';
import { getWeatherForecast } from './weatherService';
import { getLineStatuses } from './tflService';

export interface RailSource {
  services: TrainService[];
  messages: string[];
}

function todayAt(time: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `${today}T${time}:00`;
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms
    );
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

function buildSources(profile: CommuteProfile): CommuteDataSource[] {
  const sources: CommuteDataSource[] = [
    {
      key: 'rail.outbound',
      timeoutMs: 6000,
      async fetch(p): Promise<RailSource> {
        const [dep, msgs] = await Promise.all([
          getDepartures(
            p.outbound.originCRS,
            p.outbound.destinationCRS,
            p.outbound.departureTime
          ),
          getServiceMessages(p.outbound.originCRS),
        ]);
        return {
          services: dep.services,
          messages: [...msgs, ...dep.messages],
        };
      },
    },
    {
      key: 'rail.return',
      timeoutMs: 6000,
      async fetch(p): Promise<RailSource> {
        const dep = await getDepartures(
          p.return.originCRS,
          p.return.destinationCRS,
          p.return.departureTime
        );
        return { services: dep.services, messages: dep.messages };
      },
    },
    {
      key: 'weather.outboundOrigin',
      timeoutMs: 6000,
      fetch: (p) =>
        getWeatherForecast(p.outbound.originCRS, todayAt(p.outbound.departureTime)),
    },
    {
      key: 'weather.destination',
      timeoutMs: 6000,
      fetch: (p) =>
        getWeatherForecast(
          p.outbound.destinationCRS,
          todayAt(p.outbound.departureTime)
        ),
    },
    {
      key: 'weather.returnDestination',
      timeoutMs: 6000,
      fetch: (p) =>
        getWeatherForecast(
          p.return.destinationCRS,
          todayAt(p.return.departureTime)
        ),
    },
  ];

  if (profile.tflLines.length > 0) {
    sources.push({
      key: 'tfl',
      timeoutMs: 6000,
      fetch: (p) => getLineStatuses(p.tflLines),
    });
  }
  return sources;
}

export async function runAll(
  profile: CommuteProfile
): Promise<Record<string, SourceResult>> {
  const sources = buildSources(profile);
  const settled = await Promise.all(
    sources.map(async (s): Promise<[string, SourceResult]> => {
      try {
        const data = await withTimeout(s.fetch(profile), s.timeoutMs, s.key);
        return [s.key, { status: 'ok', data }];
      } catch (err: any) {
        return [
          s.key,
          { status: 'error', error: err?.message ?? 'Unknown error' },
        ];
      }
    })
  );
  return Object.fromEntries(settled);
}
