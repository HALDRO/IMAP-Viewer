/**
 * @file IPC handlers for file system operations
 */
import { shell } from 'electron';
import path from 'path';
import type { IpcMain, IpcMainInvokeEvent } from 'electron';

import { DATA_DIR, ACCOUNTS_FILE, CONFIG_FILE } from '../services/storeService';
import type { Logger } from 'pino';

export const registerFileHandlers = (ipcMain: IpcMain, logger: Logger): void => {
  // Open data folder in file explorer
  ipcMain.handle('files:open-data-folder', async (): Promise<{ success: boolean; error?: string }> => {
    try {
      await shell.openPath(DATA_DIR);
      logger.info(`Opened data folder: ${DATA_DIR}`);
      return { success: true };
    } catch (error) {
      const errorMsg = `Failed to open data folder: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMsg);
      return { success: false, error: errorMsg };
    }
  });

  // Open accounts file
  ipcMain.handle('files:open-accounts-file', async (): Promise<{ success: boolean; error?: string }> => {
    try {
      await shell.openPath(ACCOUNTS_FILE);
      logger.info(`Opened accounts file: ${ACCOUNTS_FILE}`);
      return { success: true };
    } catch (error) {
      const errorMsg = `Failed to open accounts file: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMsg);
      return { success: false, error: errorMsg };
    }
  });

  // Open config file
  ipcMain.handle('files:open-config-file', async (): Promise<{ success: boolean; error?: string }> => {
    try {
      await shell.openPath(CONFIG_FILE);
      logger.info(`Opened config file: ${CONFIG_FILE}`);
      return { success: true };
    } catch (error) {
      const errorMsg = `Failed to open config file: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMsg);
      return { success: false, error: errorMsg };
    }
  });

  // Get data directory path
  ipcMain.handle('files:get-data-dir', async (): Promise<string> => {
    return DATA_DIR;
  });
};
