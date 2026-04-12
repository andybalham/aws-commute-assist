import type { TrainService, CommuteProfile, RailSource } from '../../api/types';
import { SectionError } from './SectionCard';
import { isDepartureInPast, isOutsideDarwinWindow } from './sectionHelpers';

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

export function RailSection({
  outbound,
  returnSrc,
  profile,
  onRetry,
}: {
  outbound: { data?: RailSource; error?: string };
  returnSrc: { data?: RailSource; error?: string };
  profile: CommuteProfile | undefined;
  onRetry: () => void;
}) {
  const now = new Date();
  const hideOutbound = profile ? isDepartureInPast(profile.outbound.departureTime, now) : false;
  const outboundOutside = profile ? isOutsideDarwinWindow(profile.outbound.departureTime, now) : false;
  const returnOutside = profile ? isOutsideDarwinWindow(profile.return.departureTime, now) : false;

  const outboundServices = outbound.data?.services ?? [];
  const outboundMessages = outbound.data?.messages ?? [];
  const outboundError = outbound.error ? `Rail service error: ${outbound.error}` : undefined;

  const returnServices = returnSrc.data?.services ?? [];
  const returnMessages = returnSrc.data?.messages ?? [];
  const returnError = returnSrc.error ? `Rail service error: ${returnSrc.error}` : undefined;

  return (
    <div className="space-y-5">
      {!hideOutbound && (
        <DepartureBoard
          label="Outbound"
          services={outboundServices}
          messages={outboundMessages}
          error={outboundError}
          onRetry={onRetry}
          outsideWindow={outboundOutside}
          outsideWindowNotice="Services will appear closer to the departure time."
        />
      )}
      <DepartureBoard
        label="Return"
        services={returnServices}
        messages={returnMessages}
        error={returnError}
        onRetry={onRetry}
        outsideWindow={returnOutside}
      />
    </div>
  );
}
