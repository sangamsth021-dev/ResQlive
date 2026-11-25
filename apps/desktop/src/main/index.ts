import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import Database from 'better-sqlite3';

let mainWindow: BrowserWindow | null = null;
let db: Database.Database | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers for SQLite operations
ipcMain.handle('db:open', async (_, dbPath: string) => {
  try {
    db = new Database(dbPath);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:execute', async (_, query: string, params: any[] = []) => {
  if (!db) return { success: false, error: 'Database not initialized' };
  try {
    const stmt = db.prepare(query);
    const isSelect = query.trim().toUpperCase().startsWith('SELECT');
    const result = isSelect ? stmt.all(...params) : stmt.run(...params);
    return { success: true, result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});