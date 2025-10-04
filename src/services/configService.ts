/**
 * @file Service for managing the main application configuration (config.json).
 */
import { promises as fsPromises } from 'node:fs'
import path from 'node:path'

import type { GlobalProxyConfig } from '../shared/types/account'

import { getLogger } from './logger'
import { DATA_DIR, ensureFileExists } from './storageManager'

export const CONFIG_FILE = path.join(DATA_DIR, 'config.json')

// Type for the entire application configuration
export interface AppConfig {
  uiPanels?: Record<string, unknown> // Panel settings (isLeftPanelHidden, leftPanelWidth, etc.)
  mainSettings?: Record<string, unknown> // Main app settings (hideEventLogger, minimizeToTray, etc.)
  proxy?: GlobalProxyConfig
  [key: string]: unknown
}

/**
 * Reads the entire configuration from config.json.
 * Ensures the file exists before reading.
 * @returns The application configuration object.
 */
export const getConfig = async (): Promise<AppConfig> => {
  try {
    await ensureFileExists(CONFIG_FILE)
    const content = await fsPromises.readFile(CONFIG_FILE, 'utf8')
    // If content is empty or just whitespace, return a default object
    if (!content.trim()) {
      return {}
    }
    return JSON.parse(content) as AppConfig
  } catch (error) {
    const logger = getLogger()
    logger.error({ error }, 'Failed to read config file, returning default empty config.')
    return {} // Return a default empty object on error
  }
}

/**
 * Saves the entire configuration to config.json.
 * @param config The configuration object to save.
 */
export const saveConfig = async (config: AppConfig): Promise<void> => {
  try {
    await ensureFileExists(CONFIG_FILE)
    await fsPromises.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8')
  } catch (error) {
    const logger = getLogger()
    logger.error({ error }, 'Failed to save config file.')
    throw error // Re-throw to allow IPC handlers to catch it
  }
}

/**
 * Gets the global proxy configuration from the main config file.
 * @returns The global proxy configuration or null if not set.
 */
export const getGlobalProxy = async (): Promise<GlobalProxyConfig | null> => {
  const config = await getConfig()
  return config.proxy ?? null
}

/**
 * Gets the selected proxy index from config
 * @returns The selected proxy index or null for rotation
 */
export const getSelectedProxyIndex = async (): Promise<number | null> => {
  const config = await getConfig()
  return config.proxy?.selectedProxyIndex ?? null
}

/**
 * Sets the global proxy configuration in the main config file.
 * @param proxy The proxy configuration to set, or null to disable it.
 */
export const setGlobalProxy = async (proxy: GlobalProxyConfig | null): Promise<void> => {
  const config = await getConfig()
  config.proxy = proxy ?? undefined // Use undefined to ensure the key is removed if null
  await saveConfig(config)
}
