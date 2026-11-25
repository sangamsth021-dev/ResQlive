/**
 * Authority Workspace Filters Hook
 *
 * Manages report filtering by category, severity, status, time range, and location bounds.
 * Provides filtered and sorted report lists for the dashboard queue view.
 */

import { useState, useCallback, useEffect } from 'react';

/** Filter state interface */
interface ReportFilters {
  category_codes: string[];
  severity_codes: string[];
  status_codes: string[];
  priority_codes: string[];
  date_from: string | null;
  date_to: string | null;
  bbox: [number, number, number, number] | null; // [minLon, minLat, maxLon, maxLat]
  search_query: string;
  page: number;
  page_size: number;
}

/** Filter change handler result */
interface FilterChange {
  filters: ReportFilters;
  apply: boolean;
}

/** Initial filter state */
const initialFilters: ReportFilters = {
  category_codes: [],
  severity_codes: [],
  status_codes: [],
  priority_codes: [],
  date_from: null,
  date_to: null,
  bbox: null,
  search_query: '',
  page: 1,
  page_size: 25,
};

export type { ReportFilters, FilterChange, initialFilters };

/** Apply filters to a report list */
function applyFilters(
  reports: any[],
  filters: ReportFilters
): {
  filtered: any[];
  totalDisplay: number;
} {
  let filtered = [...reports];

  // Filter by category codes
  if (filters.category_codes.length > 0) {
    filtered = filtered.filter((r) => filters.category_codes.includes(r.category_code));
  }

  // Filter by severity codes
  if (filters.severity_codes.length > 0) {
    filtered = filtered.filter((r) => filters.severity_codes.includes(r.severity_code));
  }

  // Filter by status codes
  if (filters.status_codes.length > 0) {
    filtered = filtered.filter((r) => filters.status_codes.includes(r.status));
  }

  // Filter by priority codes
  if (filters.priority_codes.length > 0) {
    filtered = filtered.filter((r) => filters.priority_codes.includes(r.priority_code));
  }

  // Filter by date range
  if (filters.date_from) {
    const from = new Date(filters.date_from);
    filtered = filtered.filter(
      (r) => new Date(r.reported_at) >= from
    );
  }

  if (filters.date_to) {
    const to = new Date(filters.date_to);
    // Set to end of day
    to.setHours(23, 59, 59, 999);
    filtered = filtered.filter(
      (r) => new Date(r.reported_at) <= to
    );
  }

  // Filter by bounding box (geography contains check)
  if (filters.bbox) {
    const [minLon, minLat, maxLon, maxLat] = filters.bbox;
    filtered = filtered.filter((r) => {
      const location = r.reported_location;
      if (!location || !location.lat || !location.lon) return false;
      return (
        location.lon >= minLon &&
        location.lon <= maxLon &&
        location.lat >= minLat &&
        location.lat <= maxLat
      );
    });
  }

  // Search query (matches against category name, severity, or report ID)
  if (filters.search_query) {
    const query = filters.search_query.toLowerCase();
    filtered = filtered.filter(
      (r) =>
        (r.category_code && r.category_code.toLowerCase().includes(query)) ||
        (r.severity_code && r.severity_code.toLowerCase().includes(query)) ||
        (r.id && r.id.toString().toLowerCase().includes(query))
    );
  }

  return { filtered, totalDisplay: filtered.length };
}

/** Hook return type */
interface UseFiltersResult {
  filters: ReportFilters;
  setFilters: (filters: Partial<ReportFilters>) => void;
  applyFilters: (reports: any[]) => { filtered: any[]; totalDisplay: number };
  resetFilters: () => void;
  refetch: () => void;
}

/** Filters hook */
export function useFilters(): UseFiltersResult {
  const [filters, setFiltersState] = useState<ReportFilters>(initialFilters);

  // Persist filters to localStorage on change
  useEffect(() => {
    localStorage.setItem('resq_filters', JSON.stringify(filters));
  }, [filters]);

  // Load filters from localStorage on init
  useEffect(() => {
    const saved = localStorage.getItem('resq_filters');
    if (saved) {
      try {
        setFiltersState(JSON.parse(saved));
      } catch {
        // Ignore parse errors, use initial state
      }
    }
  }, []);

  const setFilters = useCallback((partial: Partial<ReportFilters>): void => {
    setFiltersState((prev) => ({
      ...prev,
      ...partial,
    }));
  }, []);

  const applyFilters = useCallback((reports: any[]): { filtered: any[]; totalDisplay: number } => {
    return applyFilters(reports, filters);
  }, [filters]);

  const resetFilters = useCallback(() => {
    setFiltersState({ ...initialFilters });
    localStorage.removeItem('resq_filters');
  }, []);

  const refetch = useCallback(() => {
    // No-op; triggers re-application of filters via derived state
  }, []);

  return {
    filters,
    setFilters,
    applyFilters,
    resetFilters,
    refetch,
  };
}