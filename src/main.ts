/**
 * @file Electron main process - application entry point, window and WebContentsView management
 * @description Main Electron process responsible for:
 * - Creating and managing main application window with security configuration (default: 1280x900, minimum: 900x700)
 * - Managing WebContentsView for modern in-app browsing (latest Electron API)
 * - Handling external link navigation via preload-browser.ts: middle-click or Ctrl+Click opens links in new independent BrowserWindow
 * - Regular clicks on target="_blank" links navigate in current view (not new window)
 * - Setting up IPC communication between renderer and main processes
 * - Initializing logger and services (IMAP, proxy, config)
 * - Preventing unauthorized navigation and securing window opening
 * - Managing application lifecycle (minimize to tray, quit handling)
 * - System tray integration with context menu
 *
 * Architecture for link handling:
 * - preload-browser.ts intercepts clicks in WebContentsView, detects modifiers (middle-click, Ctrl, Shift)
 * - Sends IPC message 'browser:open-external-window' to main process for modified clicks
 * - Main process creates independent BrowserWindow for external links
 * - setWindowOpenHandler navigates target="_blank" links in current view (fixes disposition ambiguity)
 *
 * Anti-fingerprinting security architecture:
 * - WebRTC IP leak protection via 'default_public_interface_only' policy (prevents real IP exposure through proxy)
 * - WebRTC API remains functional to avoid fraud detection (modern browsers ALWAYS have WebRTC)
 * - Isolated partitions for main browser and external windows (prevents cross-context tracking)
 * - Context isolation, web security, and CSP enforcement across all browser contexts
 *
 * Provides context isolation, web content security, and integration with system services via IPC.
 * WebContentsView (replaces deprecated BrowserView and <webview>) runs in separate process for superior security.
 * External browser windows are created dynamically for links opened with middle-click or keyboard modifiers (Ctrl, Shift).
 * Minimum window size enforces desktop-only layout without mobile responsive breakpoints.
 */

// Disable SSL certificate validation globally for IMAP connections through proxy
// This is necessary because proxies may not forward certificates correctly
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  BrowserWindow,
  type Event,
  Menu,
  Tray,
  WebContentsView,
  app,
  ipcMain,
  nativeImage,
} from 'electron'

import { registerIpcHandlers } from './ipc'
import { getConfig, getGlobalProxy } from './services/configService'
import { imapFlowConnectionManager } from './services/connectionManager'
import { getLogger, initializeLogger, logFromRenderer } from './services/logger'
import type { MainSettings } from './shared/store/mainSettingsStore'
import type { ProxyStatus } from './shared/types/electron'

// Logger will be initialized after window is ready
let logger: ReturnType<typeof getLogger> | null = null

// Vite environment variables
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined
declare const MAIN_WINDOW_VITE_NAME: string

// Node.js globals for Electron main process
const __dirname = path.dirname(fileURLToPath(import.meta.url))

let mainWindow: BrowserWindow | null = null
let browserView: WebContentsView | null = null // Modern WebContentsView (replaces BrowserView and <webview>)
let tray: Tray | null = null
let isQuitting = false
let minimizeToTrayEnabled = false // Cached setting for synchronous access
let lastBlurTime = 0 // Track when window lost focus (for taskbar click detection)

// Global error handlers to prevent app crashes
process.on('uncaughtException', (error: Error) => {
  if (logger) {
    logger.error({ error, stack: error.stack }, 'Uncaught Exception in main process')
  } else {
    console.error('Uncaught Exception in main process:', error)
  }
  // Don't exit the process - just log the error
})

process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  if (logger) {
    logger.error({ reason, promise }, 'Unhandled Promise Rejection in main process')
  } else {
    console.error('Unhandled Promise Rejection in main process:', reason)
  }
  // Don't exit the process - just log the error
})

/**
 * Configures proxy for browser session based on global proxy settings
 */
const configureBrowserProxy = async (view: WebContentsView): Promise<void> => {
  try {
    const proxyConfig = await getGlobalProxy()
    const session = view.webContents.session

    if (!proxyConfig?.enabled || !proxyConfig.hostPort) {
      // Clear proxy (direct connection)
      await session.setProxy({ mode: 'direct' })
      if (logger) {
        logger.info('[WebContentsView] Proxy disabled, using direct connection')
      }
      return
    }

    // Build proxy URL
    const authPart =
      proxyConfig.auth && proxyConfig.username
        ? `${encodeURIComponent(proxyConfig.username)}:${encodeURIComponent(proxyConfig.password || '')}@`
        : ''
    const proxyUrl = `${proxyConfig.type}://${authPart}${proxyConfig.hostPort}`

    // Apply proxy to session
    await session.setProxy({
      mode: 'fixed_servers',
      proxyRules: proxyUrl,
      proxyBypassRules: 'localhost,127.0.0.1,<local>',
    })

    if (logger) {
      logger.info(
        `[WebContentsView] Proxy configured: ${proxyConfig.type}://${proxyConfig.hostPort}`
      )
    }
  } catch (error) {
    if (logger) {
      logger.error({ error }, '[WebContentsView] Failed to configure proxy')
    }
  }
}

/**
 * Creates a new browser window for external links (opened via middle click or Ctrl+Click)
 * This window is independent from the main app and provides basic browser functionality
 */
const createExternalBrowserWindow = (url: string): void => {
  const externalWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      partition: 'persist:external-browser', // Separate partition for external windows
      // WebRTC IP leak protection (same as main browser)
      // @ts-expect-error - webRTCIPHandlingPolicy not yet in Electron types but fully supported
      webRTCIPHandlingPolicy: 'default_public_interface_only',
    },
  })

  // Set window title
  externalWindow.setTitle('Browser')

  // Load the URL
  void externalWindow.loadURL(url)

  // Update window title when page loads
  externalWindow.webContents.on('page-title-updated', (_event, title) => {
    externalWindow.setTitle(title || 'Browser')
  })

  // Handle new window requests in external browser window
  externalWindow.webContents.setWindowOpenHandler(({ url: newUrl, disposition }) => {
    if (logger) {
      logger.info(`[ExternalBrowser] New window requested: ${newUrl}, disposition: ${disposition}`)
    }

    const shouldOpenInNewWindow =
      disposition === 'foreground-tab' ||
      disposition === 'background-tab' ||
      disposition === 'new-window'

    if (shouldOpenInNewWindow && (newUrl.startsWith('http://') || newUrl.startsWith('https://'))) {
      // Recursively create another external browser window
      createExternalBrowserWindow(newUrl)
      return { action: 'deny' }
    }

    // Default behavior: allow opening in same window
    if (newUrl.startsWith('http://') || newUrl.startsWith('https://')) {
      return { action: 'allow' }
    }

    return { action: 'deny' }
  })

  // Prevent navigation to non-http(s) URLs
  externalWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const url = new URL(navigationUrl)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      event.preventDefault()
      if (logger) {
        logger.warn(`[ExternalBrowser] Blocked navigation to: ${navigationUrl}`)
      }
    }
  })

  if (logger) {
    logger.info(`[ExternalBrowser] Created new window for: ${url}`)
  }
}

/**
 * Creates and configures WebContentsView for in-app browser
 * WebContentsView is the latest Electron API (replaces BrowserView and <webview>)
 */
const createBrowserView = (): WebContentsView => {
  const view = new WebContentsView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      partition: 'persist:webview', // Same partition as old webview for data consistency
      preload: path.join(__dirname, 'preload-browser.js'), // Inject click handler for middle-click detection
      // WebRTC IP leak protection: force traffic through proxy, prevent direct connections
      // This keeps WebRTC API available (for anti-fingerprinting) but prevents real IP exposure
      // 'default_public_interface_only' = only use IPs visible to the public internet (proxy IP)
      // This is superior to disabling WebRTC entirely, which would trigger fraud detection
      // @ts-expect-error - webRTCIPHandlingPolicy not yet in Electron types but fully supported
      webRTCIPHandlingPolicy: 'default_public_interface_only',
    },
  })

  // Set white background to prevent black screen during page load
  view.setBackgroundColor('#ffffff')

  // Configure proxy for browser session
  void configureBrowserProxy(view)

  // Load about:blank immediately to force background rendering
  // This fixes the gray/black screen issue when showing/hiding the view
  // See: https://github.com/electron/electron/issues/47351
  void view.webContents.loadURL('about:blank').catch(err => {
    if (logger) {
      logger.error({ error: err }, '[WebContentsView] Failed to load about:blank')
    }
  })

  // Handle navigation events
  view.webContents.on('did-start-loading', () => {
    // Re-apply white background on every navigation to prevent gray/black flash
    // Chromium can reset backgroundColor during navigation, so we force it back
    view.setBackgroundColor('#ffffff')
    mainWindow?.webContents.send('browser:did-start-loading')
  })

  view.webContents.on('did-stop-loading', () => {
    mainWindow?.webContents.send('browser:did-stop-loading')
  })

  // Inject custom CSS for text selection styling
  view.webContents.on('did-finish-load', () => {
    view.webContents
      .insertCSS(
        '::selection { background: rgb(127, 38, 217) !important; color: rgb(255, 255, 255) !important; }'
      )
      .catch(err => {
        if (logger) {
          logger.error({ error: err }, '[WebContentsView] Failed to inject selection CSS')
        }
      })
  })

  view.webContents.on('did-navigate', (_event, url) => {
    const canGoBack = view.webContents.canGoBack()
    const canGoForward = view.webContents.canGoForward()
    mainWindow?.webContents.send('browser:did-navigate', { url, canGoBack, canGoForward })
  })

  view.webContents.on('did-navigate-in-page', (_event, url) => {
    const canGoBack = view.webContents.canGoBack()
    const canGoForward = view.webContents.canGoForward()
    mainWindow?.webContents.send('browser:did-navigate-in-page', { url, canGoBack, canGoForward })
  })

  view.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (isMainFrame) {
        mainWindow?.webContents.send('browser:did-fail-load', {
          errorCode,
          errorDescription,
          validatedURL,
        })
      }
    }
  )

  view.webContents.on('did-finish-load', () => {
    mainWindow?.webContents.send('browser:did-finish-load')
  })

  // Handle new window requests (target="_blank" links)
  // NOTE: Middle-click and Ctrl+Click are handled by preload-browser.ts via IPC
  // This handler only processes regular clicks on target="_blank" links
  view.webContents.setWindowOpenHandler(({ url, disposition }) => {
    if (logger) {
      logger.info(`[BrowserView] New window requested: ${url}, disposition: ${disposition}`)
    }

    // ALWAYS navigate in current view instead of opening new window
    // Reasoning: disposition doesn't reliably distinguish between:
    // - Regular click on target="_blank" (disposition: 'foreground-tab')
    // - Middle-click (disposition: 'foreground-tab')
    // - Ctrl+Click (disposition: 'foreground-tab')
    // So preload-browser.ts handles middle-click/Ctrl+Click via IPC
    if (url.startsWith('http://') || url.startsWith('https://')) {
      void view.webContents.loadURL(url)
    }
    return { action: 'deny' }
  })

  // Handle redirects
  view.webContents.on('will-redirect', (_event, url) => {
    mainWindow?.webContents.send('browser:will-redirect', { url })
  })

  return view
}

/**
 * Shows WebContentsView by moving it into visible area
 * WebContentsView is ALWAYS attached to window - never removed
 * This prevents re-rendering and black screen issues
 */
const showBrowserView = (bounds?: {
  x: number
  y: number
  width: number
  height: number
}): void => {
  if (!mainWindow) return

  // Create and attach view ONCE on first show
  if (!browserView) {
    browserView = createBrowserView()
    mainWindow.contentView.addChildView(browserView)
    browserView.setBackgroundColor('#ffffff')

    if (logger) {
      logger.info('[WebContentsView] Browser view created and attached')
    }
  }

  // Move view into visible area
  if (bounds) {
    browserView.setBounds(bounds)
    if (logger) {
      logger.info(`[WebContentsView] Moved to visible area: ${JSON.stringify(bounds)}`)
    }
  }
}

/**
 * Hides WebContentsView by moving it off-screen
 * View remains attached to preserve state (session, cookies, navigation)
 */
const hideBrowserView = (): void => {
  if (!mainWindow || !browserView) return

  // Move off-screen instead of removing from tree
  // This preserves rendering state and prevents black screen on re-show
  browserView.setBounds({ x: 0, y: 10000, width: 1, height: 1 })

  if (logger) {
    logger.info('[WebContentsView] Moved off-screen (state preserved)')
  }
}

/**
 * Destroys WebContentsView completely
 */
const destroyBrowserView = (): void => {
  if (browserView) {
    // WebContentsView cleanup - close webContents and remove from parent
    if (mainWindow) {
      mainWindow.contentView.removeChildView(browserView)
    }
    browserView.webContents.close()
    browserView = null

    if (logger) {
      logger.info('[WebContentsView] Browser view destroyed')
    }
  }
}

const createWindow = (): void => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 900,
    minHeight: 700,
    autoHideMenuBar: true, // Hide system menu (File, Edit, View)
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // webviewTag removed - using modern BrowserView API instead
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true, // Enable security to prevent XSS
      allowRunningInsecureContent: false, // Disable insecure content
    },
  })

  // Prevent navigation in main window ONLY (allow iframe navigation)
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    // Check if this is the main frame
    // In Electron, if navigation occurs in iframe, we should allow it
    const isMainFrame = event.frame === mainWindow?.webContents.mainFrame || !event.frame

    // Allow navigation in iframe (child frames)
    if (!isMainFrame) {
      if (logger) {
        logger.info(`[ELECTRON] Allowing iframe navigation: ${navigationUrl}`)
      }
      return
    }

    // For main frame: allow only navigation to our own app URLs
    if (
      typeof MAIN_WINDOW_VITE_DEV_SERVER_URL === 'string' &&
      navigationUrl.startsWith(MAIN_WINDOW_VITE_DEV_SERVER_URL)
    ) {
      if (logger) {
        logger.info(`[ELECTRON] Allowing dev server navigation: ${navigationUrl}`)
      }
      return
    }

    // Block all other navigation attempts in main window
    if (logger) {
      logger.info(`[ELECTRON] Blocking main frame navigation: ${navigationUrl}`)
    }
    event.preventDefault()
  })

  // Prevent opening new windows from main frame (but allow from iframe with proper config)
  mainWindow.webContents.setWindowOpenHandler(() => {
    // Block all attempts to open new windows
    // OAuth flows and external links should use our shell:open-external IPC handler
    return { action: 'deny' }
  })

  // Load error logging (for diagnostics)
  mainWindow.webContents.on(
    'did-fail-load',
    (_event, errorCode, _errorDescription, validatedURL, isMainFrame) => {
      // Log only main frame errors (webview handles its own errors)
      if (isMainFrame && logger) {
        logger.info(
          `[ELECTRON] Main frame load failed: errorCode=${errorCode}, url=${validatedURL}`
        )
      }
    }
  )

  // and load the index.html of the app.
  if (
    typeof MAIN_WINDOW_VITE_DEV_SERVER_URL === 'string' &&
    MAIN_WINDOW_VITE_DEV_SERVER_URL.length > 0
  ) {
    void mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
  } else {
    void mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    )
  }

  // DevTools can be enabled by uncommenting the line below
  // mainWindow?.webContents.openDevTools()

  // Track window blur to distinguish taskbar click from minimize button click
  mainWindow.on('blur', () => {
    lastBlurTime = Date.now()
  })

  // Handle window minimize - hide to tray if enabled (except taskbar clicks)
  // @ts-expect-error - 'minimize' event exists in Electron but missing in types
  mainWindow.on('minimize', (event: Event) => {
    const timeSinceBlur = Date.now() - lastBlurTime
    const isTaskbarClick = timeSinceBlur < 100

    if (minimizeToTrayEnabled && !isTaskbarClick) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  // Handle window close - hide to tray if enabled (instead of closing)
  mainWindow.on('close', event => {
    if (!isQuitting && minimizeToTrayEnabled) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

/**
 * Gets the correct path to icon based on environment (dev vs packaged)
 */
const getIconPath = (): string => {
  const iconName = process.platform === 'win32' ? 'icon.ico' : 'icon.png'

  if (app.isPackaged) {
    // In packaged app, icons are copied next to executable
    return path.join(process.resourcesPath, iconName)
  }

  // In development mode, use public folder
  return path.join(__dirname, '../../public', iconName)
}

const createTray = (): void => {
  const iconPath = getIconPath()

  const trayIcon = nativeImage.createFromPath(iconPath)

  if (trayIcon.isEmpty()) {
    if (logger) {
      logger.warn(`[TRAY] Failed to load icon from: ${iconPath}`)
    }
    return
  }

  // Resize icon for tray if needed (Windows prefers 16x16)
  const resizedIcon =
    process.platform === 'win32' ? trayIcon.resize({ width: 16, height: 16 }) : trayIcon

  tray = new Tray(resizedIcon)
  tray.setToolTip('IMAP Viewer')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Window',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        }
      },
    },
    {
      label: 'Hide Window',
      click: () => {
        mainWindow?.hide()
      },
    },
    { type: 'separator' },
    {
      label: 'Exit',
      click: () => {
        isQuitting = true
        app.quit()
      },
    },
  ])

  tray.setContextMenu(contextMenu)

  // Double-click on tray icon shows window
  tray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide()
      } else {
        mainWindow.show()
        mainWindow.focus()
      }
    }
  })
}

// Helper to send proxy status updates
const sendProxyStatus = (
  status: ProxyStatus,
  details: { ip?: string; error?: string } = {}
): void => {
  if (mainWindow) {
    mainWindow.webContents.send('proxy:status-update', { status, ...details })
  }
}

/**
 * Loads and caches the minimizeToTray setting
 */
const loadMinimizeToTraySetting = async (): Promise<void> => {
  try {
    const config = await getConfig()
    const userSettings = config.mainSettings as MainSettings | undefined
    minimizeToTrayEnabled = userSettings?.minimizeToTray ?? true
  } catch {
    minimizeToTrayEnabled = true
  }
}

// App Initialization - called when Electron finishes initialization
void app.whenReady().then(async () => {
  // 1. Load minimize to tray setting BEFORE creating window (logger not ready yet)
  await loadMinimizeToTraySetting()

  // 2. Create window with correct minimizeToTrayEnabled value
  createWindow()

  // 3. Create tray icon
  createTray()

  // 4. Initialize logger
  if (mainWindow) {
    await initializeLogger(mainWindow)
    logger = getLogger()

    // Listen for settings updates
    ipcMain.on('settings:minimize-to-tray-changed', (_event, enabled: boolean) => {
      minimizeToTrayEnabled = enabled
    })

    // Listen for renderer logs
    ipcMain.on(
      'log:renderer',
      (_event, log: { level: 'info' | 'warn' | 'error'; message: string; context?: object }) => {
        const { level, message, context } = log
        logFromRenderer(level, message, context)
      }
    )

    // Handle open external window request from WebContentsView preload script
    // This is triggered when user middle-clicks or Ctrl+Clicks on a link
    ipcMain.on('browser:open-external-window', (_event, url: string) => {
      if (logger) {
        logger.info(`[IPC] Request to open external window: ${url}`)
      }
      createExternalBrowserWindow(url)
    })

    // Register IPC handlers
    registerIpcHandlers({
      ipcMain,
      webContents: mainWindow.webContents,
      mainWindow,
      logger,
      sendProxyStatus,
      getBrowserView: () => browserView,
      showBrowserView,
      hideBrowserView,
    })
  }
})

// Handle before-quit to set quitting flag and cleanup
app.on('before-quit', () => {
  isQuitting = true

  // Cleanup BrowserView
  destroyBrowserView()

  // Cleanup tray icon
  if (tray) {
    tray.destroy()
    tray = null
  }
})

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    void imapFlowConnectionManager.endAll()
    app.quit()
  }
})

// On macOS, re-create window when dock icon is clicked
app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})

// Additional main process code can be added here or in separate files
