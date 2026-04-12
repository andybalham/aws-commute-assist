import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchDashboard } from '../api/dashboardApi';
import { fetchProfiles, activateProfile } from '../api/profilesApi';
import type {
  WeatherSummary,
  TflLineSummary,
  RailSource,
} from '../api/types';
import { DashboardHeader } from '../components/dashboard/DashboardHeader';
import { EmptyState } from '../components/dashboard/EmptyState';
import { RailSection } from '../components/dashboard/RailSection';
import { WeatherSection } from '../components/dashboard/WeatherSection';
import { TflSection } from '../components/dashboard/TflSection';
import {
  SectionCard,
  RailSkeleton,
  WeatherSkeleton,
  TflSkeleton,
} from '../components/dashboard/SectionCard';
import { unwrap } from '../components/dashboard/sectionHelpers';

export function DashboardPage() {
  const queryClient = useQueryClient();

  const profilesQuery = useQuery({
    queryKey: ['profiles'],
    queryFn: fetchProfiles,
  });

  const dashboardQuery = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    retry: false,
  });

  const activateMutation = useMutation({
    mutationFn: activateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const profiles = profilesQuery.data ?? [];
  const dashboard = dashboardQuery.data;
  const hasActiveProfile = profiles.some((p) => p.isActive);
  const isLoading = dashboardQuery.isLoading && hasActiveProfile;
  const hasError = dashboardQuery.isError && hasActiveProfile;

  function handleRefresh() {
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  }

  function handleSwitchProfile(profileId: string) {
    activateMutation.mutate(profileId);
  }

  if (!hasActiveProfile && !isLoading) {
    return <EmptyState />;
  }

  return (
    <div>
      <DashboardHeader
        dashboard={dashboard}
        profiles={profiles}
        isFetching={dashboardQuery.isFetching}
        isSwitching={activateMutation.isPending}
        onRefresh={handleRefresh}
        onSwitchProfile={handleSwitchProfile}
      />

      {isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <SectionCard title="Rail Departures">
            <RailSkeleton />
          </SectionCard>
          <SectionCard title="Weather">
            <WeatherSkeleton />
          </SectionCard>
          <SectionCard title="TfL Status">
            <TflSkeleton />
          </SectionCard>
        </div>
      )}

      {hasError && !dashboard && (
        <div
          className="rounded-lg border p-4 text-sm"
          style={{
            backgroundColor: 'var(--color-danger-soft)',
            borderColor: 'var(--color-danger)',
            color: 'var(--color-danger)',
          }}
        >
          Failed to load dashboard data.{' '}
          <button onClick={handleRefresh} className="underline opacity-80 hover:opacity-100 cursor-pointer">
            Retry
          </button>
        </div>
      )}

      {dashboard && (() => {
        const srcs = dashboard.sources;
        const outbound = unwrap<RailSource>(srcs, 'rail.outbound');
        const returnSrc = unwrap<RailSource>(srcs, 'rail.return');
        const weatherOrigin = unwrap<WeatherSummary>(srcs, 'weather.outboundOrigin');
        const weatherDest = unwrap<WeatherSummary>(srcs, 'weather.destination');
        const weatherReturn = unwrap<WeatherSummary>(srcs, 'weather.returnDestination');
        const tfl = unwrap<TflLineSummary[]>(srcs, 'tfl');
        const hasTfl = srcs['tfl'] !== undefined;

        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <SectionCard title="Rail Departures">
                <RailSection
                  outbound={outbound}
                  returnSrc={returnSrc}
                  profile={profiles.find((p) => p.profileId === dashboard.profile.profileId)}
                  onRetry={handleRefresh}
                />
              </SectionCard>
            </div>

            <div className="space-y-4">
              <SectionCard title="Weather">
                <WeatherSection
                  outboundOrigin={weatherOrigin}
                  destination={weatherDest}
                  returnDestination={weatherReturn}
                  onRetry={handleRefresh}
                />
              </SectionCard>

              {hasTfl && (
                <SectionCard title="TfL Status">
                  <TflSection tfl={tfl} onRetry={handleRefresh} />
                </SectionCard>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
