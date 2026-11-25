/**
 * Authority Dashboard Layout
 *
 * Provides the main navigation, sidebar, and layout structure for the authority dashboard.
 * Includes role-based navigation rendering.
 */

import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';

export default function DashboardLayout() {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  if (!isAuthenticated) {
    return null;
  }

  const navItems = [
    { label: 'Dashboard', path: '/', permission: 'incidents.read' },
    { label: 'Reports', path: '/reports', permission: 'reports.read.scoped' },
    { label: 'Incidents', path: '/incidents', permission: 'incidents.read' },
    { label: 'Audit Trail', path: '/audit', permission: 'audit.read' },
    { label: 'Notifications', path: '/notifications', permission: 'notifications.read' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r shadow-sm">
        <div className="p-4 border-b">
          <h1 className="font-bold text-lg text-primary">ResQ Live</h1>
          <p className="text-xs text-gray-500">Authority Workspace</p>
        </div>
        <nav className="p-4 space-y-1">
          {navItems
            .filter(item => user?.permissions?.includes(item.permission))
            .map(item => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="w-full text-left px-3 py-2 rounded text-sm font-medium hover:bg-gray-100"
              >
                {item.label}
              </button>
            ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  );
}