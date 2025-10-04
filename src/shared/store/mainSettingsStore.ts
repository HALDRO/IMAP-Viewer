/**
 * @file Main application settings store, now synced with the backend.
 * @description Store uses immer middleware to simplify nested state updates.
 * All state updates use mutable-looking syntax that Immer converts to immutable updates.
 */
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

export interface MainSettings {
  hideEventLogger: boolean
  autoLoginOnStartup: boolean
  compactAccountView: boolean
  debugMode: boolean
  minimizeToTray: boolean
}

interface MainSettingsState {
  settings: MainSettings
  isInitialized: boolean
  initializeSettings: () => Promise<void>
  updateSettings: (updates: Partial<MainSettings>) => Promise<void>
  resetSettings: () => Promise<void>
}

const defaultSettings: MainSettings = {
  hideEventLogger: false,
  autoLoginOnStartup: false,
  compactAccountView: false,
  debugMode: false,
  minimizeToTray: true,
}

export const useMainSettingsStore = create<MainSettingsState>()(
  immer((set, get) => ({
    settings: defaultSettings,
    isInitialized: false,

    /**
     * Fetches initial settings from the backend and marks the store as initialized.
     */
    initializeSettings: async () => {
      if (get().isInitialized) {
        return
      }
      try {
        const userConfig = await window.ipcApi.getUserConfig()
        const mergedSettings = { ...defaultSettings, ...userConfig }
        set(state => {
          state.settings = mergedSettings
          state.isInitialized = true
        })
      } catch (error) {
        console.error('[MainSettings] Failed to initialize:', error)
        // Even on error, mark as initialized to prevent re-fetching
        set(state => {
          state.isInitialized = true
        })
      }
    },

    /**
     * Updates settings both in the local state and on the backend.
     */
    updateSettings: async (updates: Partial<MainSettings>) => {
      const currentSettings = get().settings
      const newSettings = { ...currentSettings, ...updates }

      set(state => {
        state.settings = newSettings
      })

      try {
        await window.ipcApi.saveUserConfig(newSettings as unknown as Record<string, unknown>)

        // Notify main process about minimizeToTray changes
        if ('minimizeToTray' in updates) {
          window.ipcApi.notifyMinimizeToTrayChanged(updates.minimizeToTray ?? false)
        }
      } catch (error) {
        console.error('Failed to save settings to backend:', error)
        // Revert on failure
        set(state => {
          state.settings = currentSettings
        })
      }
    },

    /**
     * Resets settings to default and updates the backend.
     */
    resetSettings: async () => {
      set(state => {
        state.settings = defaultSettings
      })
      try {
        await window.ipcApi.saveUserConfig(defaultSettings as unknown as Record<string, unknown>)
      } catch (error) {
        console.error('Failed to save reset settings to backend:', error)
      }
    },
  }))
)
