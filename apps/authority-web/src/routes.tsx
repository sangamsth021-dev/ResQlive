/**
 * Authority Workspace Routes
 * Public: Login
 * Protected: Dashboard, Reports, Report Detail, Incidents, Audit, Notifications
 * Route guards enforce authentication and authorization.
 */

import { createBrowserRouter, RouterProvider, NavigationGuard, NavigationGuardNext, RouteLocationNormalized } from 'react-router-dom';
import DashboardLayout from '@/layouts/DashboardLayout';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import ReportsPage from '@/pages/ReportsPage';
import ReportDetailPage from '@/pages/ReportDetailPage';
import IncidentsPage from '@/pages/IncidentsPage';
import AuditPage from '@/pages/AuditPage';
import NotificationsPage from '@/pages/NotificationsPage';
import { AccessDeniedPage } from '@/pages/AccessDeniedPage';
import AccessDeniedPage from '@/pages/AccessDenied';

// ============================================
// Route Guards
// ============================================

/** Authentication required guard */
const requireAuth: NavigationGuard = async (
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  navigate: (to: string) => void
): Promise<boolean> => {
  const { isAuthenticated, user, logout } = useAuth();

  if (!isAuthenticated) {
    logout();
    navigate('/login');
    return false;
  }

  return true;
};

/** Permission required guard */
const requirePermission: (
  permission: string
) => NavigationGuard =
  (permission: string) =>
  async (
    to: RouteLocationNormalized,
    from: RouteLocationNormalized,
    navigate: (to: string) => void
  ): Promise<boolean> => {
    const { isAuthenticated, user, logout } = useAuth();

    if (!isAuthenticated) {
      logout();
      navigate('/login');
      return false;
    }

    if (!user?.permissions?.includes(permission)) {
      logout();
      navigate('/unauthorized');
      return false;
    }

    return true;
  };

// ============================================
// Route Configuration
// ============================================

export const router = createBrowserRouter({
  config: [
    {
      path: '/',
      Component: DashboardLayout,
      children: [
        {
          path: '',
          Component: DashboardPage,
          beforeEnter: requireAuth,
        },
        {
          path: 'reports',
          Component: ReportsPage,
          beforeEnter: [requireAuth, requirePermission('reports.read.scoped')],
        },
        {
          path: 'reports/:reportId',
          Component: ReportDetailPage,
          beforeEnter: [requireAuth, requirePermission('reports.read.scoped')],
        },
        {
          path: 'incidents',
          Component: IncidentsPage,
          beforeEnter: [requireAuth, requirePermission('incidents.read')],
        },
        {
          path: 'audit',
          Component: AuditPage,
          beforeEnter: [requireAuth, requirePermission('audit.read')],
        },
        {
          path: 'notifications',
          Component: NotificationsPage,
          beforeEnter: [requireAuth, requirePermission('notifications.read')],
        },
      ],
    },
    {
      path: '/login',
      Component: LoginPage,
      // Public route — no auth required
    },
    {
      path: '/unauthorized',
      Component: AccessDeniedPage,
      // Explicit unauthorized page
    },
  ],
});

export default function RouterProvider() {
  return <RouterProvider router={router} />;
}