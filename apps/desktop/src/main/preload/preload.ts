import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI, {
  // SQLite operations
  openDatabase: (path: string) => ipcRenderer.invoke('db:open', path),
  executeQuery: (dbId: string, query: string, params?: unknown[]) =>
    ipcRenderer.invoke('db:execute', dbId, query, params),

  // IPC communication
  sendSyncEvent: (event: string, data: unknown) => ipcRenderer.send('sync:event', event, data),
  receiveSyncEvent: (channel: string, listener: (event: MessageEvent) => void) =>
    ipcRenderer.on(channel, listener),

  // File operations
  readFile: (path: string) => ipcRenderer.invoke('file:read', path),
  writeFile: (path: string, content: string) => ipcRenderer.invoke('file:write', path, content),

  // Notifications
  requestNotificationPermission: () => ipcRenderer.invoke('notif:permission'),
  sendNotification: (title: string, body: string) => ipcRenderer.invoke('notif:send', title, body),
});