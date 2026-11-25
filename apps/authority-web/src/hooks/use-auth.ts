/**
 * Authority Workspace Authentication Hook
 *
 * Handles JWT token management, user profile retrieval, and permission checking
 * for the authority dashboard. Uses the backend API endpoints for auth operations.
 */

import { useEffect, useState, useCallback } from 'react';

/** Backend API response types */
interface AuthUser {
  id: string;
  email: string;
  display_name: string | null;
  role: string;
  organization_id: string;
  permissions: string[];
}

/** Token storage keys */
const TOKEN_KEY = 'resq_auth_token';
const USER_KEY = 'resq_auth_user';

/** Fetch current user from backend */
async function fetchCurrentUser(accessToken: string): Promise<AuthUser> {
  const response = await fetch('https://api.resq.live/v1/auth/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user profile');
  }

  return response.json();
}

/** Login action - called from page components */
export async function login(phoneOrEmail: string, password: string): Promise<{ token: string; user: AuthUser }> {
  const response = await fetch('https://api.resq.live/v1/auth/session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ phone_or_email: phoneOrEmail, password }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Login failed');
  }

  const data = await response.json();

  // Store tokens
  localStorage.setItem(TOKEN_KEY, data.token);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));

  return data;
}

/** Logout action */
export function logout(): void {
  // Clear refresh token on server
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      fetch('https://api.resq.live/v1/auth/logout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }).catch(() => {}); // Ignore logout errors
    }
  } catch {}

  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/** Get stored access token */
export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/** Get stored user profile */
export function getStoredUser(): AuthUser | null {
  const userStr = localStorage.getItem(USER_KEY);
  return userStr ? JSON.parse(userStr) : null;
}

/** Check if user has a specific permission */
function hasPermission(user: AuthUser, permission: string): boolean {
  return user.permissions.includes(permission);
}

/** Check if user can access a report */
function canAccessReport(user: AuthUser, reportOrgId: string): boolean {
  // Org admins and above can access any report in their org
  if (user.role === 'org_admin') return true;
  // Users can only access reports in their own org
  return user.organization_id === reportOrgId;
}

/** Hook return type */
interface UseAuthResult {
  isAuthenticated: boolean;
  user: AuthUser | null;
  login: (phoneOrEmail: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<AuthUser | null>;
  hasPermission: (permission: string) => boolean;
  canAccessReport: (reportOrgId: string) => boolean;
}

/** Authentication hook */
export function useAuth(): UseAuthResult {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const token = getStoredToken();
    const storedUser = getStoredUser();

    if (token && storedUser) {
      setIsAuthenticated(true);
      setUser(storedUser);
    } else {
      setIsAuthenticated(false);
      setUser(null);
    }
  }, []);

  const login = useCallback(async (phoneOrEmail: string, password: string): Promise<void> => {
    try {
      const { token, user } = await login(phoneOrEmail, password);
      setIsAuthenticated(true);
      setUser(user);
    } catch (error) {
      setIsAuthenticated(false);
      setUser(null);
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    logout();
    setIsAuthenticated(false);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async (): Promise<AuthUser | null> => {
    const token = getStoredToken();
    if (!token) return null;

    try {
      const currentUser = await fetchCurrentUser(token);
      setUser(currentUser);
      return currentUser;
    } catch {
      logout();
      setIsAuthenticated(false);
      setUser(null);
      return null;
    }
  }, []);

  const hasPermission = useCallback((permission: string): boolean => {
    return user ? hasPermission(user, permission) : false;
  }, [user]);

  const canAccessReport = useCallback((reportOrgId: string): boolean => {
    return user ? canAccessReport(user, reportOrgId) : false;
  }, [user]);

  return {
    isAuthenticated,
    user,
    login,
    logout,
    refreshUser,
    hasPermission,
    canAccessReport,
  };
}