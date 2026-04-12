export interface CommuteProfile {
  userId: string;
  profileId: string;
  name: string;
  outbound: {
    originCRS: string;
    destinationCRS: string;
    departureTime: string;
  };
  return: {
    originCRS: string;
    destinationCRS: string;
    departureTime: string;
  };
  tflLines: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SourceResult<T = unknown> {
  status: 'ok' | 'error';
  data?: T;
  error?: string;
}

export interface DashboardResponse {
  profile: {
    name: string;
    profileId: string;
  };
  sources: Record<string, SourceResult>;
  lastRefreshed: string;
}

export interface TrainService {
  scheduledTime: string;
  expectedTime: string;
  platform: string | null;
  operator: string;
  callingPoints: string[];
  status: 'on-time' | 'delayed' | 'cancelled';
}

export interface WeatherSummary {
  location: string;
  time: string;
  condition: string;
  temperatureC: number;
  precipitationProbability: number;
  windSpeedKmh: number;
}

export interface TflLineSummary {
  lineId: string;
  lineName: string;
  status: string;
  reason: string | null;
}

export interface RouteContext {
  method: string;
  path: string;
  params: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
  userId: string;
}

export interface RouteResponse {
  statusCode: number;
  body: unknown;
}
