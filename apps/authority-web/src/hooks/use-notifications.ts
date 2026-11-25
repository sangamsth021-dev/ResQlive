/**
 * Authority Workspace Notifications Hook
 *
 * Handles notification state management, marking as read, and clearing
 * notifications for the authority dashboard.
 */

import { useEffect, useState, useCallback } from 'react';

/** Mark a notification as read */
export function markAsRead(notificationId: string): Promise<void> {
  return fetch(`https://api.resq.live/v1/notifications/${notificationId}/read`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${localStorage.getItem('resq_auth_token')}`,
      'Content-Type': 'application/json',
    },
  }).then((res) => {
    if (!res.ok) throw new Error('Failed to mark notification as read');
  });
}

/** Clear all notifications */
export function clearNotifications(): Promise<void> {
  return fetch(`https://api.resq.live/v1/notifications/clear`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${localStorage.getItem('resq_auth_token')}`,
      'Content-Type': 'application/json',
    },
  }).then((res) => {
    if (!res.ok) throw new Error('Failed to clear notifications');
  });
}

/** Hook return type */
interface UseNotificationsResult {
  markAsRead: (notificationId: string) => Promise<void>;
  clearNotifications: () => Promise<void>;
}

/** Notifications hook */
export function useNotifications(): UseNotificationsResult {
  const [markAsRead] = useCallback((notificationId: string) => {
    return markAsRead(notificationId);
  }, []);

  const [clearNotifications] = useCallback(() => {
    return clearNotifications();
  }, []);

  return {
    markAsRead,
    clearNotifications,
  };
}