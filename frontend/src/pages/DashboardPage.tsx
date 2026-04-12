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
  return (
    <div
      className={`h-4 rounded skeleton-pulse ${className}`}
      style={{ backgroundColor: 'var(--color-bg-inset)' }}
    />
  );
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
        <div key={i} className="space-y-2 p-3 rounded-lg" style={{ backgroundColor: 'var(--color-bg-inset)' }}>
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
          <div className="w-3 h-3 rounded-full skeleton-pulse" style={{ backgroundColor: 'var(--color-bg-inset)' }} />
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
    <div
      className="rounded-xl border p-5"
      style={{
        backgroundColor: 'var(--color-bg-card)',
        borderColor: 'var(--color-border-subtle)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <h2
        className="text-base font-semibold mb-3"
        style={{ color: 'var(--color-text)', fontFamily: 'var(--font-display)' }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}

function SectionError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      className="rounded-lg border p-3 text-sm"
      style={{
        backgroundColor: 'var(--color-danger-soft)',
        borderColor: 'var(--color-danger)',
        color: 'var(--color-danger)',
      }}
    >
      {message}
      {onRetry && (
        <>
          {' '}
          <button onClick={onRetry} className="underline opacity-80 hover:opacity-100 cursor-pointer">
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
  const styles: Record<string, { bg: string; color: string }> = {
    'on-time': { bg: 'var(--color-success-soft)', color: 'var(--color-success)' },
    delayed: { bg: 'var(--color-warning-soft)', color: 'var(--color-warning)' },
    cancelled: { bg: 'var(--color-danger-soft)', color: 'var(--color-danger)' },
  };
  const labels = {
    'on-time': 'On Time',
    delayed: 'Delayed',
    cancelled: 'Cancelled',
  };
  const s = styles[status];
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: s.bg, color: s.color }}
    >
      {labels[status]}
    </span>
  );
}

function ServiceRow({ service }: { service: TrainService }) {
  const isCancelled = service.status === 'cancelled';
  return (
    <div
      className="rounded-lg border p-3"
      style={{
        borderColor: isCancelled ? 'var(--color-danger)' : 'var(--color-border-subtle)',
        backgroundColor: isCancelled ? 'var(--color-danger-soft)' : 'var(--color-bg-card-alt)',
      }}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
            {service.scheduledTime}
          </span>
          {service.status !== 'on-time' && (
            <span
              className={`font-mono text-sm ${isCancelled ? 'line-through' : ''}`}
              style={{ color: isCancelled ? 'var(--color-danger)' : 'var(--color-warning)' }}
            >
              {service.expectedTime}
            </span>
          )}
          <StatusBadge status={service.status} />
        </div>
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {service.platform && <span className="font-medium" style={{ color: 'var(--color-accent)' }}>Plat {service.platform}</span>}
          <span>{service.operator}</span>
        </div>
      </div>
      {service.callingPoints.length > 0 && (
        <p className="mt-1.5 text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
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
        <div
          key={i}
          className="rounded-lg border p-2 text-sm"
          style={{
            backgroundColor: 'var(--color-warning-soft)',
            borderColor: 'var(--color-warning)',
            color: 'var(--color-warning)',
          }}
        >
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
  const showOutsideNotice =
    !error &&
    services.length === 0 &&
    outsideWindow &&
    messages.length === 0 &&
    !!outsideWindowNotice;

  return (
    <div>
      <h3
        className="text-sm font-semibold mb-2 uppercase tracking-wider"
        style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-display)', fontSize: '0.7rem', letterSpacing: '0.1em' }}
      >
        {label}
      </h3>
      <ServiceMessages messages={messages} />
      {showOutsideNotice && (
        <div
          className="mb-3 rounded-lg border p-2 text-sm"
          style={{
            backgroundColor: 'var(--color-warning-soft)',
            borderColor: 'var(--color-warning)',
            color: 'var(--color-warning)',
          }}
        >
          {outsideWindowNotice}
        </div>
      )}
      {error ? (
        <SectionError message={error} onRetry={onRetry} />
      ) : services.length === 0 ? (
        outsideWindow || messages.length > 0 ? null : (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No services found</p>
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
      <div className="rounded-lg p-3 text-center" style={{ backgroundColor: 'var(--color-bg-inset)' }}>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>No data</p>
      </div>
    );
  }
  return (
    <div
      className="rounded-lg p-3 border"
      style={{
        backgroundColor: 'var(--color-bg-card-alt)',
        borderColor: 'var(--color-border-subtle)',
      }}
    >
      <p className="text-xs font-semibold mb-1 uppercase tracking-wider" style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-display)', fontSize: '0.65rem', letterSpacing: '0.08em' }}>{label}</p>
      <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>{weather.location}</p>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">{weatherIcon(weather.condition)}</span>
        <span className="text-xl font-bold" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-display)' }}>{weather.temperatureC}°C</span>
      </div>
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{weather.condition}</p>
      <div className="mt-2 flex gap-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
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
        style={{ backgroundColor: colour, boxShadow: `0 0 0 2px ${colour}33` }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{line.lineName}</span>
          <span
            className="text-xs font-medium"
            style={{ color: isGoodService ? 'var(--color-success)' : 'var(--color-warning)' }}
          >
            {line.status}
          </span>
        </div>
        {line.reason && (
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{line.reason}</p>
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
    return <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No TfL lines configured</p>;
  }
  return (
    <div className="divide-y" style={{ borderColor: 'var(--color-border-subtle)' }}>
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
      className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50"
      style={{
        backgroundColor: 'var(--color-bg-card)',
        borderColor: 'var(--color-border)',
        color: 'var(--color-text)',
        fontFamily: 'var(--font-body)',
      }}
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
          <h1
            className="text-2xl font-bold"
            style={{ color: 'var(--color-text)', fontFamily: 'var(--font-display)' }}
          >
            Dashboard
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            No active profile — go to Profiles to set one up.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <SectionCard title="Rail Departures">
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No data yet</p>
          </SectionCard>
          <SectionCard title="Weather">
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No data yet</p>
          </SectionCard>
          <SectionCard title="TfL Status">
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No data yet</p>
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
          <h1
            className="text-2xl font-bold"
            style={{ color: 'var(--color-text)', fontFamily: 'var(--font-display)' }}
          >
            Dashboard
          </h1>
          {dashboard && (
            <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
              {dashboard.profile.name}
            </p>
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
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Updated {new Date(dashboard.lastRefreshed).toLocaleTimeString()}
            </span>
          )}

          <button
            onClick={handleRefresh}
            disabled={dashboardQuery.isFetching}
            className="rounded-lg border px-3 py-1.5 text-sm font-medium disabled:opacity-50 cursor-pointer transition-colors"
            style={{
              backgroundColor: 'var(--color-bg-card)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text)',
              fontFamily: 'var(--font-display)',
            }}
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
        <div
          className="rounded-lg border p-4 text-sm"
          style={{
            backgroundColor: 'var(--color-danger-soft)',
            borderColor: 'var(--color-danger)',
            color: 'var(--color-danger)',
          }}
        >
          Failed to load dashboard data.{' '}
          <button onClick={handleRefresh} className="underline opacity-80 hover:opacity-100 cursor-pointer">
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
