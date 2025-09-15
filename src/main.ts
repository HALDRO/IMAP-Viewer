/// <reference path="./types/electron-squirrel-startup.d.ts" />

import path from 'node:path';

import { app, BrowserWindow, ipcMain } from 'electron';
import started from 'electron-squirrel-startup';

import { registerIpcHandlers } from './ipc';
import { initializeLogger, getLogger, logFromRenderer } from './services/logger';
import { imapFlowConnectionManager } from './services/connectionManager';
import type { ProxyStatus } from './shared/types/electron';

// Vite environment variables
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

// Node.js globals for Electron main process
declare const __dirname: string;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started === true) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;

const createWindow = (): void => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // and load the index.html of the app.
  if (typeof MAIN_WINDOW_VITE_DEV_SERVER_URL === 'string' && MAIN_WINDOW_VITE_DEV_SERVER_URL.length > 0) {
    void mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    void mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    void imapFlowConnectionManager.endAll();
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});


// Helper function to send connection status updates to renderer
const sendConnectionStatus = (accountId: string, status: 'connected' | 'connecting' | 'disconnected'): void => {
  if (mainWindow) {
    mainWindow.webContents.send('account:connection-status', { accountId, status });
  }
};

// Helper to send proxy status updates
const sendProxyStatus = (status: ProxyStatus, details: { ip?: string; error?: string } = {}): void => {
  if (mainWindow) {
    mainWindow.webContents.send('proxy:status-update', { status, ...details });
  }
};

// --- IPC and App Logic Setup ---
void app.whenReady().then(() => {
  if (!mainWindow) {
    createWindow();
  }

  if (mainWindow) {
    initializeLogger(mainWindow);
    const logger = getLogger();

    // Listen for log events from the renderer process
    ipcMain.on('log:renderer', (_event, log: { level: 'info' | 'warn' | 'error', message: string, context?: object }) => {
      const { level, message, context } = log;
      // Use logFromRenderer to prevent sending logs back to renderer
      logFromRenderer(level, message, context);
    });

    registerIpcHandlers({
      ipcMain,
      webContents: mainWindow.webContents,
      mainWindow,
      logger,
      sendProxyStatus,
      sendConnectionStatus,
    });
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
