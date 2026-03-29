/**
 * Playwright global setup — runs once before the entire test suite.
 * Deletes all profiles via the backend API so tests start from a clean state.
 */

const API_URL = 'http://localhost:3001';

async function globalSetup() {
  // Fetch all existing profiles
  const res = await fetch(`${API_URL}/api/profiles`);
  if (!res.ok) {
    throw new Error(`Failed to list profiles (${res.status}). Is the backend running?`);
  }

  const profiles: { profileId: string }[] = await res.json();

  // Delete each one
  for (const profile of profiles) {
    const del = await fetch(`${API_URL}/api/profiles/${profile.profileId}`, {
      method: 'DELETE',
    });
    if (!del.ok) {
      console.warn(`Warning: failed to delete profile ${profile.profileId} (${del.status})`);
    }
  }

  if (profiles.length > 0) {
    console.log(`Global setup: deleted ${profiles.length} leftover profile(s)`);
  }
}

export default globalSetup;
