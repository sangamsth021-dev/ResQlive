/**
 * Authority Workspace Incidents Page
 *
 * Displays a list of incidents in the authority workspace with filtering and
 * report linking capabilities. Fetches data from the actual backend API.
 * Shows incident status, linked reports, and assignment information.
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'react-router-dom';
import { useApiClient } from '@/api';
import { useFilters } from '@/hooks/use-filters';
import { useNotifications } from '@/hooks/use-notifications';
import { statusBadgeClasses } from '@/components/status-badge';

interface IncidentSummary {
  id: string;
  priority_code: string;
  status: string;
  title: string | null;
  reported_at: string;
  report_count: number;
  authority_acknowledged: boolean;
}

interface IncidentsPageProps {
  initialIncidents?: IncidentSummary[];
}

export function IncidentsPage({ initialIncidents }: IncidentsPageProps = {}) {
  const { isAuthenticated, user, logout } = useApiClient();
  const { filters, applyFilters, resetFilters, refetch } = useFilters();
  const router = useRouter();

  // State
  const [incidents, setIncidents] = useState<IncidentSummary[]>(initialIncidents || []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  // Load incidents from backend
  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    const loadIncidents = async () => {
      try {
        setLoading(true);
        setError(null);

        const orgId = user?.organization_id;
        if (!orgId) {
          setIncidents([]);
          setTotal(0);
          setLoading(false);
          return;
        }

        const response = await api.listIncidents({
          org_id: orgId,
          ...filters,
        });

        if (response.success && response.data) {
          setIncidents(response.data ?? []);
          setTotal(response.meta?.total ?? response.data.length ?? 0);
        } else {
          throw new Error(response.error?.message || 'Failed to load incidents');
        }
      } catch (err: any) {
        setError(err?.detail || 'Failed to load incidents');
        setIncidents([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    };

    loadIncidents();
  }, [isAuthenticated, user, filters]);

  // Apply filters to local incidents when filters change
  const { filtered, totalDisplay } = applyFilters(incidents);

  // Handle report linking
  const handleLinkReport = async (incidentId: string, reportId: string) => {
    if (!confirm(`Link report ${reportId} to incident ${incidentId}?`)) {
      return;
    }

    try {
      // Use the API client's post method for linking reports
      const response = await api.post(`/incidents/${incidentId}/link`, {
        report_id: reportId
      });

      if (response.success) {
        showToast('Report linked to incident successfully', 'success');
        refetch();
      } else {
        const message = response.error?.message || 'Failed to link report';
        setError(message);
        showToast(message, 'error');
      }
    } catch (err: any) {
      const message = err?.message || 'Failed to link report';
      setError(message);
      showToast(message, 'error');
    }
  };

  // Handle acknowledgment
  const handleAcknowledge = async (incidentId: string) => {
    if (!confirm('Acknowledge this incident?')) {
      return;
    }

    try {
      const response = await api.acknowledgeIncident(incidentId);

      if (response.success) {
        showToast('Incident acknowledged successfully', 'success');
        refetch();
      } else {
        const message = response.error?.message || 'Failed to acknowledge incident';
        setError(message);
        showToast(message, 'error');
      }
    } catch (err: any) {
      const message = err?.message || 'Failed to acknowledge incident';
      setError(message);
      showToast(message, 'error');
    }
  };

  // Only show Acknowledge button if user has permission
  const canAcknowledgeIncident = user?.permissions?.includes('incidents.manage') ?? false;

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
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-3">
            <div>
              <h1 className="font-semibold text-lg">Incidents</h1>
              <p className="text-sm text-gray-500">Authority queue</p>
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Report Count</label>
            <select
              onChange={(e) => onFilterChange({ priority_codes: [e.target.value] })}
              className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-primary"
            >
              <option value="">All counts</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              onChange={(e) => onFilterChange({ search_query: e.target.value })}
              placeholder="Search incidents or reports..."
              className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* Incidents List */}
      <div className="bg-white rounded-lg shadow p-4">
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <span>Loading incidents...</span>
          </div>
        ) : incidents.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-gray-500">
            No incidents found matching your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="p-3 border-b text-left text-xs font-medium text-gray-500">Incident ID</th>
                  <th className="p-3 border-b text-left text-xs font-medium text-gray-500">Priority</th>
                  <th className="p-3 border-b text-left text-xs font-medium text-gray-500">Status</th>
                  <th className="p-3 border-b text-left text-xs font-medium text-gray-500">Title</th>
                  <th className="p-3 border-b text-left text-xs font-medium text-gray-500">Reports</th>
                  <th className="p-3 border-b text-left text-xs font-medium text-gray-500">Acknowledged</th>
                  <th className="p-3 border-b text-left text-xs font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((incident) => (
                  <tr key={incident.id} className="border-b transition-colors hover:bg-gray-50">
                    <td className="p-3 font-medium">
                      <a
                        href={`/incidents/${incident.id}`}
                        className="underline text-primary hover:text-primary/90"
                      >
                        {incident.id.substring(0, 8)}...
                      </a>
                    </td>
                    <td className="p-3">
                      <span className={statusBadgeClasses(incident.priority_code)}>
                        {incident.priority_code}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={statusBadgeClasses(incident.status)}>
                        {incident.status}
                      </span>
                    </td>
                    <td className="p-3">{incident.title || '—'}</td>
                    <td className="p-3">{incident.report_count}</td>
                    <td className="p-3">
                      {incident.authority_acknowledged ? (
                        <span className="text-green-600 font-medium">Acknowledged</span>
                      ) : (
                        canAcknowledgeIncident && (
                          <button
                            onClick={() => handleAcknowledge(incident.id)}
                            className="text-primary hover:text-primary/90 text-sm"
                            title="Acknowledge incident"
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

            {/* Pagination info */}
            {totalDisplay > (filters.page_size || 25) && (
              <div className="mt-4 flex justify-between text-sm text-gray-500">
                <span>Showing {filtered.length} of {totalDisplay} incidents</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}