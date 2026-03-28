import axios from 'axios';
import { getWeatherForecast } from '../services/weatherService';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock stations lookup
jest.mock('../data/stations', () => ({
  getStationByCrs: (crs: string) => {
    if (crs === 'BTN') return { crs: 'BTN', name: 'Brighton', lat: 50.829, lon: -0.141 };
    if (crs === 'VIC') return { crs: 'VIC', name: 'London Victoria', lat: 51.4952, lon: -0.1439 };
    return null;
  },
}));

const MOCK_OPEN_METEO_RESPONSE = {
  data: {
    hourly: {
      time: Array.from({ length: 24 }, (_, i) =>
        `2026-03-28T${String(i).padStart(2, '0')}:00`
      ),
      temperature_2m: Array.from({ length: 24 }, (_, i) => 8 + i * 0.5),
      precipitation_probability: Array.from({ length: 24 }, () => 25),
      wind_speed_10m: Array.from({ length: 24 }, () => 12.3),
      weather_code: Array.from({ length: 24 }, () => 2),
    },
  },
};

describe('weatherService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns a WeatherSummary for a valid station and time', async () => {
    mockedAxios.get.mockResolvedValue(MOCK_OPEN_METEO_RESPONSE);

    const result = await getWeatherForecast('BTN', '2026-03-28T07:30:00');

    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://api.open-meteo.com/v1/forecast',
      expect.objectContaining({
        params: expect.objectContaining({
          latitude: 50.829,
          longitude: -0.141,
          start_date: '2026-03-28',
          end_date: '2026-03-28',
        }),
      })
    );

    expect(result).toEqual({
      location: 'Brighton',
      time: '07:30',
      condition: 'Partly cloudy',
      temperatureC: expect.any(Number),
      precipitationProbability: 25,
      windSpeedKmh: expect.any(Number),
    });
  });

  it('throws for an unknown CRS code', async () => {
    await expect(
      getWeatherForecast('ZZZ', '2026-03-28T07:00:00')
    ).rejects.toThrow('Unknown station CRS: ZZZ');
  });

  it('propagates API errors', async () => {
    mockedAxios.get.mockRejectedValue(new Error('Network error'));

    await expect(
      getWeatherForecast('BTN', '2026-03-28T07:00:00')
    ).rejects.toThrow('Network error');
  });
});
