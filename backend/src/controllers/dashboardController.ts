import { RouteContext, RouteResponse, DashboardResponse } from '../types';

export function getDashboard(_ctx: RouteContext): RouteResponse {
  const stub: DashboardResponse = {
    profile: {
      name: 'Default Commute',
      profileId: 'stub-profile-id',
    },
    rail: {
      outbound: {
        services: [
          {
            scheduledTime: '07:30',
            expectedTime: '07:30',
            platform: '2',
            operator: 'Southern',
            callingPoints: ['East Croydon', 'London Victoria'],
            status: 'on-time',
          },
          {
            scheduledTime: '07:45',
            expectedTime: '07:52',
            platform: '1',
            operator: 'Southern',
            callingPoints: ['East Croydon', 'London Bridge'],
            status: 'delayed',
          },
        ],
        messages: [],
      },
      return: {
        services: [
          {
            scheduledTime: '17:30',
            expectedTime: '17:30',
            platform: null,
            operator: 'Southern',
            callingPoints: ['East Croydon', 'Brighton'],
            status: 'on-time',
          },
        ],
        messages: [],
      },
    },
    weather: {
      outboundOrigin: {
        location: 'Brighton',
        time: '07:30',
        condition: 'Partly cloudy',
        temperatureC: 12,
        precipitationProbability: 20,
        windSpeedKmh: 15,
      },
      destination: {
        location: 'London Victoria',
        time: '08:15',
        condition: 'Overcast',
        temperatureC: 14,
        precipitationProbability: 40,
        windSpeedKmh: 10,
      },
      returnOrigin: {
        location: 'London Victoria',
        time: '17:30',
        condition: 'Light rain',
        temperatureC: 13,
        precipitationProbability: 75,
        windSpeedKmh: 20,
      },
    },
    tfl: {
      lines: [
        {
          lineId: 'victoria',
          lineName: 'Victoria',
          status: 'Good Service',
          reason: null,
        },
        {
          lineId: 'district',
          lineName: 'District',
          status: 'Minor Delays',
          reason: 'Minor delays due to an earlier signal failure',
        },
      ],
    },
    lastRefreshed: new Date().toISOString(),
  };

  return { statusCode: 200, body: stub };
}
