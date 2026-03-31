export interface CommuteLeg {
  originCRS: string;
  destinationCRS: string;
  departureTime: string;
}

export interface CommuteProfile {
  userId: string;
  profileId: string;
  name: string;
  outbound: CommuteLeg;
  return: CommuteLeg;
  tflLines: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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

export interface DashboardResponse {
  profile: {
    name: string;
    profileId: string;
  };
  rail: {
    outbound: {
      services: TrainService[];
      messages: string[];
      error?: string;
    };
    return: {
      services: TrainService[];
      messages: string[];
      error?: string;
    };
  };
  weather: {
    outboundOrigin: WeatherSummary | null;
    destination: WeatherSummary | null;
    returnDestination: WeatherSummary | null;
    error?: string;
  };
  tfl: {
    lines: TflLineSummary[];
    error?: string;
  };
  lastRefreshed: string;
}

export interface StationMatch {
  crs: string;
  name: string;
}
