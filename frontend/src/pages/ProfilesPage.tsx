export function ProfilesPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Profiles</h1>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <p className="text-gray-500">No commute profiles yet.</p>
        <p className="text-sm text-gray-400 mt-1">
          Create a profile to get started.
        </p>
      </div>
    </div>
  );
}
