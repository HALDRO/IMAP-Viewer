import type { IpcMain, WebContents, BrowserWindow } from 'electron';
import type { Logger } from 'pino';

import { getGlobalProxy } from '../services/storeService';
import type { ProxyStatus } from '../shared/types/electron';

import { registerAccountHandlers } from './account';
import { registerClipboardHandlers } from './clipboard';
import { registerConfigHandlers } from './config';
import { registerFileHandlers } from './files';
import { registerImapFlowHandlers } from './imapFlow';
import { registerProxyHandlers } from './proxy';

type SendConnectionStatusFn = (_accountId: string, _status: 'connected' | 'connecting' | 'disconnected') => void;
type SendProxyStatusFn = (_status: ProxyStatus, _details?: { ip?: string; error?: string }) => void;

export interface RegisterHandlersArgs {
  ipcMain: IpcMain;
  webContents: WebContents;
  mainWindow: BrowserWindow;
  logger: Logger;
  sendProxyStatus: SendProxyStatusFn;
  sendConnectionStatus: SendConnectionStatusFn;
}

/**
 * @file Entry point for registering all IPC handlers.
 * It imports handlers from different files and registers them with the main process.
 */
export const registerIpcHandlers = ({ ipcMain, webContents, mainWindow, logger, ...helpers }: RegisterHandlersArgs): void => {
    const { sendProxyStatus, sendConnectionStatus } = helpers;
    // Register all handlers from the different modules
    registerAccountHandlers(ipcMain, mainWindow, logger);
    registerImapFlowHandlers(ipcMain, webContents, logger, sendConnectionStatus);
    registerProxyHandlers(ipcMain, sendProxyStatus, logger);
    registerConfigHandlers(ipcMain, logger);
    registerFileHandlers(ipcMain, logger);
    registerClipboardHandlers(ipcMain, logger);

    // Handle renderer ready signal
    ipcMain.handle('renderer:ready', async () => {
        // Initial proxy check on startup, once the renderer is ready to receive updates.
        const initialProxyConfig = await getGlobalProxy();
        if (initialProxyConfig?.enabled === true) {
            // Proxy connection test would be handled by proxy handlers
            sendProxyStatus('connecting');
        }
        logger.info('Renderer process is ready and listening for events.');
    });
};