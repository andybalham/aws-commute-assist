import { RouteContext } from '../types';
import { getDashboard } from '../controllers/dashboardController';

jest.mock('../db/profilesRepository');
jest.mock('../services/railService');
jest.mock('../services/weatherService');
jest.mock('../services/tflService');

const repo = jest.requireMock('../db/profilesRepository') as {
  listProfiles: jest.Mock;
};
const railService = jest.requireMock('../services/railService') as {
  getDepartures: jest.Mock;
  getServiceMessages: jest.Mock;
};
const weatherService = jest.requireMock('../services/weatherService') as {
  getWeatherForecast: jest.Mock;
};
const tflService = jest.requireMock('../services/tflService') as {
  getLineStatuses: jest.Mock;
};

const ACTIVE_PROFILE = {
  userId: 'user-1',
  profileId: 'profile-1',
  name: 'Test Commute',
  outbound: { originCRS: 'BTN', destinationCRS: 'VIC', departureTime: '07:30' },
  return: { originCRS: 'VIC', destinationCRS: 'BTN', departureTime: '17:30' },
  tflLines: ['victoria'],
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

function makeCtx(overrides: Partial<RouteContext> = {}): RouteContext {
  return {
    method: 'GET',
    path: '/api/dashboard',
    params: {},
    query: {},
    body: null,
    userId: 'user-1',
    ...overrides,
  };
}

describe('dashboardController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    repo.listProfiles.mockResolvedValue([ACTIVE_PROFILE]);
    railService.getDepartures.mockResolvedValue({ services: [], messages: [] });
    railService.getServiceMessages.mockResolvedValue([]);
    weatherService.getWeatherForecast.mockResolvedValue({
      location: 'Brighton',
      time: '07:30',
      condition: 'Clear sky',
      temperatureC: 12,
      precipitationProbability: 10,
      windSpeedKmh: 15,
    });
    tflService.getLineStatuses.mockResolvedValue([
      { lineId: 'victoria', lineName: 'Victoria', status: 'Good Service', reason: null },
    ]);
  });

  it('returns 404 when no active profile exists', async () => {
    repo.listProfiles.mockResolvedValue([]);
    const result = await getDashboard(makeCtx());
    expect(result.statusCode).toBe(404);
  });

  it('returns a full dashboard response with all sources', async () => {
    const result = await getDashboard(makeCtx());

    expect(result.statusCode).toBe(200);
    const body = result.body as any;
    expect(body.profile.name).toBe('Test Commute');
    expect(body.sources['rail.outbound'].status).toBe('ok');
    expect(body.sources['rail.return'].status).toBe('ok');
    expect(body.sources['weather.outboundOrigin'].status).toBe('ok');
    expect(body.sources['weather.destination'].status).toBe('ok');
    expect(body.sources['weather.returnDestination'].status).toBe('ok');
    expect(body.sources['tfl'].status).toBe('ok');
    expect(body.sources['tfl'].data).toHaveLength(1);
    expect(body.lastRefreshed).toBeDefined();
  });

  it('marks rail.outbound as error when rail service fails', async () => {
    railService.getDepartures.mockRejectedValue(new Error('Darwin down'));

    const result = await getDashboard(makeCtx());
    const body = result.body as any;

    expect(result.statusCode).toBe(200);
    expect(body.sources['rail.outbound'].status).toBe('error');
    expect(body.sources['rail.outbound'].error).toContain('Darwin down');
    expect(body.sources['weather.outboundOrigin'].status).toBe('ok');
    expect(body.sources['tfl'].status).toBe('ok');
  });

  it('marks weather source as error when that call fails', async () => {
    weatherService.getWeatherForecast.mockRejectedValueOnce(new Error('API timeout'));

    const result = await getDashboard(makeCtx());
    const body = result.body as any;

    expect(result.statusCode).toBe(200);
    expect(body.sources['weather.outboundOrigin'].status).toBe('error');
    expect(body.sources['weather.outboundOrigin'].error).toContain('API timeout');
    expect(body.sources['weather.destination'].status).toBe('ok');
    expect(body.sources['rail.outbound'].status).toBe('ok');
    expect(body.sources['tfl'].status).toBe('ok');
  });

  it('marks tfl as error when TfL service fails', async () => {
    tflService.getLineStatuses.mockRejectedValue(new Error('TfL down'));

    const result = await getDashboard(makeCtx());
    const body = result.body as any;

    expect(result.statusCode).toBe(200);
    expect(body.sources['tfl'].status).toBe('error');
    expect(body.sources['tfl'].error).toContain('TfL down');
    expect(body.sources['weather.outboundOrigin'].status).toBe('ok');
  });

  it('omits tfl source when no lines configured', async () => {
    repo.listProfiles.mockResolvedValue([
      { ...ACTIVE_PROFILE, tflLines: [] },
    ]);

    const result = await getDashboard(makeCtx());
    const body = result.body as any;

    expect(body.sources['tfl']).toBeUndefined();
    expect(tflService.getLineStatuses).not.toHaveBeenCalled();
  });

  it('fans out all service calls in parallel', async () => {
    await getDashboard(makeCtx());

    expect(railService.getDepartures).toHaveBeenCalledTimes(2);
    expect(railService.getServiceMessages).toHaveBeenCalledTimes(1);
    expect(weatherService.getWeatherForecast).toHaveBeenCalledTimes(3);
    expect(tflService.getLineStatuses).toHaveBeenCalledTimes(1);
  });
});
