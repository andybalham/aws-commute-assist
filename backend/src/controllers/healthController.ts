import { RouteContext, RouteResponse } from '../types';

export function getHealth(_ctx: RouteContext): RouteResponse {
  return { statusCode: 200, body: { status: 'ok' } };
}
