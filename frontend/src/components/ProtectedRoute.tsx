import { useEffect } from 'react';
import { signInWithRedirect } from 'aws-amplify/auth';
import { useAuth } from '../hooks/useAuth';

const DEV_BYPASS_AUTH = import.meta.env.VITE_DEV_BYPASS_AUTH === 'true';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!DEV_BYPASS_AUTH && !isLoading && !isAuthenticated) {
      signInWithRedirect();
    }
  }, [isLoading, isAuthenticated]);

  if (DEV_BYPASS_AUTH) {
    return <>{children}</>;
  }

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">
          {isLoading ? 'Loading...' : 'Redirecting to login...'}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
