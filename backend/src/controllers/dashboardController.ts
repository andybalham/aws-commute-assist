import { RouteContext, RouteResponse, DashboardResponse } from '../types';
import { listProfiles } from '../db/profilesRepository';
import { getDepartures, getServiceMessages } from '../services/railService';
import { getWeatherForecast } from '../services/weatherService';
import { getLineStatuses } from '../services/tflService';

function todayAt(time: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `${today}T${time}:00`;
}

export async function getDashboard(ctx: RouteContext): Promise<RouteResponse> {
  const profiles = await listProfiles(ctx.userId);
  const profile = profiles.find((p) => p.isActive);

  if (!profile) {
    return {
      statusCode: 404,
      body: { error: 'No active profile. Create and activate a profile first.' },
    };
  }

  // Fan out all service calls in parallel — each independently error-handled
  const [
    outboundRailResult,
    returnRailResult,
    outboundMessagesResult,
    weatherOriginResult,
    weatherDestResult,
    weatherReturnResult,
    tflResult,
  ] = await Promise.allSettled([
    getDepartures(
      profile.outbound.originCRS,
      profile.outbound.destinationCRS,
      profile.outbound.departureTime
    ),
    getDepartures(
      profile.return.originCRS,
      profile.return.destinationCRS,
      profile.return.departureTime
    ),
    getServiceMessages(profile.outbound.originCRS),
    getWeatherForecast(
      profile.outbound.originCRS,
      todayAt(profile.outbound.departureTime)
    ),
    getWeatherForecast(
      profile.outbound.destinationCRS,
      todayAt(profile.outbound.departureTime)
    ),
    getWeatherForecast(
      profile.return.destinationCRS,
      todayAt(profile.return.departureTime)
    ),
    profile.tflLines.length > 0
      ? getLineStatuses(profile.tflLines)
      : Promise.resolve([]),
  ]);

  const response: DashboardResponse = {
    profile: {
      name: profile.name,
      profileId: profile.profileId,
    },
    rail: {
      outbound: {
        services:
          outboundRailResult.status === 'fulfilled'
            ? outboundRailResult.value.services
            : [],
        messages:
          outboundMessagesResult.status === 'fulfilled'
            ? outboundMessagesResult.value
            : [],
        ...(outboundRailResult.status === 'rejected' && {
          error: `Rail service error: ${outboundRailResult.reason?.message ?? 'Unknown error'}`,
        }),
      },
      return: {
        services:
          returnRailResult.status === 'fulfilled'
            ? returnRailResult.value.services
            : [],
        messages: [],
        ...(returnRailResult.status === 'rejected' && {
          error: `Rail service error: ${returnRailResult.reason?.message ?? 'Unknown error'}`,
        }),
      },
    },
    weather: {
      outboundOrigin:
        weatherOriginResult.status === 'fulfilled'
          ? weatherOriginResult.value
          : null,
      destination:
        weatherDestResult.status === 'fulfilled'
          ? weatherDestResult.value
          : null,
      returnDestination:
        weatherReturnResult.status === 'fulfilled'
          ? weatherReturnResult.value
          : null,
      ...((weatherOriginResult.status === 'rejected' ||
        weatherDestResult.status === 'rejected' ||
        weatherReturnResult.status === 'rejected') && {
        error: 'Weather service partially or fully unavailable',
      }),
    },
    tfl: {
      lines:
        tflResult.status === 'fulfilled' ? tflResult.value : [],
      ...(tflResult.status === 'rejected' && {
        error: `TfL service error: ${tflResult.reason?.message ?? 'Unknown error'}`,
      }),
    },
    lastRefreshed: new Date().toISOString(),
  };

  return { statusCode: 200, body: response };
}
