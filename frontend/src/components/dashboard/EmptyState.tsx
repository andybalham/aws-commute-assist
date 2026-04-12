import { SectionCard } from './SectionCard';

export function EmptyState() {
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
