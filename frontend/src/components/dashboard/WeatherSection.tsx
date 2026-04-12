import type { WeatherSummary } from '../../api/types';
import { SectionError } from './SectionCard';
import { weatherIcon } from './sectionHelpers';

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

export function WeatherSection({
  outboundOrigin,
  destination,
  returnDestination,
  onRetry,
}: {
  outboundOrigin: { data?: WeatherSummary; error?: string };
  destination: { data?: WeatherSummary; error?: string };
  returnDestination: { data?: WeatherSummary; error?: string };
  onRetry: () => void;
}) {
  const allErrored =
    outboundOrigin.error && destination.error && returnDestination.error;
  if (allErrored) {
    return <SectionError message="Weather service unavailable" onRetry={onRetry} />;
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <WeatherCard weather={outboundOrigin.data ?? null} label="Outbound Origin" />
      <WeatherCard weather={destination.data ?? null} label="Destination" />
      <WeatherCard weather={returnDestination.data ?? null} label="Return Destination" />
    </div>
  );
}
