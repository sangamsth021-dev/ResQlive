/**
 * Authority Workspace Main Application
 * - Login flow with JWT authentication
 * - Scoped report queue with filters
 * - Report detail view with evidence viewer
 * - Acknowledgment actions
 * - Audit timeline
 */

import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { useFilters } from '@/hooks/use-filters';
import { useNotifications } from '@/hooks/use-notifications';

export default function App() {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  // Show login if not authenticated
  if (!isAuthenticated) {
    return import('./pages/Login').then((mod) => mod.default);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-primary flex items-center justify-center">
                <span className="text-xl font-bold text-white">RQ</span>
              </div>
              <div>
                <h1 className="font-semibold text-lg">ResQ Live</h1>
                <p className="text-sm text-gray-500">Authority Workspace</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 truncate max-w-xs">
                {user?.display_name || user?.email || 'Operator'}
              </span>
              <button
                onClick={() => import('@/api/auth/logout').then((m) => m.logout())}
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 rounded hover:text-primary hover:bg-primary/5"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>

      {/* Flash messages / toasts */}
      <div className="fixed bottom-4 right-4 z-50">
        {/* Placeholder for toast notifications */}
      </div>
    </div>
  );
}