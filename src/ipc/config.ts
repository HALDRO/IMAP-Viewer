/**
 * @file IPC handlers for user configuration management
 */
import type { IpcMain, IpcMainInvokeEvent } from 'electron';

import { getConfig, saveConfig } from '../services/storeService';
import type { Logger } from 'pino';

export const registerConfigHandlers = (ipcMain: IpcMain, logger: Logger): void => {
  // Get user configuration
  ipcMain.handle('config:get-user', async (): Promise<Record<string, unknown>> => {
    try {
      const config = await getConfig();
      return (config.ui as Record<string, unknown>) ?? {};
    } catch (error) {
      logger.error(`Failed to load user config: ${error instanceof Error ? error.message : String(error)}`);
      return {};
    }
  });

  // Save user configuration
  ipcMain.handle('config:save-user', async (_event: IpcMainInvokeEvent, userConfig: Record<string, unknown>): Promise<void> => {
    try {
      const config = await getConfig();
      config.ui = userConfig;
      await saveConfig(config);
      logger.info('User configuration saved successfully');
    } catch (error) {
      logger.error(`Failed to save user config: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  });

  // Reset entire configuration to defaults
  ipcMain.handle('config:reset-all', async (): Promise<void> => {
    try {
      const defaultConfig = {
        proxy: {
          enabled: false,
          type: "socks5",
          hostPort: "127.0.0.1:1080",
          auth: false
        },
        ui: {
          isSettingsOpen: false,
          currentView: "email",
          isLeftPanelHidden: false,
          isLogPanelCollapsed: false,
          isAccountPanelCollapsed: false,
          leftPanelWidth: 25,
          rightPanelWidth: 25,
          logPanelHeight: 25
        }
      };
      await saveConfig(defaultConfig);
      logger.info('All configuration reset to defaults');
    } catch (error) {
      logger.error(`Failed to reset config: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  });
};
