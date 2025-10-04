/**
 * @file IPC handlers for user configuration management
 */
import type { IpcMain, IpcMainInvokeEvent } from 'electron'
import type { Logger } from 'pino'

import { type AppConfig, getConfig, saveConfig } from '../services/configService'

export const registerConfigHandlers = (ipcMain: IpcMain, logger: Logger): void => {
  const log = logger.child({ module: 'ConfigIPC' })

  // Get user UI configuration (merged from all sources)
  ipcMain.handle(
    'config:get-user',
    async (_event: IpcMainInvokeEvent): Promise<Record<string, unknown>> => {
      try {
        const config = await getConfig()
        // Merge panel settings and main settings
        return {
          ...(config.uiPanels ?? {}),
          ...(config.mainSettings ?? {}),
        }
      } catch (error) {
        log.error({ error }, 'Failed to load user config')
        return {}
      }
    }
  )

  // Save user UI configuration (with smart key-based separation)
  ipcMain.handle(
    'config:save-user',
    async (_event: IpcMainInvokeEvent, userConfig: Record<string, unknown>): Promise<void> => {
      try {
        const config = await getConfig()

        // Determine settings category by keys
        const panelKeys = new Set([
          'isLeftPanelHidden',
          'isLogPanelCollapsed',
          'isAccountPanelCollapsed',
          'leftPanelWidth',
          'rightPanelWidth',
          'logPanelHeight',
        ])
        const mainKeys = new Set([
          'hideEventLogger',
          'autoLoginOnStartup',
          'compactAccountView',
          'debugMode',
          'minimizeToTray',
        ])

        const configKeys = Object.keys(userConfig)
        const isPanelConfig = configKeys.some(key => panelKeys.has(key))
        const isMainSettings = configKeys.some(key => mainKeys.has(key))

        if (isPanelConfig) {
          // Save only panel keys
          config.uiPanels = config.uiPanels ?? {}
          for (const key of configKeys) {
            if (panelKeys.has(key)) {
              config.uiPanels[key] = userConfig[key]
            }
          }
          log.info({ keys: configKeys }, 'Panel configuration saved')
        }

        if (isMainSettings) {
          // Save only main settings keys
          config.mainSettings = config.mainSettings ?? {}
          for (const key of configKeys) {
            if (mainKeys.has(key)) {
              config.mainSettings[key] = userConfig[key]
            }
          }
          log.info({ keys: configKeys }, 'Main settings saved')
        }

        await saveConfig(config)
      } catch (error) {
        log.error({ error }, 'Failed to save user config')
        throw error
      }
    }
  )

  // Reset entire configuration to defaults
  ipcMain.handle('config:reset-all', async (): Promise<void> => {
    try {
      const defaultConfig: AppConfig = {
        proxy: {
          enabled: false,
          type: 'socks5',
          hostPort: '127.0.0.1:1080',
          auth: false,
          username: '',
          password: '',
        },
        ui: {
          isSettingsOpen: false,
          currentView: 'email',
          isLeftPanelHidden: false,
          isLogPanelCollapsed: false,
          isAccountPanelCollapsed: false,
          leftPanelWidth: 25,
          rightPanelWidth: 25,
          logPanelHeight: 15,
        },
      }
      await saveConfig(defaultConfig)
      log.info('All configuration has been reset to defaults')
    } catch (error) {
      log.error({ error }, 'Failed to reset config')
      throw error
    }
  })
}
