import { RouteContext, RouteResponse, DashboardResponse } from '../types';
import { listProfiles } from '../db/profilesRepository';
import { runAll } from '../services/sourceRegistry';

export async function getDashboard(ctx: RouteContext): Promise<RouteResponse> {
  const profiles = await listProfiles(ctx.userId);
  const profile = profiles.find((p) => p.isActive);

  if (!profile) {
    return {
      statusCode: 404,
      body: { error: 'No active profile. Create and activate a profile first.' },
    };
  }

  const sources = await runAll(profile);
  const response: DashboardResponse = {
    profile: { name: profile.name, profileId: profile.profileId },
    sources,
    lastRefreshed: new Date().toISOString(),
  };

  return { statusCode: 200, body: response };
}
