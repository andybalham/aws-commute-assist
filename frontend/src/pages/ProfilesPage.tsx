import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchProfiles,
  createProfile,
  updateProfile,
  deleteProfile,
  activateProfile,
} from '../api/profilesApi';
import type { CommuteProfile } from '../api/types';
import { ProfileCard } from '../components/ProfileCard';
import { ProfileForm } from '../components/ProfileForm';

type FormMode = { type: 'closed' } | { type: 'create' } | { type: 'edit'; profile: CommuteProfile };

export function ProfilesPage() {
  const queryClient = useQueryClient();
  const [formMode, setFormMode] = useState<FormMode>({ type: 'closed' });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const profilesQuery = useQuery({
    queryKey: ['profiles'],
    queryFn: fetchProfiles,
  });

  const createMutation = useMutation({
    mutationFn: createProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      setFormMode({ type: 'closed' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ profileId, data }: { profileId: string; data: Parameters<typeof updateProfile>[1] }) =>
      updateProfile(profileId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      setFormMode({ type: 'closed' });
    },
  });

  const activateMutation = useMutation({
    mutationFn: activateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      setDeleteConfirm(null);
    },
  });

  function handleFormSubmit(data: { name: string; outbound: { originCRS: string; destinationCRS: string; departureTime: string }; return: { originCRS: string; destinationCRS: string; departureTime: string }; tflLines: string[] }) {
    const payload = { ...data, isActive: false };
    if (formMode.type === 'edit') {
      updateMutation.mutate({ profileId: formMode.profile.profileId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function handleDelete(profileId: string) {
    if (deleteConfirm === profileId) {
      deleteMutation.mutate(profileId);
    } else {
      setDeleteConfirm(profileId);
    }
  }

  const profiles = profilesQuery.data ?? [];
  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error || updateMutation.error;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1
          className="text-2xl font-bold"
          style={{ color: 'var(--color-text)', fontFamily: 'var(--font-display)' }}
        >
          Profiles
        </h1>
        {formMode.type === 'closed' && (
          <button
            onClick={() => setFormMode({ type: 'create' })}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white cursor-pointer transition-colors"
            style={{
              backgroundColor: 'var(--color-accent)',
              fontFamily: 'var(--font-display)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-accent-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-accent)')}
          >
            New Profile
          </button>
        )}
      </div>

      {/* Form */}
      {formMode.type !== 'closed' && (
        <div
          className="mb-6 rounded-xl border p-5"
          style={{
            backgroundColor: 'var(--color-bg-card)',
            borderColor: 'var(--color-border-subtle)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <h2
            className="text-lg font-semibold mb-4"
            style={{ color: 'var(--color-text)', fontFamily: 'var(--font-display)' }}
          >
            {formMode.type === 'create' ? 'Create Profile' : 'Edit Profile'}
          </h2>
          {mutationError && (
            <div
              className="mb-4 rounded-lg border p-3 text-sm"
              style={{
                backgroundColor: 'var(--color-danger-soft)',
                borderColor: 'var(--color-danger)',
                color: 'var(--color-danger)',
              }}
            >
              {mutationError instanceof Error ? mutationError.message : 'Failed to save profile'}
            </div>
          )}
          <ProfileForm
            profile={formMode.type === 'edit' ? formMode.profile : undefined}
            onSubmit={handleFormSubmit}
            onCancel={() => setFormMode({ type: 'closed' })}
            isSubmitting={isSubmitting}
          />
        </div>
      )}

      {/* Loading */}
      {profilesQuery.isLoading && (
        <div
          className="rounded-xl border p-8 text-center"
          style={{
            backgroundColor: 'var(--color-bg-card)',
            borderColor: 'var(--color-border-subtle)',
          }}
        >
          <p style={{ color: 'var(--color-text-muted)' }}>Loading profiles...</p>
        </div>
      )}

      {/* Error */}
      {profilesQuery.isError && (
        <div
          className="rounded-lg border p-4 text-sm"
          style={{
            backgroundColor: 'var(--color-danger-soft)',
            borderColor: 'var(--color-danger)',
            color: 'var(--color-danger)',
          }}
        >
          Failed to load profiles.{' '}
          <button
            onClick={() => profilesQuery.refetch()}
            className="underline opacity-80 hover:opacity-100 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {profilesQuery.isSuccess && profiles.length === 0 && (
        <div
          className="rounded-xl border p-8 text-center"
          style={{
            backgroundColor: 'var(--color-bg-card)',
            borderColor: 'var(--color-border-subtle)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <p style={{ color: 'var(--color-text-muted)' }}>No commute profiles yet.</p>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Create a profile to get started.</p>
        </div>
      )}

      {/* Profile list */}
      {profiles.length > 0 && (
        <div className="space-y-3">
          {profiles.map((p) => (
            <div key={p.profileId}>
              <ProfileCard
                profile={p}
                onActivate={() => activateMutation.mutate(p.profileId)}
                onEdit={() => setFormMode({ type: 'edit', profile: p })}
                onDelete={() => handleDelete(p.profileId)}
                isActivating={activateMutation.isPending && activateMutation.variables === p.profileId}
                isDeleting={deleteMutation.isPending && deleteMutation.variables === p.profileId}
              />
              {deleteConfirm === p.profileId && !deleteMutation.isPending && (
                <div className="mt-1 ml-4 text-sm" style={{ color: 'var(--color-danger)' }}>
                  Click Delete again to confirm, or{' '}
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="underline opacity-80 hover:opacity-100 cursor-pointer"
                  >
                    cancel
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
