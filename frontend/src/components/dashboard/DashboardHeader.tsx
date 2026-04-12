import type { CommuteProfile, DashboardResponse } from '../../api/types';

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

export function DashboardHeader({
  dashboard,
  profiles,
  isFetching,
  isSwitching,
  onRefresh,
  onSwitchProfile,
}: {
  dashboard: DashboardResponse | undefined;
  profiles: CommuteProfile[];
  isFetching: boolean;
  isSwitching: boolean;
  onRefresh: () => void;
  onSwitchProfile: (profileId: string) => void;
}) {
  return (
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
          onSwitch={onSwitchProfile}
          isSwitching={isSwitching}
        />

        {dashboard?.lastRefreshed && (
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Updated {new Date(dashboard.lastRefreshed).toLocaleTimeString()}
          </span>
        )}

        <button
          onClick={onRefresh}
          disabled={isFetching}
          className="rounded-lg border px-3 py-1.5 text-sm font-medium disabled:opacity-50 cursor-pointer transition-colors"
          style={{
            backgroundColor: 'var(--color-bg-card)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text)',
            fontFamily: 'var(--font-display)',
          }}
        >
          {isFetching ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
    </div>
  );
}
