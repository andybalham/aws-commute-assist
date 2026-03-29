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
        <h1 className="text-2xl font-bold text-gray-900">Profiles</h1>
        {formMode.type === 'closed' && (
          <button
            onClick={() => setFormMode({ type: 'create' })}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            New Profile
          </button>
        )}
      </div>

      {/* Form */}
      {formMode.type !== 'closed' && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {formMode.type === 'create' ? 'Create Profile' : 'Edit Profile'}
          </h2>
          {mutationError && (
            <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
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
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-gray-500">Loading profiles...</p>
        </div>
      )}

      {/* Error */}
      {profilesQuery.isError && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          Failed to load profiles.{' '}
          <button
            onClick={() => profilesQuery.refetch()}
            className="underline hover:text-red-900"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {profilesQuery.isSuccess && profiles.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-gray-500">No commute profiles yet.</p>
          <p className="text-sm text-gray-400 mt-1">Create a profile to get started.</p>
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
                <div className="mt-1 ml-4 text-sm text-red-600">
                  Click Delete again to confirm, or{' '}
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="underline hover:text-red-800"
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
