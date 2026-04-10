import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchDashboard } from '../api/dashboardApi';
import { fetchProfiles, activateProfile } from '../api/profilesApi';
import type {
  DashboardResponse,
  TrainService,
  WeatherSummary,
  TflLineSummary,
  CommuteProfile,
} from '../api/types';

// ---------------------------------------------------------------------------
// TfL line colours (matches TflLineSelector.tsx)
// ---------------------------------------------------------------------------

const TFL_LINE_COLOURS: Record<string, string> = {
  bakerloo: '#B36305',
  central: '#E32017',
  circle: '#FFD300',
  district: '#00782A',
  elizabeth: '#6950A1',
  'hammersmith-city': '#F3A9BB',
  jubilee: '#A0A5A9',
  metropolitan: '#9B0056',
  northern: '#000000',
  piccadilly: '#003688',
  victoria: '#0098D4',
  'waterloo-city': '#95CDBA',
  dlr: '#00A4A7',
  'london-overground': '#EE7C0E',
  tram: '#84B817',
};

// ---------------------------------------------------------------------------
// Darwin API window helpers
// ---------------------------------------------------------------------------
//
// Darwin's live departure board returns services for ~120 minutes from now, and
// `railService.ts` filters those to ±30 min of the target time. So a target is
// "outside the window" when it is either in the past or more than 150 minutes
// in the future — in both cases an empty result is expected, not an error, so
// we suppress the "No services found" message.

function parseHHMM(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesUntil(departureTime: string, now: Date): number {
  const nowMins = now.getHours() * 60 + now.getMinutes();
  return parseHHMM(departureTime) - nowMins;
}

function isDepartureInPast(departureTime: string, now: Date): boolean {
  return minutesUntil(departureTime, now) < 0;
}

function isOutsideDarwinWindow(departureTime: string, now: Date): boolean {
  const delta = minutesUntil(departureTime, now);
  return delta < 0 || delta > 150;
}

// ---------------------------------------------------------------------------
// WMO weather code → icon + description mapping
// ---------------------------------------------------------------------------

function weatherIcon(condition: string): string {
  const lower = condition.toLowerCase();
  if (lower.includes('clear') || lower.includes('sunny')) return '☀️';
  if (lower.includes('partly') || lower.includes('mainly clear')) return '⛅';
  if (lower.includes('overcast') || lower.includes('cloudy')) return '☁️';
  if (lower.includes('fog') || lower.includes('mist')) return '🌫️';
  if (lower.includes('drizzle')) return '🌦️';
  if (lower.includes('rain') || lower.includes('shower')) return '🌧️';
  if (lower.includes('snow') || lower.includes('flurr')) return '🌨️';
  if (lower.includes('thunder') || lower.includes('storm')) return '⛈️';
  if (lower.includes('sleet') || lower.includes('freezing')) return '🌨️';
  return '🌤️';
}

// ---------------------------------------------------------------------------
// Skeleton loaders
// ---------------------------------------------------------------------------

function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={`h-4 bg-gray-200 rounded animate-pulse ${className}`} />;
}

function RailSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-2">
          <SkeletonLine className="w-3/4" />
          <SkeletonLine className="w-1/2" />
        </div>
      ))}
    </div>
  );
}

function WeatherSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-2 p-3 rounded-lg bg-gray-50">
          <SkeletonLine className="w-2/3" />
          <SkeletonLine className="w-1/2" />
          <SkeletonLine className="w-3/4" />
        </div>
      ))}
    </div>
  );
}

function TflSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-gray-200 animate-pulse" />
          <SkeletonLine className="flex-1" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section card wrapper
// ---------------------------------------------------------------------------

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <h2 className="text-base font-semibold text-gray-900 mb-3">{title}</h2>
      {children}
    </div>
  );
}

function SectionError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
      {message}
      {onRetry && (
        <>
          {' '}
          <button onClick={onRetry} className="underline hover:text-red-900">
            Retry
          </button>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rail section
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: TrainService['status'] }) {
  const styles = {
    'on-time': 'bg-green-100 text-green-700',
    delayed: 'bg-amber-100 text-amber-700',
    cancelled: 'bg-red-100 text-red-700',
  };
  const labels = {
    'on-time': 'On Time',
    delayed: 'Delayed',
    cancelled: 'Cancelled',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function ServiceRow({ service }: { service: TrainService }) {
  return (
    <div className={`rounded-md border p-3 ${service.status === 'cancelled' ? 'border-red-200 bg-red-50/50' : 'border-gray-100 bg-gray-50/50'}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold">{service.scheduledTime}</span>
          {service.status !== 'on-time' && (
            <span className={`font-mono text-sm ${service.status === 'cancelled' ? 'text-red-600 line-through' : 'text-amber-600'}`}>
              {service.expectedTime}
            </span>
          )}
          <StatusBadge status={service.status} />
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          {service.platform && <span>Plat {service.platform}</span>}
          <span>{service.operator}</span>
        </div>
      </div>
      {service.callingPoints.length > 0 && (
        <p className="mt-1.5 text-xs text-gray-500 truncate">
          Calling at: {service.callingPoints.join(', ')}
        </p>
      )}
    </div>
  );
}

function ServiceMessages({ messages }: { messages: string[] }) {
  if (messages.length === 0) return null;
  return (
    <div className="mb-3 space-y-1">
      {messages.map((msg, i) => (
        <div key={i} className="rounded-md bg-amber-50 border border-amber-200 p-2 text-sm text-amber-800">
          {msg}
        </div>
      ))}
    </div>
  );
}

function DepartureBoard({
  label,
  services,
  messages,
  error,
  onRetry,
  outsideWindow,
  outsideWindowNotice,
}: {
  label: string;
  services: TrainService[];
  messages: string[];
  error?: string;
  onRetry: () => void;
  outsideWindow: boolean;
  outsideWindowNotice?: string;
}) {
  // Fallback notice when outside the Darwin window, no services, and the backend
  // didn't already supply an explanatory message.
  const showOutsideNotice =
    !error &&
    services.length === 0 &&
    outsideWindow &&
    messages.length === 0 &&
    !!outsideWindowNotice;

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 mb-2">{label}</h3>
      <ServiceMessages messages={messages} />
      {showOutsideNotice && (
        <div className="mb-3 rounded-md bg-amber-50 border border-amber-200 p-2 text-sm text-amber-800">
          {outsideWindowNotice}
        </div>
      )}
      {error ? (
        <SectionError message={error} onRetry={onRetry} />
      ) : services.length === 0 ? (
        // Suppress the placeholder when we're outside the Darwin window, OR when the
        // backend already returned an explanatory message (e.g. "Services will appear
        // closer to the departure time."). The message alone is enough context.
        outsideWindow || messages.length > 0 ? null : (
          <p className="text-sm text-gray-400">No services found</p>
        )
      ) : (
        <div className="space-y-2">
          {services.map((s, i) => (
            <ServiceRow key={i} service={s} />
          ))}
        </div>
      )}
    </div>
  );
}

function RailSection({
  rail,
  profile,
  onRetry,
}: {
  rail: DashboardResponse['rail'];
  profile: CommuteProfile | undefined;
  onRetry: () => void;
}) {
  const now = new Date();
  const hideOutbound = profile ? isDepartureInPast(profile.outbound.departureTime, now) : false;
  const outboundOutside = profile ? isOutsideDarwinWindow(profile.outbound.departureTime, now) : false;
  const returnOutside = profile ? isOutsideDarwinWindow(profile.return.departureTime, now) : false;

  return (
    <div className="space-y-5">
      {!hideOutbound && (
        <DepartureBoard
          label="Outbound"
          services={rail.outbound.services}
          messages={rail.outbound.messages}
          error={rail.outbound.error}
          onRetry={onRetry}
          outsideWindow={outboundOutside}
          outsideWindowNotice="Services will appear closer to the departure time."
        />
      )}
      <DepartureBoard
        label="Return"
        services={rail.return.services}
        messages={rail.return.messages}
        error={rail.return.error}
        onRetry={onRetry}
        outsideWindow={returnOutside}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Weather section
// ---------------------------------------------------------------------------

function WeatherCard({ weather, label }: { weather: WeatherSummary | null; label: string }) {
  if (!weather) {
    return (
      <div className="rounded-lg bg-gray-50 p-3 text-center">
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm text-gray-400 mt-1">No data</p>
      </div>
    );
  }
  return (
    <div className="rounded-lg bg-gradient-to-br from-blue-50 to-sky-50 p-3">
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <p className="text-xs text-gray-400 mb-2">{weather.location}</p>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">{weatherIcon(weather.condition)}</span>
        <span className="text-xl font-semibold text-gray-900">{weather.temperatureC}°C</span>
      </div>
      <p className="text-sm text-gray-600">{weather.condition}</p>
      <div className="mt-2 flex gap-3 text-xs text-gray-500">
        <span>💧 {weather.precipitationProbability}%</span>
        <span>💨 {weather.windSpeedKmh} km/h</span>
      </div>
    </div>
  );
}

function WeatherSection({ weather, onRetry }: { weather: DashboardResponse['weather']; onRetry: () => void }) {
  if (weather.error) {
    return <SectionError message={weather.error} onRetry={onRetry} />;
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <WeatherCard weather={weather.outboundOrigin} label="Outbound Origin" />
      <WeatherCard weather={weather.destination} label="Destination" />
      <WeatherCard weather={weather.returnDestination} label="Return Destination" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// TfL section
// ---------------------------------------------------------------------------

function TflLineRow({ line }: { line: TflLineSummary }) {
  const colour = TFL_LINE_COLOURS[line.lineId] ?? '#666';
  const isGoodService = line.status.toLowerCase().includes('good service');
  return (
    <div className="flex items-start gap-3 py-2">
      <span
        className="mt-0.5 inline-block h-3 w-3 rounded-full shrink-0"
        style={{ backgroundColor: colour }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-900">{line.lineName}</span>
          <span className={`text-xs font-medium ${isGoodService ? 'text-green-600' : 'text-amber-600'}`}>
            {line.status}
          </span>
        </div>
        {line.reason && (
          <p className="text-xs text-gray-500 mt-0.5">{line.reason}</p>
        )}
      </div>
    </div>
  );
}

function TflSection({ tfl, onRetry }: { tfl: DashboardResponse['tfl']; onRetry: () => void }) {
  if (tfl.error) {
    return <SectionError message={tfl.error} onRetry={onRetry} />;
  }
  if (tfl.lines.length === 0) {
    return <p className="text-sm text-gray-400">No TfL lines configured</p>;
  }
  return (
    <div className="divide-y divide-gray-100">
      {tfl.lines.map((line) => (
        <TflLineRow key={line.lineId} line={line} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Profile selector dropdown
// ---------------------------------------------------------------------------

function ProfileSelector({
  profiles,
  activeProfileId,
  onSwitch,
  isSwitching,
}: {
  profiles: CommuteProfile[];
  activeProfileId: string;
  onSwitch: (profileId: string) => void;
  isSwitching: boolean;
}) {
  if (profiles.length <= 1) return null;
  return (
    <select
      value={activeProfileId}
      onChange={(e) => onSwitch(e.target.value)}
      disabled={isSwitching}
      className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 shadow-sm disabled:opacity-50"
    >
      {profiles.map((p) => (
        <option key={p.profileId} value={p.profileId}>
          {p.name}
        </option>
      ))}
    </select>
  );
}

// ---------------------------------------------------------------------------
// Dashboard page
// ---------------------------------------------------------------------------

export function DashboardPage() {
  const queryClient = useQueryClient();

  const profilesQuery = useQuery({
    queryKey: ['profiles'],
    queryFn: fetchProfiles,
  });

  const dashboardQuery = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    retry: false,
  });

  const activateMutation = useMutation({
    mutationFn: activateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const profiles = profilesQuery.data ?? [];
  const dashboard = dashboardQuery.data;
  const hasActiveProfile = profiles.some((p) => p.isActive);
  const isLoading = dashboardQuery.isLoading && hasActiveProfile;
  const hasError = dashboardQuery.isError && hasActiveProfile;

  function handleRefresh() {
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  }

  function handleSwitchProfile(profileId: string) {
    activateMutation.mutate(profileId);
  }

  // No active profile — show empty state (must match E2E test expectations)
  if (!hasActiveProfile && !isLoading) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            No active profile — go to Profiles to set one up.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <SectionCard title="Rail Departures">
            <p className="text-sm text-gray-400">No data yet</p>
          </SectionCard>
          <SectionCard title="Weather">
            <p className="text-sm text-gray-400">No data yet</p>
          </SectionCard>
          <SectionCard title="TfL Status">
            <p className="text-sm text-gray-400">No data yet</p>
          </SectionCard>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Dashboard header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          {dashboard && (
            <p className="text-sm text-gray-500 mt-0.5">{dashboard.profile.name}</p>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <ProfileSelector
            profiles={profiles}
            activeProfileId={dashboard?.profile.profileId ?? profiles.find((p) => p.isActive)?.profileId ?? ''}
            onSwitch={handleSwitchProfile}
            isSwitching={activateMutation.isPending}
          />

          {dashboard?.lastRefreshed && (
            <span className="text-xs text-gray-400">
              Updated {new Date(dashboard.lastRefreshed).toLocaleTimeString()}
            </span>
          )}

          <button
            onClick={handleRefresh}
            disabled={dashboardQuery.isFetching}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {dashboardQuery.isFetching ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <SectionCard title="Rail Departures">
            <RailSkeleton />
          </SectionCard>
          <SectionCard title="Weather">
            <WeatherSkeleton />
          </SectionCard>
          <SectionCard title="TfL Status">
            <TflSkeleton />
          </SectionCard>
        </div>
      )}

      {/* Error state */}
      {hasError && !dashboard && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          Failed to load dashboard data.{' '}
          <button onClick={handleRefresh} className="underline hover:text-red-900">
            Retry
          </button>
        </div>
      )}

      {/* Dashboard data */}
      {dashboard && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Rail — spans 2 columns on desktop */}
          <div className="lg:col-span-2">
            <SectionCard title="Rail Departures">
              <RailSection
                rail={dashboard.rail}
                profile={profiles.find((p) => p.profileId === dashboard.profile.profileId)}
                onRetry={handleRefresh}
              />
            </SectionCard>
          </div>

          {/* Weather + TfL stacked in right column on desktop */}
          <div className="space-y-4">
            <SectionCard title="Weather">
              <WeatherSection weather={dashboard.weather} onRetry={handleRefresh} />
            </SectionCard>

            {dashboard.tfl.lines.length > 0 && (
              <SectionCard title="TfL Status">
                <TflSection tfl={dashboard.tfl} onRetry={handleRefresh} />
              </SectionCard>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
