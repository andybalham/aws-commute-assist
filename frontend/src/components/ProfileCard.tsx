import type { CommuteProfile } from '../api/types';

interface ProfileCardProps {
  profile: CommuteProfile;
  onActivate: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isActivating: boolean;
  isDeleting: boolean;
}

export function ProfileCard({
  profile,
  onActivate,
  onEdit,
  onDelete,
  isActivating,
  isDeleting,
}: ProfileCardProps) {
  return (
    <div
      className="rounded-xl border p-4 transition-shadow"
      style={{
        borderColor: profile.isActive ? 'var(--color-accent)' : 'var(--color-border-subtle)',
        backgroundColor: profile.isActive ? 'var(--color-accent-soft)' : 'var(--color-bg-card)',
        boxShadow: profile.isActive ? 'var(--shadow-elevated)' : 'var(--shadow-card)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3
              className="text-base font-semibold truncate"
              style={{ color: 'var(--color-text)', fontFamily: 'var(--font-display)' }}
            >
              {profile.name}
            </h3>
            {profile.isActive && (
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ backgroundColor: 'var(--color-accent-muted)', color: 'var(--color-accent)' }}
              >
                Active
              </span>
            )}
          </div>

          <div className="mt-2 space-y-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            <p>
              <span className="font-medium" style={{ color: 'var(--color-text)' }}>Outbound:</span>{' '}
              {profile.outbound.originCRS} → {profile.outbound.destinationCRS}{' '}
              at {profile.outbound.departureTime}
            </p>
            <p>
              <span className="font-medium" style={{ color: 'var(--color-text)' }}>Return:</span>{' '}
              {profile.return.originCRS} → {profile.return.destinationCRS}{' '}
              at {profile.return.departureTime}
            </p>
            {profile.tflLines && profile.tflLines.length > 0 && (
              <p>
                <span className="font-medium" style={{ color: 'var(--color-text)' }}>TfL:</span>{' '}
                {profile.tflLines.join(', ')}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex gap-2 flex-wrap">
        {!profile.isActive && (
          <button
            onClick={onActivate}
            disabled={isActivating}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 cursor-pointer transition-colors"
            style={{ backgroundColor: 'var(--color-accent)', fontFamily: 'var(--font-display)' }}
          >
            {isActivating ? 'Activating...' : 'Set Active'}
          </button>
        )}
        <button
          onClick={onEdit}
          className="rounded-lg border px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors"
          style={{
            backgroundColor: 'var(--color-bg-card)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text)',
            fontFamily: 'var(--font-display)',
          }}
        >
          Edit
        </button>
        <button
          onClick={onDelete}
          disabled={isDeleting}
          className="rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50 cursor-pointer transition-colors"
          style={{
            backgroundColor: 'var(--color-bg-card)',
            borderColor: 'var(--color-danger)',
            color: 'var(--color-danger)',
            fontFamily: 'var(--font-display)',
          }}
        >
          {isDeleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </div>
  );
}
