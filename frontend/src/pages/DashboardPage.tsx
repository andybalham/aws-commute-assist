function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <h2 className="text-base font-semibold text-gray-900 mb-3">{title}</h2>
      {children}
    </div>
  );
}

export function DashboardPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Select an active profile in Profiles to see your commute data.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <SectionCard title="Rail Departures">
          <p className="text-sm text-gray-400">No data yet</p>
        </SectionCard>

        <SectionCard title="Weather">
          <p className="text-sm text-gray-400">No data yet</p>
        </SectionCard>

        <SectionCard title="TfL Status">
          <p className="text-sm text-gray-400">No data yet</p>
        </SectionCard>
      </div>
    </div>
  );
}
