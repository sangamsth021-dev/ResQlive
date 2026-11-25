/**
 * Authority Workspace Notifications Page
 *
 * Displays notifications received by the authority workspace including
 * push notifications, SMS, email, and in-app notifications. Fetches
 * actual notifications from the backend API. Provides filtering,
 * acknowledgment, and delivery status information.
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'react-router-dom';
import { useApiClient } from '@/api';
import { useFilters } from '@/hooks/use-filters';
import { useNotifications } from '@/hooks/use-notifications';
import { statusBadgeClasses } from '@/components/status-badge';

interface NotificationSummary {
  id: string;
  channel: string;
  status: string;
  related_type: string;
  related_id: string;
  title: string;
  message: string;
  created_at: string;
  read: boolean;
}

interface NotificationsPageProps {
  initialNotifications?: NotificationSummary[];
}

export function NotificationsPage({ initialNotifications }: NotificationsPageProps = {}) {
  const { isAuthenticated, user, logout } = useApiClient();
  const { filters, applyFilters, resetFilters, refetch } = useFilters();
  const router = useRouter();

  // State
  const [notifications, setNotifications] = useState<NotificationSummary[]>(
    initialNotifications || []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  // Load notifications from backend
  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    const loadNotifications = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await api.listNotifications({
          org_id: user?.organization_id,
          page: 1,
          page_size: 50,
        });

        if (response.success && response.data) {
          setNotifications(response.data ?? []);
          setTotal(response.meta?.total ?? response.data.length ?? 0);
        } else {
          throw new Error(response.error?.message || 'Failed to load notifications');
        }
      } catch (err: any) {
        setError(err?.detail || 'Failed to load notifications');
        setNotifications([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    };

    loadNotifications();
  }, [isAuthenticated, user]);

  // Apply filters to local notifications when filters change
  const { filtered, totalDisplay } = applyFiltersNotifications(notifications);

  // Apply filters specific to notifications
  function applyFiltersNotifications(notifications: NotificationSummary[]) {
    let filtered = [...notifications];

    // Filter by channel
    if (filters.category_codes?.length) {
      filtered = filtered.filter(
        (not) => not.channel === 'in_app' || not.channel === 'push'
      );
    }

    // Filter by status (read/unread)
    if (filters.severity_codes?.length) {
      filtered = filtered.filter(
        (not) => filters.severity_codes.includes(not.read ? 'read' : 'unread')
      );
    }

    // Search query
    if (filters.search_query) {
      const query = filters.search_query.toLowerCase();
      filtered = filtered.filter(
        (not) =>
          not.title.toLowerCase().includes(query) ||
          not.message.toLowerCase().includes(query) ||
          not.related_id.toLowerCase().includes(query)
      );
    }

    return { filtered, totalDisplay: filtered.length };
  }

  // Handle mark as read
  const handleMarkAsRead = async (notifId: string) => {
    try {
      const response = await api.markNotificationRead(notifId);

      if (response.success) {
        // Refresh the notification list
        refetch();
      } else {
        const message = response.error?.message || 'Failed to mark notification as read';
        setError(message);
      }
    } catch (err) {
      // Silently fail — notification read state is best-effort
    }
  };

  // Handle clear all
  const handleClearAll = async () => {
    try {
      const response = await api.clearNotifications();

      if (response.success) {
        refetch();
      } else {
        const message = response.error?.message || 'Failed to clear notifications';
        setError(message);
      }
    } catch (err) {
      // Silently fail
    }
  };

  // Handle filter changes
  const onFilterChange = useCallback(
    (partialFilters: Partial<ReportFilters>) => {
      setFilters(partialFilters);
    },
    [setFilters]
  );

  // Handle reset
  const onResetFilters = useCallback(() => {
    resetFilters();
    refetch();
  }, [resetFilters, refetch]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow border-b mb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between py-3">
            <div>
              <h1 className="font-semibold text-lg">Notifications</h1>
              <p className="text-sm text-gray-500">System notifications</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onResetFilters}
                className="hidden sm:flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-500 rounded hover:text-primary hover:bg-primary/5"
                title="Reset filters"
              >
                Reset
              </button>

              <button
                onClick={handleClearAll}
                className="hidden sm:flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 rounded hover:text-primary hover:bg-primary/5"
                title="Clear all"
              >
                Clear All
              </button>

              <button
                onClick={() => logout()}
                className="hidden sm:flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 rounded hover:text-primary hover:bg-primary/5"
                title="Logout"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      <div className="bg-white rounded-lg shadow mb-4 p-4">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Channel</label>
            <select
              onChange={(e) => onFilterChange({ category_codes: [e.target.value] })}
              className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-primary"
            >
              <option value="">All channels</option>
              <option value="in_app">In-app</option>
              <option value="push">Push</option>
              <option value="sms">SMS</option>
              <option value="email">Email</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              onChange={(e) => onFilterChange({ severity_codes: [e.target.value] })}
              className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-primary"
            >
              <option value="">All statuses</option>
              <option value="unread">Unread</option>
              <option value="read">Read</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Related</label>
            <select
              onChange={(e) => onFilterChange({ priority_codes: [e.target.value] })}
              className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-primary"
            >
              <option value="">All related</option>
              <option value="REPORT">Report</option>
              <option value="INCIDENT">Incident</option>
              <option value="ASSIGNMENT">Assignment</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              onChange={(e) => onFilterChange({ search_query: e.target.value })}
              placeholder="Search notifications..."
              className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="bg-white rounded-lg shadow p-4">
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <span>Loading notifications...</span>
          </div>
        ) : notifications.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-gray-500">
            No notifications found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="p-3 border-b text-left text-xs font-medium text-gray-500">Title</th>
                  <th className="p-3 border-b text-left text-xs font-medium text-gray-500">Channel</th>
                  <th className="p-3 border-b text-left text-xs font-medium text-gray-500">Status</th>
                  <th className="p-3 border-b text-left text-xs font-medium text-gray-500">When</th>
                  <th className="p-3 border-b text-left text-xs font-medium text-gray-500">Related</th>
                  <th className="p-3 border-b text-left text-xs font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((notif) => (
                  <tr
                    key={notif.id}
                    className="border-b transition-colors hover:bg-gray-50"
                    style={{ backgroundColor: notif.read ? 'transparent' : 'rgba(251, 191, 36, 0.1)' }}
                  >
                    <td className="p-3 font-medium">
                      {notif.title}
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center text-xs py-0.5 px-2 rounded ${
                          notif.channel === 'in_app'
                            ? 'bg-gray-100 text-gray-800'
                            : notif.channel === 'push'
                            ? 'bg-blue-100 text-blue-800'
                            : notif.channel === 'sms'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {notif.channel}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={statusBadgeClasses(notif.status)}
                      >
                        {notif.status}
                      </span>
                    </td>
                    <td className="p-3 text-sm text-gray-500">
                      {new Date(notif.created_at).toLocaleString()}
                    </td>
                    <td className="p-3 text-sm text-gray-500">
                      {notif.related_type}: {notif.related_id.substring(0, 8)}...
                    </td>
                    <td className="p-3">
                      {!notif.read && (
                        <button
                          onClick={() => handleMarkAsRead(notif.id)}
                          className="text-primary hover:text-primary/90 text-sm underline"
                          title="Mark as read"
                        >
                          Mark Read
                        </button>
                      )}
                      {notif.read && (
                        <span className="text-gray-400 text-sm">Read</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Summary */}
            <div className="mt-4 pt-4 border-t text-xs text-gray-500">
              <span>
                {filtered.length} of {totalDisplay} notifications{' '}
                {filtered.length < totalDisplay && (
                  <span className="ml-2 text-blue-600 cursor-pointer">
                    {totalDisplay - filtered.length} more
                  </span>
                )}
              </span>
              <span className="ml-4">
                {filtered.filter((n) => !n.read).length} unread
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}