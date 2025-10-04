import { create } from 'zustand'

type ViewType = 'email' | 'settings'

interface UIData {
  isSettingsOpen: boolean
  currentView: ViewType
  isLeftPanelCollapsed: boolean
  leftPanelCollapsedBeforeSettings: boolean // Store previous state before opening settings

  // Panel states
  isLogPanelCollapsed: boolean
  isAccountPanelCollapsed: boolean

  // Panel sizes
  leftPanelWidth: number
  rightPanelWidth: number
  logPanelHeight: number

  // Settings state
  settingsTab: 'main' | 'proxy'

  // Browser state
  browserUrl: string | null
  isBrowserOpen: boolean
  isBrowserMinimized: boolean

  // Overlay management - tracks active UI overlays to hide WebContentsView when needed
  activeOverlays: Set<string> // Set of overlay IDs (dialogs, tooltips, settings)
  isWebContentsViewVisible: boolean // Computed: browser open AND no overlays
}

interface UIActions {
  openSettings: (tab?: 'main' | 'proxy') => void
  closeSettings: () => void
  setSettingsTab: (tab: 'main' | 'proxy') => void
  setLeftPanelCollapsed: (collapsed: boolean) => void
  toggleLogPanel: () => void
  setLogPanelCollapsed: (collapsed: boolean) => void
  setAccountPanelCollapsed: (collapsed: boolean) => void
  setPanelSizes: (sizes: {
    leftPanelWidth?: number
    rightPanelWidth?: number
    logPanelHeight?: number
  }) => void
  openBrowser: (url?: string) => void
  closeBrowser: () => void
  minimizeBrowser: () => void
  maximizeBrowser: () => void
  toggleBrowser: (url?: string) => void
  resetConfig: () => void
  loadConfig: () => Promise<void>
  saveConfig: () => Promise<void>

  // Overlay management methods
  registerOverlay: (overlayId: string) => void
  unregisterOverlay: (overlayId: string) => void
  hasActiveOverlays: () => boolean
}

interface UIState extends UIData, UIActions {}

const defaultState = {
  isSettingsOpen: false,
  currentView: 'email' as ViewType,
  isLeftPanelCollapsed: false,
  leftPanelCollapsedBeforeSettings: false,
  isLogPanelCollapsed: true,
  isAccountPanelCollapsed: false,
  leftPanelWidth: 25,
  rightPanelWidth: 25,
  logPanelHeight: 15,
  browserUrl: null,
  isBrowserOpen: false,
  isBrowserMinimized: false,
  settingsTab: 'main' as 'main' | 'proxy',
  activeOverlays: new Set<string>(),
  isWebContentsViewVisible: false, // Browser visible AND no overlays active
}

let isLoading = false // Flag to prevent save during load
let saveConfigTimeout: NodeJS.Timeout | null = null // Debounce timeout for config saving

// Debounced save function with trailing save guarantee
const debouncedSaveConfig = (saveConfigFn: () => Promise<void>): void => {
  if (saveConfigTimeout) {
    clearTimeout(saveConfigTimeout)
  }
  saveConfigTimeout = setTimeout(() => {
    void saveConfigFn()
  }, 200) // 200ms delay for better performance, guarantees last value
}

// Load initial config synchronously if possible
const getInitialState = (): typeof defaultState => {
  try {
    // Try to load config synchronously from localStorage as fallback
    const savedConfig = localStorage.getItem('ui-config')
    if (savedConfig !== null && savedConfig !== undefined && savedConfig.length > 0) {
      const parsed = JSON.parse(savedConfig)
      const merged = { ...defaultState, ...parsed }
      // Ensure settingsTab is always valid
      if (
        !merged.settingsTab ||
        (merged.settingsTab !== 'main' && merged.settingsTab !== 'proxy')
      ) {
        merged.settingsTab = 'main'
      }
      return merged
    }
  } catch {
    // Silently fall back to defaults
  }
  return defaultState
}

const initialState = getInitialState()

// Helper functions to reduce main function complexity
const createUIActions = (
  set: (partial: Partial<UIState> | ((state: UIState) => Partial<UIState>)) => void,
  get: () => UIState
) => ({
  openSettings: (tab?: 'main' | 'proxy'): void => {
    const currentState = get()
    // Determine selected tab: use provided tab, or validate current tab, or default to 'main'
    let selectedTab: 'main' | 'proxy' = 'main'

    if (tab) {
      selectedTab = tab
    } else if (currentState.settingsTab === 'main' || currentState.settingsTab === 'proxy') {
      selectedTab = currentState.settingsTab
    }

    set({
      isSettingsOpen: true,
      currentView: 'settings',
      leftPanelCollapsedBeforeSettings: currentState.isLeftPanelCollapsed,
      settingsTab: selectedTab,
    })
    // Register settings as active overlay
    get().registerOverlay('settings')
  },
  setSettingsTab: (tab: 'main' | 'proxy'): void => {
    set({ settingsTab: tab })
  },
  closeSettings: (): void => {
    const currentState = get()
    set({
      isSettingsOpen: false,
      currentView: 'email',
      isLeftPanelCollapsed: currentState.leftPanelCollapsedBeforeSettings,
    })
    // Unregister settings overlay
    get().unregisterOverlay('settings')
  },

  setLeftPanelCollapsed: (collapsed: boolean): void => {
    set({ isLeftPanelCollapsed: collapsed })
    if (!isLoading) {
      debouncedSaveConfig(get().saveConfig)
    }
  },

  toggleLogPanel: (): void => {
    set((state: UIState) => ({ isLogPanelCollapsed: !state.isLogPanelCollapsed }))
    if (!isLoading) {
      debouncedSaveConfig(get().saveConfig)
    }
  },

  setLogPanelCollapsed: (collapsed: boolean): void => {
    set({ isLogPanelCollapsed: collapsed })
    if (!isLoading) {
      debouncedSaveConfig(get().saveConfig)
    }
  },

  setAccountPanelCollapsed: (collapsed: boolean): void => {
    set({ isAccountPanelCollapsed: collapsed })
    if (!isLoading) {
      debouncedSaveConfig(get().saveConfig)
    }
  },

  setPanelSizes: (sizes: {
    leftPanelWidth?: number
    rightPanelWidth?: number
    logPanelHeight?: number
  }): void => {
    set((state: UIState) => {
      const newState: Partial<UIState> = {}
      let hasChanges = false

      if (sizes.leftPanelWidth !== undefined && sizes.leftPanelWidth !== state.leftPanelWidth) {
        newState.leftPanelWidth = sizes.leftPanelWidth
        hasChanges = true
      }
      if (sizes.rightPanelWidth !== undefined && sizes.rightPanelWidth !== state.rightPanelWidth) {
        newState.rightPanelWidth = sizes.rightPanelWidth
        hasChanges = true
      }
      if (sizes.logPanelHeight !== undefined && sizes.logPanelHeight !== state.logPanelHeight) {
        // Validation: panel size should not be less than minimum (7)
        const minSize = 7
        const validatedSize = Math.max(sizes.logPanelHeight, minSize)
        newState.logPanelHeight = validatedSize
        hasChanges = true
      }

      if (hasChanges && !isLoading) {
        debouncedSaveConfig(get().saveConfig)
      }

      return hasChanges ? newState : {}
    })
  },

  openBrowser: (url?: string): void => {
    const currentState = get()

    // Always update URL if provided, regardless of browser state
    // If browser is already open but minimized, maximize it and load new URL
    if (currentState.isBrowserOpen && currentState.isBrowserMinimized) {
      const newUrl = url || currentState.browserUrl || 'https://www.google.com'
      const isWebContentsViewVisible = currentState.activeOverlays.size === 0 // Visible if no overlays
      set({
        isBrowserMinimized: false,
        browserUrl: newUrl,
        isWebContentsViewVisible,
      })
    } else if (currentState.isBrowserOpen && !currentState.isBrowserMinimized) {
      // Browser is already open and visible - update URL if provided
      if (url) {
        set({ browserUrl: url })
      }
      // If no URL provided, keep current state (browser stays on current page)
    } else {
      const newUrl = url || currentState.browserUrl || 'https://www.google.com'
      const isWebContentsViewVisible = currentState.activeOverlays.size === 0 // Visible if no overlays
      // Browser is closed, open it with the URL
      set({
        isBrowserOpen: true,
        isBrowserMinimized: false,
        browserUrl: newUrl,
        isWebContentsViewVisible,
      })
    }
  },

  closeBrowser: (): void => {
    set({
      isBrowserOpen: false,
      isBrowserMinimized: false,
      browserUrl: null,
      isWebContentsViewVisible: false, // Browser closed, not visible
    })
  },

  minimizeBrowser: (): void => {
    set({
      isBrowserMinimized: true,
      isWebContentsViewVisible: false, // Minimized = not visible
    })
  },

  maximizeBrowser: (): void => {
    const currentState = get()
    const isWebContentsViewVisible = currentState.activeOverlays.size === 0 // Visible if no overlays
    set({
      isBrowserMinimized: false,
      isWebContentsViewVisible,
    })
  },

  toggleBrowser: (url?: string): void => {
    const currentState = get()
    // If browser is open and not minimized, minimize it
    if (currentState.isBrowserOpen && !currentState.isBrowserMinimized) {
      set({
        isBrowserMinimized: true,
        isWebContentsViewVisible: false,
      })
    } else if (currentState.isBrowserOpen && currentState.isBrowserMinimized) {
      // If browser is minimized, maximize it
      const isWebContentsViewVisible = currentState.activeOverlays.size === 0
      set({
        isBrowserMinimized: false,
        isWebContentsViewVisible,
      })
    } else {
      // If browser is closed, open it
      const isWebContentsViewVisible = currentState.activeOverlays.size === 0
      set({
        isBrowserOpen: true,
        isBrowserMinimized: false,
        browserUrl: url || 'https://www.google.com',
        isWebContentsViewVisible,
      })
    }
  },
})

const createConfigActions = (set: (partial: Partial<UIState>) => void, get: () => UIState) => ({
  resetConfig: (): void => {
    set(initialState)
    void get().saveConfig()
  },

  loadConfig: async (): Promise<void> => {
    try {
      isLoading = true
      const config = await window.ipcApi.getUserConfig()
      if (
        config !== null &&
        config !== undefined &&
        typeof config === 'object' &&
        config !== null
      ) {
        const configObj = config as Record<string, unknown>
        const currentState = get()
        const loadedUISettings = {
          isLeftPanelCollapsed:
            typeof configObj.isLeftPanelCollapsed === 'boolean'
              ? configObj.isLeftPanelCollapsed
              : initialState.isLeftPanelCollapsed,
          isLogPanelCollapsed:
            typeof configObj.isLogPanelCollapsed === 'boolean'
              ? configObj.isLogPanelCollapsed
              : initialState.isLogPanelCollapsed,
          isAccountPanelCollapsed:
            typeof configObj.isAccountPanelCollapsed === 'boolean'
              ? configObj.isAccountPanelCollapsed
              : initialState.isAccountPanelCollapsed,
          leftPanelWidth:
            typeof configObj.leftPanelWidth === 'number'
              ? configObj.leftPanelWidth
              : initialState.leftPanelWidth,
          rightPanelWidth:
            typeof configObj.rightPanelWidth === 'number'
              ? configObj.rightPanelWidth
              : initialState.rightPanelWidth,
          logPanelHeight:
            typeof configObj.logPanelHeight === 'number'
              ? configObj.logPanelHeight
              : initialState.logPanelHeight,
          // Ensure settingsTab is preserved or set to default
          settingsTab: currentState.settingsTab || initialState.settingsTab,
        }
        set(loadedUISettings)
      }
    } catch (error) {
      console.error('Failed to load UI config:', error)
    } finally {
      isLoading = false
    }
  },

  saveConfig: async (): Promise<void> => {
    try {
      const state = get()
      await window.ipcApi.saveUserConfig({
        isLeftPanelCollapsed: state.isLeftPanelCollapsed,
        isLogPanelCollapsed: state.isLogPanelCollapsed,
        isAccountPanelCollapsed: state.isAccountPanelCollapsed,
        leftPanelWidth: state.leftPanelWidth,
        rightPanelWidth: state.rightPanelWidth,
        logPanelHeight: state.logPanelHeight,
      })
    } catch (error) {
      console.error('Failed to save UI config:', error)
    }
  },
})

/**
 * Creates overlay management actions
 * Manages WebContentsView visibility based on active overlays
 */
const createOverlayActions = (
  set: (partial: Partial<UIState> | ((state: UIState) => Partial<UIState>)) => void,
  get: () => UIState
) => ({
  registerOverlay: (overlayId: string): void => {
    set((state: UIState) => {
      const newOverlays = new Set(state.activeOverlays)
      newOverlays.add(overlayId)

      // Compute WebContentsView visibility: browser open, not minimized, AND no overlays
      const isWebContentsViewVisible =
        state.isBrowserOpen && !state.isBrowserMinimized && newOverlays.size === 0

      return {
        activeOverlays: newOverlays,
        isWebContentsViewVisible,
      }
    })
  },

  unregisterOverlay: (overlayId: string): void => {
    set((state: UIState) => {
      const newOverlays = new Set(state.activeOverlays)
      newOverlays.delete(overlayId)

      // Compute WebContentsView visibility
      const isWebContentsViewVisible =
        state.isBrowserOpen && !state.isBrowserMinimized && newOverlays.size === 0

      return {
        activeOverlays: newOverlays,
        isWebContentsViewVisible,
      }
    })
  },

  hasActiveOverlays: (): boolean => {
    return get().activeOverlays.size > 0
  },
})

export const useUIStore = create<UIState>((set, get) => ({
  ...initialState,

  ...createUIActions(set, get),

  ...createConfigActions(set, get),

  ...createOverlayActions(set, get),
}))
