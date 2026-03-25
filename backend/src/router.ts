import { RouteContext, RouteResponse } from './types';
import { getHealth } from './controllers/healthController';
import {
  listProfiles,
  createProfile,
  updateProfile,
  deleteProfile,
  activateProfile,
} from './controllers/profilesController';
import { getDashboard } from './controllers/dashboardController';
import { getStations } from './controllers/stationsController';

type RouteHandler = (ctx: RouteContext) => RouteResponse | Promise<RouteResponse>;

interface Route {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  handler: RouteHandler;
}

const routes: Route[] = [
  {
    method: 'GET',
    pattern: /^\/health$/,
    paramNames: [],
    handler: getHealth,
  },
  {
    method: 'GET',
    pattern: /^\/api\/profiles$/,
    paramNames: [],
    handler: listProfiles,
  },
  {
    method: 'POST',
    pattern: /^\/api\/profiles$/,
    paramNames: [],
    handler: createProfile,
  },
  {
    method: 'PUT',
    pattern: /^\/api\/profiles\/([^/]+)$/,
    paramNames: ['profileId'],
    handler: updateProfile,
  },
  {
    method: 'DELETE',
    pattern: /^\/api\/profiles\/([^/]+)$/,
    paramNames: ['profileId'],
    handler: deleteProfile,
  },
  {
    method: 'PATCH',
    pattern: /^\/api\/profiles\/([^/]+)\/activate$/,
    paramNames: ['profileId'],
    handler: activateProfile,
  },
  {
    method: 'GET',
    pattern: /^\/api\/stations$/,
    paramNames: [],
    handler: getStations,
  },
  {
    method: 'GET',
    pattern: /^\/api\/dashboard$/,
    paramNames: [],
    handler: getDashboard,
  },
];

export async function routeRequest(ctx: RouteContext): Promise<RouteResponse> {
  for (const route of routes) {
    if (route.method !== ctx.method.toUpperCase()) continue;
    const match = route.pattern.exec(ctx.path);
    if (!match) continue;

    const params: Record<string, string> = {};
    route.paramNames.forEach((name, i) => {
      params[name] = match[i + 1];
    });

    return route.handler({ ...ctx, params });
  }

  return { statusCode: 404, body: { error: 'Not found' } };
}
