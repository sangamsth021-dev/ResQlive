/**
 * Authority Workspace Access Denied Page
 *
 * Displayed when a user attempts to access a route or perform an action
 * without proper authorization. Shows a clear message and provides options
 * to return to the dashboard or re-authenticate.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';

export function AccessDeniedPage() {
  const { isAuthenticated, logout, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Auto-logout after a few seconds if still authenticated but unauthorized
    const timeout = setTimeout(() => {
      logout();
      navigate('/login');
    }, 5000);
    return () => clearTimeout(timeout);
  }, [isAuthenticated, logout, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
      <div className="bg-white rounded-lg shadow p-8 max-w-md w-full text-center">
        <div className="h-12 w-12 rounded-md bg-red-100 flex items-center justify-center mb-6">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 text-red-600"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="18" cy="5" r="1" />
            <circle cx="18" cy="12" r="1" />
            <circle cx="18" cy="19" r="1" />
            <path
              d="M6 18l6-6 6 6"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
            />
          </svg>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Access Denied
        </h2>
        <p className="text-gray-600 mb-6">
          You don't have permission to access this resource or perform this action.
        </p>

        <div className="mb-6">
          <p className="text-sm text-gray-500 mb-2">
            Your role: <span className="font-medium">{user?.role || 'unknown'}</span>
          </p>
          <p className="text-xs text-gray-400">
            Required permission not granted for your role.
          </p>
        </div>

        <button
          onClick={() => navigate('/')}
          className="w-full py-2 px-4 bg-primary text-white rounded hover:bg-primary/90 text-sm font-medium"
          title="Return to dashboard"
        >
          Return to Dashboard
        </button>

        <button
          onClick={() => {
            logout();
            navigate('/login');
          }}
          className="w-full py-2 px-4 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm font-medium mt-2"
          title="Login again"
        >
          Login Again
        </button>
      </div>
    </div>
  );
}