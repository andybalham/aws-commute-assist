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
      className={`rounded-lg border p-4 ${
        profile.isActive ? 'border-blue-400 bg-blue-50/50' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-gray-900 truncate">{profile.name}</h3>
            {profile.isActive && (
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                Active
              </span>
            )}
          </div>

          <div className="mt-2 space-y-1 text-sm text-gray-600">
            <p>
              <span className="font-medium">Outbound:</span>{' '}
              {profile.outbound.originCRS} → {profile.outbound.destinationCRS}{' '}
              at {profile.outbound.departureTime}
            </p>
            <p>
              <span className="font-medium">Return:</span>{' '}
              {profile.return.originCRS} → {profile.return.destinationCRS}{' '}
              at {profile.return.departureTime}
            </p>
            {profile.tflLines && profile.tflLines.length > 0 && (
              <p>
                <span className="font-medium">TfL:</span>{' '}
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
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isActivating ? 'Activating...' : 'Set Active'}
          </button>
        )}
        <button
          onClick={onEdit}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Edit
        </button>
        <button
          onClick={onDelete}
          disabled={isDeleting}
          className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          {isDeleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </div>
  );
}
