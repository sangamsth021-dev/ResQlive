/**
 * Authority Workspace Report Detail Page
 *
 * Displays detailed information about a single report including:
 * - Report metadata (category, severity, priority, location, timestamps)
 * - Evidence thumbnails and status
 * - Assignment and team information
 * - Status history/events
 * - Acknowledgment action for authorized operators
 * Fetches data from the actual backend API.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useApiClient } from '@/api';
import { statusBadgeClasses } from '@/components/status-badge';
import { useNotifications } from '@/hooks/use-notifications';

interface EvidenceItem {
  evidence_id: string;
  kind: string;
  mime_type: string;
  size_bytes: number;
  sha256_hash: string;
  storage_state: string;
  integrity_status: string | null;
  captured_at: string;
  url: string | null; // Presigned URL or thumbnail
}

interface ReportDetail {
  id: string;
  category_code: string;
  severity_code: string;
  priority_code: string;
  status: string;
  impact_json: Record<string, any>;
  reported_location: { lat: number; lon: number } | null;
  reported_at: string;
  reported_by: string;
  authority_acknowledged: boolean;
  authority_acknowledged_at: string | null;
  authority_acknowledged_by: string | null;
  reason_code: string | null;
  reason_text: string | null;
  evidence: EvidenceItem[];
  assigned_team: string | null;
  incident_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ReportDetailProps {}

export function ReportDetailPage({}: ReportDetailProps = {}) {
  const { reportId } = useParams<{ reportId: string }>();
  const { isAuthenticated, user, logout } = useApiClient();
  const { showToast } = useNotifications();

  // State
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load report detail from backend
  useEffect(() => {
    if (!isAuthenticated || !reportId) {
      setLoading(false);
      return;
    }

    const loadReport = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await api.getReport(reportId);

        if (response.success && response.data) {
          setReport(response.data);
        } else {
          throw new Error(response.error?.message || 'Failed to load report detail');
        }
      } catch (err: any) {
        setError(err?.detail || 'Failed to load report detail');
        setReport(null);
      } finally {
        setLoading(false);
      }
    };

    loadReport();
  }, [isAuthenticated, reportId]);

  // Handle acknowledgment
  const handleAcknowledge = async () => {
    if (!report || !user) return;

    if (!confirm('Acknowledge this report? This will update the status to "authority_acknowledged" and record the acknowledgment in the audit log.')) {
      return;
    }

    try {
      const response = await api.acknowledgeReport(report.id);

      if (response.success) {
        showToast('Report acknowledged successfully', 'success');
        // Refresh the report detail to show updated status
        const r = await api.getReport(report.id);
        if (r.success && r.data) {
          setReport(r.data);
        }
      } else {
        const message = response.error?.message || 'Failed to acknowledge report';
        setError(message);
        showToast(message, 'error');
      }
    } catch (err: any) {
      const message = err?.message || 'Failed to acknowledge report';
      setError(message);
      showToast(message, 'error');
    }
  };

  // Handle evidence URL generation (presigned URLs are fetched on demand)
  const getEvidenceUrl = (evidence: EvidenceItem) => {
    if (evidence.url) return evidence.url;
    if (evidence.integrity_status === 'checksum_verified') {
      // Generate thumbnail or streaming URL
      return `/api/evidence/thumbnail/${evidence.evidence_id}?width=200`;
    }
    return '/assets/evidence-placeholder.svg';
  };

  if (!isAuthenticated) {
    return null;
  }

  if (!report && loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <span>Loading report...</span>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="p-8 text-center text-gray-500">
          <h2>Report Not Found</h2>
          <p>The report you requested could not be found.</p>
          <button
            onClick={() => {}}
            className="mt-4 inline-block px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
          >
            Go back to reports
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header breadcrumb */}
      <nav className="bg-white shadow border-b mb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-3">
            <div>
              <h1 className="font-semibold text-lg">
                Report {report.id.substring(0, 8)}...
              </h1>
              <p className="text-sm text-gray-500">#</p>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={statusBadgeClasses(report.status)}
              >
                {report.status}
              </span>
              {report.authority_acknowledged && (
                <span className="text-green-600 text-sm font-medium">Acknowledged</span>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Report Detail Layout */}
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="grid lg:grid-cols-2 gap-6">

          {/* Left column: Report metadata */}
          <div>
            {/* Status badge */}
            <div className="mb-4">
              <h2 className="text-sm font-medium text-gray-700 mb-2">Status</h2>
              <span
                className={statusBadgeClasses(report.status)}
              >
                {report.status}
              </span>
            </div>

            {/* Basic metadata */}
            <div className="space-y-3">
              <div>
                <span className="text-sm text-gray-500">Report ID</span>
                <span className="font-medium">{report.id}</span>
              </div>
              <div>
                <span className="text-sm text-gray-500">Category</span>
                <span className="font-medium">{report.category_code}</span>
              </div>
              <div>
                <span className="text-sm text-gray-500">Severity</span>
                <span className="font-medium text-danger">
                  {report.severity_code}
                </span>
              </div>
              <div>
                <span className="text-sm text-gray-500">Priority</span>
                <span className="font-medium">{report.priority_code}</span>
              </div>
              <div>
                <span className="text-sm text-gray-500">Reported</span>
                <span className="font-medium">
                  {new Date(report.reported_at).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-sm text-gray-500">Reported By</span>
                <span className="font-medium">{report.reported_by}</span>
              </div>
            </div>

            {/* Location */}
            {report.reported_location && (
              <div className="mt-4">
                <h3 className="text-xs font-medium text-gray-500 mb-1">Location</h3>
                <div className="flex items-baseline gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-primary"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="22" cy="22" r="2.5" />
                    <path d="M21 21l-4.3-4.3" />
                  </svg>
                  <span>
                    {report.reported_location.lat.toFixed(4)}, {report.reported_location.lon.toFixed(4)}
                  </span>
                </div>
              </div>
            )}

            {/* Acknowledgment info */}
            {report.authority_acknowledged && (
              <div className="mt-4 p-3 bg-green-50 rounded-lg">
                <h3 className="text-xs font-medium text-green-600 mb-1">Acknowledged</h3>
                <div className="grid grid-cols-2 gap-2 text-sm text-green-600">
                  <div>Acknowledged By: {report.authority_acknowledged_by || '—'}</div>
                  <div>Acknowledged At: {report.authority_acknowledged_at ? new Date(report.authority_acknowledged_at).toLocaleString() : '—'}</div>
                  <div>Reason Code: {report.reason_code || '—'}</div>
                  <div>Reason Text: {report.reason_text || '—'}</div>
                </div>
              </div>
            )}

            {/* Assignment info */}
            {report.assigned_team && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <h3 className="text-xs font-medium text-blue-600 mb-1">Assigned Team</h3>
                <p className="text-sm">{report.assigned_team}</p>
              </div>
            )}

            {/* Incident link */}
            {report.incident_id && (
              <div className="mt-4 p-3 bg-purple-50 rounded-lg">
                <h3 className="text-xs font-medium text-purple-600 mb-1">Linked Incident</h3>
                <p className="text-sm">
                  {report.incident_id}
                </p>
              </div>
            )}
          </div>

          {/* Right column: Evidence and details */}
          <div>
            {/* Evidence section */}
            {report.evidence.length > 0 ? (
              <div className="space-y-4">
                <h2 className="text-sm font-medium text-gray-700 mb-3">Evidence</h2>
                <div className="grid grid-cols-2 gap-4">
                  {report.evidence.map((ev, idx) => (
                    <div
                      key={ev.evidence_id}
                      className="border rounded p-3 flex flex-col h-48"
                    >
                      <div className="h-48 rounded overflow-hidden bg-gray-200">
                        <img
                          src={getEvidenceUrl(ev)}
                          alt={`Evidence ${ev.evidence_id}`}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div className="mt-2 text-xs">
                        <span className="font-medium">{ev.kind}</span>
                        <span className="text-gray-500 ml-1">({ev.mime_type})</span>
                      </div>

                      <div className="mt-1">
                        <span className="text-success">
                          {ev.integrity_status || 'pending'}
                        </span>
                        <span className="text-gray-500 ml-1">/{ev.storage_state}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {report.evidence.length > 0 && (
                  <p className="text-xs text-gray-500 mt-2">
                    {report.evidence.length} piece{report.evidence.length !== 1 ? 's' : ''} of evidence
                  </p>
                )}
              </div>
            ) : (
              <div className="py-8 text-center text-gray-500">
                <p>No evidence attached</p>
              </div>
            )}

            {/* Report impact / details */}
            {Object.keys(report.impact_json).length > 0 && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <h3 className="text-xs font-medium text-gray-700 mb-2">Impact Assessment</h3>
                <pre className="text-xs text-gray-600 break-all">{JSON.stringify(report.impact_json, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Acknowledgment action (only for authorized operators) */}
      {isAuthenticated && user?.role === 'org_admin' && (
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="text-sm font-medium text-blue-600 mb-2">
            Authority Acknowledgment
          </h3>
          <p className="text-sm text-blue-600">
            Acknowledging this report will:
          </p>
          <ul className="text-sm text-blue-600 space-y-1">
            <li>Update report status to "authority_acknowledged"</li>
            <li>Record the acknowledgment with timestamp and actor</li>
            <li>Create an audit log entry for traceability</li>
            <li>Push the acknowledgment event to all reporting devices via sync</li>
          </ul>
          <button
            onClick={handleAcknowledge}
            className="mt-4 w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
            disabled={!report || report.authority_acknowledged}
          >
            {report.authority_acknowledged ? 'Acknowledged' : 'Acknowledge Report'}
          </button>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="mt-6 p-3 bg-red-50 rounded-lg">
          <span className="text-sm text-red-600">{error}</span>
        </div>
      )}
    </div>
  );
}