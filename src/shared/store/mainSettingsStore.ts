/**
 * @file Main application settings store
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface MainSettings {
  // Logger settings
  hideEventLogger: boolean;

  // Auto-login settings
  autoLoginOnStartup: boolean;

  // Interface settings
  compactAccountView: boolean;

  // Debug settings
  debugMode: boolean;

  // Future settings can be added here
  // theme: 'light' | 'dark' | 'system';
  // language: string;
  // notifications: boolean;
}

interface MainSettingsState {
  settings: MainSettings;

  // Actions
  updateSettings: (updates: Partial<MainSettings>) => void;
  resetSettings: () => void;

  // Individual setting updaters for convenience
  setHideEventLogger: (hide: boolean) => void;
  setAutoLoginOnStartup: (autoLogin: boolean) => void;
  setCompactAccountView: (compact: boolean) => void;
  setDebugMode: (debug: boolean) => void;
}

const defaultSettings: MainSettings = {
  hideEventLogger: false,
  autoLoginOnStartup: false,
  compactAccountView: false,
  debugMode: false,
};

export const useMainSettingsStore = create<MainSettingsState>()(
  persist(
    (set, get) => ({
      settings: defaultSettings,
      
      updateSettings: (updates: Partial<MainSettings>) => {
        set((state) => ({
          settings: { ...state.settings, ...updates }
        }));
      },
      
      resetSettings: () => {
        set({ settings: defaultSettings });
      },
      
      setHideEventLogger: (hide: boolean) => {
        get().updateSettings({ hideEventLogger: hide });
      },
      
      setAutoLoginOnStartup: (autoLogin: boolean) => {
        get().updateSettings({ autoLoginOnStartup: autoLogin });
      },

      setCompactAccountView: (compact: boolean) => {
        get().updateSettings({ compactAccountView: compact });
      },

      setDebugMode: (debug: boolean) => {
        get().updateSettings({ debugMode: debug });
      },
    }),
    {
      name: 'main-settings-storage',
      version: 1,
    }
  )
);
