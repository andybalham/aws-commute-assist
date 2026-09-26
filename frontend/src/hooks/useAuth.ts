import { useState, useEffect } from 'react';
import { getCurrentUser, signOut, fetchAuthSession } from 'aws-amplify/auth';
import type { AuthUser } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export function useAuth(): AuthState & { handleSignOut: () => Promise<void> } {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  async function checkUser() {
    try {
      const user = await getCurrentUser();
      setState({ user, isLoading: false, isAuthenticated: true });
    } catch {
      setState({ user: null, isLoading: false, isAuthenticated: false });
    }
  }

  useEffect(() => {
    // Fetches auth state from Cognito (an external system) on mount — not derived-state sync.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkUser();

    const hubListener = Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'signedIn') {
        checkUser();
      } else if (payload.event === 'signedOut') {
        setState({ user: null, isLoading: false, isAuthenticated: false });
      }
    });

    return () => hubListener();
  }, []);

  async function handleSignOut() {
    await signOut();
  }

  return { ...state, handleSignOut };
}

export async function getIdToken(): Promise<string | null> {
  try {
    const session = await fetchAuthSession();
    return session.tokens?.idToken?.toString() ?? null;
  } catch {
    return null;
  }
}
