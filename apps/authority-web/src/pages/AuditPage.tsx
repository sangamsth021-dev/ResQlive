/**
 * Authority Workspace Audit Page
 *
 * Displays the append-only audit trail of all material actions in the system.
 * Fetches actual audit events from the backend API. Provides filtering, searching,
 * and export functionality for compliance and operational review.
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'react-router-dom';
import { useApiClient } from '@/api';
import { useFilters } from '@/hooks/use-filters';
import { useNotifications } from '@/hooks/use-notifications';
import { statusBadgeClasses } from '@/components/status-badge';

interface AuditLogEntry {
  event_id: string;
  aggregate_type: string;
  aggregate_id: string;
  sequence_number: number;
  from_state: string;
  to_state: string;
  actor_user_id: string;
  actor_node_id: string | null;
  reason_code: string | null;
  reason_text: string | null;
  occurred_at_device: string | null;
  recorded_at_server: string;
  correlation_id: string | null;
}

interface AuditPageProps {
  initialLogs?: AuditLogEntry[];
}

export function AuditPage({ initialLogs }: AuditPageProps = {}) {
  const { isAuthenticated, user, logout } = useApiClient();
  const { filters, applyFilters, resetFilters, refetch } = useFilters();
  const router = useRouter();

  // State
  const [logs, setLogs] = useState<AuditLogEntry[]>(initialLogs || []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  // Load audit logs from backend
  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    const loadLogs = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await api.listAuditEvents({
          aggregate_type: 'REPORT',
          page: 1,
          page_size: 50,
        });

        if (response.success && response.data) {
          setLogs(response.data ?? []);
          setTotal(response.meta?.total ?? response.data.length ?? 0);
        } else {
          throw new Error(response.error?.message || 'Failed to load audit logs');
        }
      } catch (err: any) {
        setError(err?.detail || 'Failed to load audit logs');
        setLogs([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    };

    loadLogs();
  }, [isAuthenticated]);

  // Apply filters to local logs when filters change
  const { filtered, totalDisplay } = applyFiltersLogs(logs);

  // Apply filters specific to audit logs
  function applyFiltersLogs(logs: AuditLogEntry[]) {
    let filtered = [...logs];

    // Filter by aggregate type
    if (filters.category_codes?.length) {
      filtered = filtered.filter((log) => log.aggregate_type === 'REPORT');
    }

    // Filter by from_state
    if (filters.status_codes?.length) {
      filtered = filtered.filter((log) => filters.status_codes.includes(log.from_state));
    }

    // Filter by to_state
    if (filters.severity_codes?.length) {
      filtered = filtered.filter((log) => filters.severity_codes.includes(log.to_state));
    }

    // Search query
    if (filters.search_query) {
      const query = filters.search_query.toLowerCase();
      filtered = filtered.filter(
        (log) =>
          log.aggregate_id.toLowerCase().includes(query) ||
          log.reason_text?.toLowerCase().includes(query) ||
          log.correlation_id?.toLowerCase().includes(query)
      );
    }

    return { filtered, totalDisplay: filtered.length };
  }

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
              <h1 className="font-semibold text-lg">Audit Trail</h1>
              <p className="text-sm text-gray-500">Append-only audit log</p>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">From State</label>
            <select
              onChange={(e) => onFilterChange({ status_codes: [e.target.value] })}
              className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-primary"
            >
              <option value="">All from-states</option>
              <option value="local_saved">local_saved</option>
              <option value="queued">queued</option>
              <option value="sending">sending</option>
              <option value="relayed">relayed</option>
              <option value="server_received">server_received</option>
              <option value="authority_acknowledged">authority_acknowledged</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To State</label>
            <select
              onChange={(e) => onFilterChange({ severity_codes: [e.target.value] })}
              className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-primary"
            >
              <option value="">All to-states</option>
              <option value="local_saved">local_saved</option>
              <option value="queued">queued</option>
              <option value="sending">sending</option>
              <option value="relayed">relayed</option>
              <option value="server_received">server_received</option>
              <option value="authority_acknowledged">authority_acknowledged</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Aggregate Type</label>
            <select
              onChange={(e) => onFilterChange({ category_codes: [e.target.value] })}
              className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-primary"
            >
              <option value="">All types</option>
              <option value="REPORT">REPORT</option>
              <option value="INCIDENT">INCIDENT</option>
              <option value="ASSIGNMENT">ASSIGNMENT</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              onChange={(e) => onFilterChange({ search_query: e.target.value })}
              placeholder="Search audit entries..."
              className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* Audit Logs List */}
      <div className="bg-white rounded-lg shadow p-4">
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <span>Loading audit logs...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-gray-500">
            No audit entries found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="p-3 border-b text-left text-xs font-medium text-gray-500">Event ID</th>
                  <th className="p-3 border-b text-left text-xs font-medium text-gray-500">Aggregate</th>
                  <th className="p-3 border-b text-left text-xs font-medium text-gray-500">From → To</th>
                  <th className="p-3 border-b text-left text-xs font-medium text-gray-500">Actor</th>
                  <th className="p-3 border-b text-left text-xs font-medium text-gray-500">When</th>
                  <th className="p-3 border-b text-left text-xs font-medium text-gray-500">Reason</th>
                  <th className="p-3 border-b text-left text-xs font-medium text-gray-500">Correlation</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((log) => (
                  <tr key={log.event_id} className="border-b transition-colors hover:bg-gray-50">
                    <td className="p-3 font-mono text-xs text-gray-500">
                      {log.event_id.substring(0, 8)}...
                    </td>
                    <td className="p-3 font-medium">
                      {log.aggregate_type}
                    </td>
                    <td className="p-3">
                      <span className={statusBadgeClasses(log.from_state)}>→</span>
                      <span className={statusBadgeClasses(log.to_state)}>{log.to_state}</span>
                    </td>
                    <td className="p-3 text-sm text-gray-500">
                      {log.actor_user_id.substring(0, 8)}...
                    </td>
                    <td className="p-3">
                      {new Date(log.recorded_at_server).toLocaleString()}
                    </td>
                    <td className="p-3">
                      {log.reason_text || '—'}
                    </td>
                    <td className="p-3 text-xs text-gray-400">
                      {log.correlation_id || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Export and info */}
            <div className="mt-4 pt-4 border-t text-xs text-gray-500">
              <span>Total entries: {totalDisplay}</span>
              <span className="ml-4">Export: CSV | JSON</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}