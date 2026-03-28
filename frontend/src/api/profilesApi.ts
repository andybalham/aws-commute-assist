import apiClient from './apiClient';
import type { CommuteProfile, StationMatch } from './types';

export async function fetchProfiles(): Promise<CommuteProfile[]> {
  const { data } = await apiClient.get<CommuteProfile[]>('/api/profiles');
  return data;
}

export async function createProfile(
  profile: Omit<CommuteProfile, 'userId' | 'profileId' | 'createdAt' | 'updatedAt'>,
): Promise<CommuteProfile> {
  const { data } = await apiClient.post<CommuteProfile>('/api/profiles', profile);
  return data;
}

export async function updateProfile(
  profileId: string,
  profile: Omit<CommuteProfile, 'userId' | 'profileId' | 'createdAt' | 'updatedAt'>,
): Promise<CommuteProfile> {
  const { data } = await apiClient.put<CommuteProfile>(`/api/profiles/${profileId}`, profile);
  return data;
}

export async function deleteProfile(profileId: string): Promise<void> {
  await apiClient.delete(`/api/profiles/${profileId}`);
}

export async function activateProfile(profileId: string): Promise<void> {
  await apiClient.patch(`/api/profiles/${profileId}/activate`);
}

export async function searchStations(query: string): Promise<StationMatch[]> {
  const { data } = await apiClient.get<StationMatch[]>('/api/stations', {
    params: { q: query },
  });
  return data;
}
