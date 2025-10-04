import { shell } from 'electron'
import type { BrowserWindow, IpcMain, WebContents } from 'electron'
import type { Logger } from 'pino'

import { getGlobalProxy } from '../services/configService'
import type { ProxyStatus } from '../shared/types/electron'

import { registerAccountHandlers } from './account'
import { registerBrowserHandlers } from './browser'
import { registerClipboardHandlers } from './clipboard'
import { registerConfigHandlers } from './config'
import { registerFileHandlers } from './files'
import { registerImapFlowHandlers } from './imapFlow'
import { registerProxyHandlers } from './proxy'

type SendProxyStatusFn = (_status: ProxyStatus, _details?: { ip?: string; error?: string }) => void

export interface RegisterHandlersArgs {
  ipcMain: IpcMain
  webContents: WebContents
  mainWindow: BrowserWindow
  logger: Logger
  sendProxyStatus: SendProxyStatusFn
  getBrowserView: () => import('electron').WebContentsView | null
  showBrowserView: (bounds?: { x: number; y: number; width: number; height: number }) => void
  hideBrowserView: () => void
}

/**
 * @file Entry point for registering all IPC handlers.
 * It imports handlers from different files and registers them with the main process.
 */
export const registerIpcHandlers = ({
  ipcMain,
  webContents,
  mainWindow,
  logger,
  sendProxyStatus,
  getBrowserView,
  showBrowserView,
  hideBrowserView,
}: RegisterHandlersArgs): void => {
  // Register all handlers from the different modules
  registerAccountHandlers(ipcMain, mainWindow, logger)
  registerImapFlowHandlers(ipcMain, webContents, logger)
  registerProxyHandlers(sendProxyStatus)
  registerConfigHandlers(ipcMain, logger)
  registerFileHandlers(ipcMain, logger)
  registerClipboardHandlers(ipcMain, logger)
  registerBrowserHandlers(ipcMain, logger, getBrowserView)

  // Handle renderer ready signal
  ipcMain.handle('renderer:ready', async () => {
    // Initial proxy check on startup, once the renderer is ready to receive updates.
    const initialProxyConfig = await getGlobalProxy()
    if (initialProxyConfig?.enabled === true) {
      // Proxy connection test would be handled by proxy handlers
      sendProxyStatus('connecting')
    }
    logger.info('Renderer process is ready and listening for events.')
  })

  // Handle opening URLs in external browser
  ipcMain.handle('shell:open-external', async (_event, url: string) => {
    try {
      await shell.openExternal(url)
      logger.info(`Opened external URL: ${url}`)
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        `Failed to open external URL: ${url}`
      )
      throw error
    }
  })

  // Handle showing BrowserView
  ipcMain.handle(
    'browser:show',
    async (_event, bounds?: { x: number; y: number; width: number; height: number }) => {
      try {
        if (bounds) {
          logger.info(`[WebContentsView] Show WITH bounds: ${JSON.stringify(bounds)}`)
          if (bounds.y > 500) {
            logger.warn(
              '[WebContentsView] ⚠️ Suspiciously high Y coordinate! View may be off-screen!'
            )
          }
        } else {
          logger.info('[WebContentsView] Show WITHOUT bounds (useLayoutEffect will set them)')
        }

        showBrowserView(bounds)
        logger.info('[WebContentsView] Show command executed')
        return { success: true }
      } catch (error) {
        logger.error(
          { error: error instanceof Error ? error.message : String(error) },
          '[WebContentsView] Show failed'
        )
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    }
  )

  // Handle hiding BrowserView
  ipcMain.handle('browser:hide', async () => {
    try {
      hideBrowserView()
      logger.info('[WebContentsView] Hide command executed')
      return { success: true }
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        '[WebContentsView] Hide failed'
      )
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  // Handle clearing browser data - COMPREHENSIVE fingerprint removal
  // Clears ALL possible tracking vectors across BOTH browser partitions
  // This is a complete anti-fingerprinting operation covering:
  // - All storage types (cookies, cache, localStorage, IndexedDB, service workers)
  // - Authentication data (HTTP Auth credentials)
  // - Network caches (DNS resolver, host resolver)
  // - Code caches (compiled JavaScript/WASM)
  // - Persistent and session data across all partitions
  ipcMain.handle('browser:clear-data', async () => {
    try {
      const { session } = await import('electron')

      // Define all partitions used in the application
      const partitions = [
        'persist:webview', // Main in-app browser (WebContentsView)
        'persist:external-browser', // External browser windows (middle-click, Ctrl+Click)
      ]

      // Clear data for EACH partition independently
      for (const partitionName of partitions) {
        const browserSession = session.fromPartition(partitionName)

        // 1. Clear ALL storage data types (most comprehensive operation)
        // Note: 'appcache' removed - deprecated and not in Electron 38 types
        await browserSession.clearStorageData({
          storages: [
            'cookies', // HTTP cookies (session + persistent)
            'filesystem', // Filesystem API data
            'indexdb', // IndexedDB databases
            'localstorage', // localStorage data
            'shadercache', // WebGL shader cache (fingerprinting vector)
            'websql', // WebSQL databases (deprecated but exists)
            'serviceworkers', // Service Worker registrations
            'cachestorage', // Cache API storage
          ],
          quotas: [
            'temporary', // Temporary storage quota (syncable not supported in Electron 38)
          ],
        })

        // 2. Clear HTTP cache (images, scripts, stylesheets, fonts, etc.)
        await browserSession.clearCache()

        // 3. Clear DNS/host resolver cache (network fingerprinting vector)
        await browserSession.clearHostResolverCache()

        // 4. Clear HTTP authentication cache (stored Basic Auth credentials)
        await browserSession.clearAuthCache()

        // 5. Clear compiled code caches (V8 JavaScript/WebAssembly)
        // This removes compiled bytecode that could persist across sessions
        await browserSession.clearCodeCaches({ urls: [] })

        logger.info(`[${partitionName}] All browser data and fingerprints cleared`)
      }

      logger.info('Complete browser data clearing finished for all partitions')
      return { success: true }
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to clear browser data'
      )
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  })
}
