import { create } from 'zustand';

type ViewType = 'email' | 'settings';

interface UIState {
  isSettingsOpen: boolean;
  currentView: ViewType;
  isLeftPanelHidden: boolean;
  leftPanelHiddenBeforeSettings: boolean; // Store previous state before opening settings

  // Panel states
  isLogPanelCollapsed: boolean;
  isAccountPanelCollapsed: boolean;

  // Panel sizes
  leftPanelWidth: number;
  rightPanelWidth: number;
  logPanelHeight: number;

  // Actions
  openSettings: () => void;
  closeSettings: () => void;
  setLeftPanelHidden: (hidden: boolean) => void;
  toggleLogPanel: () => void;
  setAccountPanelCollapsed: (collapsed: boolean) => void;
  setPanelSizes: (sizes: { leftPanelWidth?: number; rightPanelWidth?: number; logPanelHeight?: number }) => void;
  resetConfig: () => void;
  loadConfig: () => Promise<void>;
  saveConfig: () => Promise<void>;
}

const defaultState = {
  isSettingsOpen: false,
  currentView: 'email' as ViewType,
  isLeftPanelHidden: false,
  leftPanelHiddenBeforeSettings: false,
  isLogPanelCollapsed: false,
  isAccountPanelCollapsed: false,
  leftPanelWidth: 25,
  rightPanelWidth: 25,
  logPanelHeight: 25,
};

let isLoading = false; // Flag to prevent save during load
let saveConfigTimeout: NodeJS.Timeout | null = null; // Debounce timeout for config saving

// Debounced save function to prevent excessive saves during resize
const debouncedSaveConfig = (saveConfigFn: () => Promise<void>): void => {
  if (saveConfigTimeout) {
    clearTimeout(saveConfigTimeout);
  }
  saveConfigTimeout = setTimeout(() => {
    void saveConfigFn();
  }, 50); // 50ms delay for immediate responsiveness
};

// Load initial config synchronously if possible
const getInitialState = (): typeof defaultState => {
  try {
    // Try to load config synchronously from localStorage as fallback
    const savedConfig = localStorage.getItem('ui-config');
    if (savedConfig !== null && savedConfig !== undefined && savedConfig.length > 0) {
      const parsed = JSON.parse(savedConfig);
      return { ...defaultState, ...parsed };
    }
  } catch {
    // Silently fall back to defaults
  }
  return defaultState;
};

const initialState = getInitialState();

// Helper functions to reduce main function complexity
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createUIActions = (set: any, get: any): any => ({
  openSettings: (): void => {
    const currentState = get();
    set({
      isSettingsOpen: true,
      currentView: 'settings',
      leftPanelHiddenBeforeSettings: currentState.isLeftPanelHidden,
      isLeftPanelHidden: true
    });
  },
  closeSettings: (): void => {
    const currentState = get();
    set({
      isSettingsOpen: false,
      currentView: 'email',
      isLeftPanelHidden: currentState.leftPanelHiddenBeforeSettings
    });
  },

  setLeftPanelHidden: (hidden: boolean): void => {
    set({ isLeftPanelHidden: hidden });
    if (!isLoading) {
      debouncedSaveConfig(get().saveConfig);
    }
  },

  toggleLogPanel: (): void => {
    set((state: UIState) => ({ isLogPanelCollapsed: !state.isLogPanelCollapsed }));
    if (!isLoading) {
      debouncedSaveConfig(get().saveConfig);
    }
  },

  setAccountPanelCollapsed: (collapsed: boolean): void => {
    set({ isAccountPanelCollapsed: collapsed });
    if (!isLoading) {
      debouncedSaveConfig(get().saveConfig);
    }
  },

  setPanelSizes: (sizes: { leftPanelWidth?: number; rightPanelWidth?: number; logPanelHeight?: number }): void => {
    set((state: UIState) => {
      const newState: Partial<UIState> = {};
      let hasChanges = false;

      if (sizes.leftPanelWidth !== undefined && sizes.leftPanelWidth !== state.leftPanelWidth) {
        newState.leftPanelWidth = sizes.leftPanelWidth;
        hasChanges = true;
      }
      if (sizes.rightPanelWidth !== undefined && sizes.rightPanelWidth !== state.rightPanelWidth) {
        newState.rightPanelWidth = sizes.rightPanelWidth;
        hasChanges = true;
      }
      if (sizes.logPanelHeight !== undefined && sizes.logPanelHeight !== state.logPanelHeight) {
        newState.logPanelHeight = sizes.logPanelHeight;
        hasChanges = true;
      }

      if (hasChanges && !isLoading) {
        debouncedSaveConfig(get().saveConfig);
      }

      return hasChanges ? newState : {};
    });
  },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createConfigActions = (set: any, get: any): any => ({
  resetConfig: (): void => {
    set(initialState);
    void get().saveConfig();
  },

  loadConfig: async (): Promise<void> => {
    try {
      isLoading = true;
      const config = await window.ipcApi.getUserConfig();
      if (config !== null && config !== undefined && typeof config === 'object') {
        set({
          isLeftPanelHidden: config.isLeftPanelHidden ?? initialState.isLeftPanelHidden,
          isLogPanelCollapsed: config.isLogPanelCollapsed ?? initialState.isLogPanelCollapsed,
          isAccountPanelCollapsed: config.isAccountPanelCollapsed ?? initialState.isAccountPanelCollapsed,
          leftPanelWidth: config.leftPanelWidth ?? initialState.leftPanelWidth,
          rightPanelWidth: config.rightPanelWidth ?? initialState.rightPanelWidth,
          logPanelHeight: config.logPanelHeight ?? initialState.logPanelHeight,
        });
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to load UI config:', error);
    } finally {
      isLoading = false;
    }
  },

  saveConfig: async (): Promise<void> => {
    try {
      const state = get();
      await window.ipcApi.saveUserConfig({
        isLeftPanelHidden: state.isLeftPanelHidden,
        isLogPanelCollapsed: state.isLogPanelCollapsed,
        isAccountPanelCollapsed: state.isAccountPanelCollapsed,
        leftPanelWidth: state.leftPanelWidth,
        rightPanelWidth: state.rightPanelWidth,
        logPanelHeight: state.logPanelHeight,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to save UI config:', error);
    }
  },
});

export const useUIStore = create<UIState>((set, get) => ({
  ...initialState,

  ...createUIActions(set, get),


  ...createConfigActions(set, get),
}));