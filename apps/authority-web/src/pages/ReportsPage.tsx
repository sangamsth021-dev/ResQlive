/**
 * Authority Workspace Reports Page
 *
 * Displays a paginated, filtered list of reports in the authority queue.
 * Fetches data from the actual backend API. Supports offline-aware status badges
 * and acknowledgment actions.
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'react-router-dom';
import { useApiClient } from '@/api';
import { useFilters } from '@/hooks/use-filters';
import { useNotifications } from '@/hooks/use-notifications';
import { statusBadgeClasses } from '@/components/status-badge';

interface ReportSummary {
  id: string;
  category_code: string;
  severity_code: string;
  status: string;
  priority_code: string;
  reported_at: string;
  reported_location: { lat: number; lon: number } | null;
  authority_acknowledged: boolean;
  assigned_team: string | null;
}

interface ReportsPageProps {
  initialReports?: ReportSummary[];
}

export function ReportsPage({ initialReports }: ReportsPageProps = {}) {
  const { isAuthenticated, user, logout } = useApiClient();
  const { filters, applyFilters, resetFilters, refetch } = useFilters();
  const router = useRouter();

  // State
  const [reports, setReports] = useState<ReportSummary[]>(initialReports || []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  // Load reports from backend
  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    const loadReports = async () => {
      try {
        setLoading(true);
        setError(null);

        const orgId = user?.organization_id;
        if (!orgId) {
          setReports([]);
          setTotal(0);
          setLoading(false);
          return;
        }

        const response = await api.listReports({
          org_id: orgId,
          ...filters,
        });

        if (response.success && response.data) {
          setReports(response.data ?? []);
          setTotal(response.meta?.total ?? response.data.length ?? 0);
        } else {
          throw new Error(response.error?.message || 'Failed to load reports');
        }
      } catch (err: any) {
        setError(err?.detail || 'Failed to load reports');
        setReports([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    };

    loadReports();
  }, [isAuthenticated, user, filters]);

  // Apply filters to local reports when filters change
  const { filtered, totalDisplay } = applyFilters(reports);

  // Handle acknowledgment
  const handleAcknowledge = async (reportId: string) => {
    if (!confirm('Acknowledge this report? This will update the status to "authority_acknowledged" and record the acknowledgment in the audit log.')) {
      return;
    }

    try {
      const response = await api.acknowledgeReport(reportId);

      if (response.success) {
        // Refresh the report list to show updated status
        refetch();
        // Show success
        // TODO: Add toast notification
      } else {
        const message = response.error?.message || 'Failed to acknowledge report';
        setError(message);
        // TODO: Show error toast
      }
    } catch (err: any) {
      const message = err?.message || 'Failed to acknowledge report';
      setError(message);
      // TODO: Show error toast
    }
  };

  // Only show Acknowledge button if user has permission
  const canAcknowledge = user?.permissions?.includes('reports.acknowledge') ?? false;

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
    return null; // Will render login via router guard
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with filters */}
      <div className="bg-white shadow border-b mb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-3">
            <div>
              <h1 className="font-semibold text-lg">Reports</h1>
              <p className="text-sm text-gray-500">Authority queue</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onResetFilters}
                className="hidden sm:flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-500 rounded hover:text-primary hover:bg-primary/5"
                title="Reset filters"
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
                  <path d="M3 11a8 8 0 1 0 8-8 8 8 0 0 0-8 8zm5-3a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm5 7a2 2 0 1 1 0-4 2 2 0 0 1 0 4z" />
                </svg>
                Reset
              </button>

              <button
                onClick={() => logout()}
                className="hidden sm:flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 rounded hover:text-primary hover:bg-primary/5"
                title="Logout"
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
      </div>

      {/* Filters Panel */}
      <div className="bg-white rounded-lg shadow mb-4 p-4">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              onChange={(e) => onFilterChange({ category_codes: [e.target.value] })}
              className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-primary"
            >
              <option value="">All categories</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
            <select
              onChange={(e) => onFilterChange({ severity_codes: [e.target.value] })}
              className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-primary"
            >
              <option value="">All severities</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              onChange={(e) => onFilterChange({ status_codes: [e.target.value] })}
              className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-primary"
            >
              <option value="">All statuses</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
            <select
              onChange={(e) => onFilterChange({ priority_codes: [e.target.value] })}
              className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-primary"
            >
              <option value="">All priorities</option>
            </select>
          </div>
        </div>

        {/* Date range and search */}
        <div className="grid grid-cols-2 gap-4 mt-4 md:grid-cols-1">
          <div>
            <label className="block text-xs text-gray-500 mb-1">From</label>
            <input
              type="date"
              onChange={(e) => onFilterChange({ date_from: e.target.value })}
              className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">To</label>
            <input
              type="date"
              onChange={(e) => onFilterChange({ date_to: e.target.value })}
              className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Search</label>
            <input
              type="text"
              onChange={(e) => onFilterChange({ search_query: e.target.value })}
              placeholder="Search reports, categories, or IDs..."
              className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* Reports List */}
      <div className="bg-white rounded-lg shadow p-4">
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <span>Loading reports...</span>
          </div>
        ) : reports.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-gray-500">
            No reports found matching your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="p-3 border-b text-left text-xs font-medium text-gray-500">Report ID</th>
                  <th className="p-3 border-b text-left text-xs font-medium text-gray-500">Category</th>
                  <th className="p-3 border-b text-left text-xs font-medium text-gray-500">Severity</th>
                  <th className="p-3 border-b text-left text-xs font-medium text-gray-500">Status</th>
                  <th className="p-3 border-b text-left text-xs font-medium text-gray-500">Priority</th>
                  <th className="p-3 border-b text-left text-xs font-medium text-gray-500">Reported</th>
                  <th className="p-3 border-b text-left text-xs font-medium text-gray-500">Location</th>
                  <th className="p-3 border-b text-left text-xs font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((report) => (
                  <tr key={report.id} className="border-b transition-colors hover:bg-gray-50">
                    <td className="p-3 font-medium">
                      <a
                        href={`/reports/${report.id}`}
                        className="underline text-primary hover:text-primary/90"
                      >
                        {report.id.substring(0, 8)}...
                      </a>
                    </td>
                    <td className="p-3">{report.category_code}</td>
                    <td className="p-3">
                      <span
                        className={statusBadgeClasses(report.severity_code)}
                      >
                        {report.severity_code}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={statusBadgeClasses(report.status)}
                      >
                        {report.status}
                      </span>
                    </td>
                    <td className="p-3">{report.priority_code}</td>
                    <td className="p-3">
                      {new Date(report.reported_at).toLocaleString()}
                    </td>
                    <td className="p-3">
                      {report.reported_location
                        ? `${report.reported_location.lat.toFixed(4)}, ${report.reported_location.lon.toFixed(4)}`
                        : '—'}
                    </td>
                    <td className="p-3">
                      {report.authority_acknowledged ? (
                        <span className="text-green-600 font-medium">Acknowledged</span>
                      ) : (
                        canAcknowledge && (
                          <button
                            onClick={() => handleAcknowledge(report.id)}
                            className="text-primary hover:text-primary/90 text-sm"
                            title="Acknowledge report"
                          >
                            Acknowledge
                          </button>
                        ))
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {totalDisplay > filters.page_size && (
              <div className="mt-4 flex justify-between text-sm text-gray-500">
                <span>Showing {filtered.length} of {totalDisplay} reports</span>
                {/* TODO: Add pagination controls */}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}