/**
 * Status Badge Component
 *
 * Renders a styled badge for report/incident/assignment statuses.
 * Uses color coding based on the status value.
 */

import React from 'react';

/** Status badge variants with their display labels and colors */
interface StatusBadgeProps {
  /** The status code value */
  status: string;
  /** Optional custom className overrides */
  className?: string;
  /** Optional size variant */
  size?: 'sm' | 'md' | 'lg';
}

/** Map of status codes to badge appearances */
const statusBadgeMap: Record<string, { color: string; bg: string }> = {
  // Report states
  local_saved: { color: 'gray-800', bg: 'gray-100' },
  queued: { color: 'blue-800', bg: 'blue-100' },
  sending: { color: ' cyan-800', bg: ' cyan-100' },
  relayed: { color: 'violet-800', bg: 'violet-100' },
  server_received: { color: 'green-800', bg: 'green-100' },
  authority_acknowledged: { color: 'green-800', bg: 'green-100' },
  verified: { color: 'green-800', bg: 'green-100' },

  // Incident states
  new: { color: 'gray-800', bg: 'gray-100' },
  triaged: { color: 'blue-800', bg: 'blue-100' },
  verified: { color: 'green-800', bg: 'green-100' },
  assigned: { color: 'cyan-800', bg: 'cyan-100' },
  dispatched: { color: 'violet-800', bg: 'violet-100' },
  response_in_progress: { color: 'purple-800', bg: 'purple-100' },
  resolved: { color: 'green-800', bg: 'green-100' },
  closed: { color: 'gray-800', bg: 'gray-100' },

  // Assignment states
  proposed: { color: 'gray-800', bg: 'gray-100' },
  sent: { color: 'blue-800', bg: 'blue-100' },
  acknowledged: { color: 'green-800', bg: 'green-100' },
  en_route: { color: 'cyan-800', bg: 'cyan-100' },
  on_scene: { color: 'green-800', bg: 'green-100' },
  working: { color: 'yellow-800', bg: 'yellow-100' },
  completed: { color: 'green-800', bg: 'green-100' },
  cancelled: { color: 'red-800', bg: 'red-100' },
  declined: { color: 'red-800', bg: 'red-100' },

  // Default
  default: { color: 'gray-800', bg: 'gray-100' },
};

export function StatusBadge({ status, className, size = 'md' }: StatusBadgeProps) {
  const { color, bg } = statusBadgeMap[status] || statusBadgeMap.default;
  const sizeClasses = {
    sm: 'text-xs py-1 px-2 rounded',
    md: 'text-sm py-1.5 px-3 rounded',
    lg: 'text-base py-2 px-4 rounded',
  };

  return (
    <span
      className={`inline-flex items-center ${sizeClasses[size]} ${color} ${bg} rounded`}
      style={{ '--status-color': color, '--status-bg': bg }}
    >
      {status}
    </span>
  );
}

/** Hook to get badge classes for use in templates */
export function useStatusBadgeClasses(status: string): string {
  const { color, bg } = statusBadgeMap[status] || statusBadgeMap.default;
  return `inline-flex items-center text-xs py-1 px-2 rounded ${color} ${bg}`;
}