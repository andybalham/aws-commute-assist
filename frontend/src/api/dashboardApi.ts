import apiClient from './apiClient';
import type { DashboardResponse } from './types';

export async function fetchDashboard(): Promise<DashboardResponse> {
  const { data } = await apiClient.get<DashboardResponse>('/api/dashboard');
  return data;
}
