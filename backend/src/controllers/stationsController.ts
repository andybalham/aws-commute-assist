import { RouteContext, RouteResponse } from '../types';
import { searchStations } from '../data/stations';

export function getStations(ctx: RouteContext): RouteResponse {
  const query = ctx.query.q || '';
  if (!query.trim()) {
    return { statusCode: 400, body: { error: 'Query parameter "q" is required' } };
  }
  const results = searchStations(query, 10);
  return { statusCode: 200, body: results };
}
