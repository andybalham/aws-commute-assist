import axios from 'axios';
import { getStationByCrs } from '../data/stations';
import { WeatherSummary } from '../types';

// WMO Weather Interpretation Codes → human-readable conditions
// https://open-meteo.com/en/docs — WMO Code Table
const WMO_CODES: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snowfall',
  73: 'Moderate snowfall',
  75: 'Heavy snowfall',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail',
};

function wmoToCondition(code: number): string {
  return WMO_CODES[code] ?? `Unknown (${code})`;
}

export async function getWeatherForecast(
  crs: string,
  isoDateTime: string
): Promise<WeatherSummary> {
  const station = getStationByCrs(crs);
  if (!station) {
    throw new Error(`Unknown station CRS: ${crs}`);
  }

  const targetDate = isoDateTime.slice(0, 10); // YYYY-MM-DD
  const targetHour = parseInt(isoDateTime.slice(11, 13), 10);

  const response = await axios.get('https://api.open-meteo.com/v1/forecast', {
    params: {
      latitude: station.lat,
      longitude: station.lon,
      hourly: 'temperature_2m,precipitation_probability,wind_speed_10m,weather_code',
      start_date: targetDate,
      end_date: targetDate,
      timezone: 'Europe/London',
    },
    timeout: 5000,
  });

  const hourly = response.data.hourly;
  const hourIndex = Math.min(targetHour, hourly.time.length - 1);

  return {
    location: station.name,
    time: isoDateTime.slice(11, 16), // HH:MM
    condition: wmoToCondition(hourly.weather_code[hourIndex]),
    temperatureC: Math.round(hourly.temperature_2m[hourIndex]),
    precipitationProbability: hourly.precipitation_probability[hourIndex] ?? 0,
    windSpeedKmh: Math.round(hourly.wind_speed_10m[hourIndex]),
  };
}
