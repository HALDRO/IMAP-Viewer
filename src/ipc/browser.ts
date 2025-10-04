/**
 * @file IPC handlers for WebContentsView management
 * @description Provides communication bridge between renderer process (InAppBrowser component)
 * and main process WebContentsView. Handles navigation, bounds management, state queries, and proxy configuration.
 * This uses the latest Electron API (WebContentsView) replacing deprecated BrowserView and <webview>.
 */
import type { IpcMain, WebContentsView } from 'electron'
import type { Logger } from 'pino'

import { getGlobalProxy } from '../services/configService'

export const registerBrowserHandlers = (
  ipcMain: IpcMain,
  logger: Logger,
  getBrowserView: () => WebContentsView | null
): void => {
  // Navigate to URL
  ipcMain.handle('browser:navigate', async (_event, url: string) => {
    try {
      const view = getBrowserView()
      if (!view) {
        throw new Error('WebContentsView not initialized')
      }

      // Background color is automatically set in did-start-loading event (main.ts)
      await view.webContents.loadURL(url)
      logger.info(`[WebContentsView] Navigated to: ${url}`)
      return { success: true }
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        '[WebContentsView] Navigation failed'
      )
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  // Go back in history
  ipcMain.handle('browser:go-back', async () => {
    try {
      const view = getBrowserView()
      if (!view) {
        throw new Error('WebContentsView not initialized')
      }

      if (view.webContents.canGoBack()) {
        view.webContents.goBack()
        logger.info('[WebContentsView] Navigated back')
      }
      return { success: true }
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        '[WebContentsView] Go back failed'
      )
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  // Go forward in history
  ipcMain.handle('browser:go-forward', async () => {
    try {
      const view = getBrowserView()
      if (!view) {
        throw new Error('WebContentsView not initialized')
      }

      if (view.webContents.canGoForward()) {
        view.webContents.goForward()
        logger.info('[WebContentsView] Navigated forward')
      }
      return { success: true }
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        '[WebContentsView] Go forward failed'
      )
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  // Reload current page
  ipcMain.handle('browser:reload', async () => {
    try {
      const view = getBrowserView()
      if (!view) {
        throw new Error('WebContentsView not initialized')
      }

      view.webContents.reload()
      logger.info('[WebContentsView] Reloaded')
      return { success: true }
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        '[WebContentsView] Reload failed'
      )
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  // Stop loading
  ipcMain.handle('browser:stop', async () => {
    try {
      const view = getBrowserView()
      if (!view) {
        throw new Error('WebContentsView not initialized')
      }

      view.webContents.stop()
      logger.info('[WebContentsView] Stopped loading')
      return { success: true }
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        '[WebContentsView] Stop failed'
      )
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  // Set bounds (position and size)
  ipcMain.handle(
    'browser:set-bounds',
    async (_event, bounds: { x: number; y: number; width: number; height: number }) => {
      try {
        const view = getBrowserView()
        if (!view) {
          throw new Error('WebContentsView not initialized')
        }

        // Get current bounds before updating
        const currentBounds = view.getBounds()

        view.setBounds(bounds)

        logger.info(
          `[WebContentsView] Bounds: ${JSON.stringify(currentBounds)} → ${JSON.stringify(bounds)}`
        )

        // Warn if bounds look suspicious
        if (bounds.width <= 0 || bounds.height <= 0) {
          logger.warn('[WebContentsView] ⚠️ WARNING: ZERO or NEGATIVE dimensions!')
        }
        if (bounds.y > 2000) {
          logger.warn('[WebContentsView] ⚠️ WARNING: View positioned FAR BELOW screen!')
        }

        return { success: true }
      } catch (error) {
        logger.error(
          { error: error instanceof Error ? error.message : String(error) },
          '[WebContentsView] Set bounds failed'
        )
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    }
  )

  // Get current URL
  ipcMain.handle('browser:get-url', async () => {
    try {
      const view = getBrowserView()
      if (!view) {
        return { success: false, url: null, error: 'WebContentsView not initialized' }
      }

      const url = view.webContents.getURL()
      return { success: true, url }
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        '[WebContentsView] Get URL failed'
      )
      return {
        success: false,
        url: null,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  // Get navigation state (canGoBack, canGoForward)
  ipcMain.handle('browser:get-navigation-state', async () => {
    try {
      const view = getBrowserView()
      if (!view) {
        return {
          success: false,
          canGoBack: false,
          canGoForward: false,
          error: 'WebContentsView not initialized',
        }
      }

      const canGoBack = view.webContents.canGoBack()
      const canGoForward = view.webContents.canGoForward()
      return { success: true, canGoBack, canGoForward }
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        '[WebContentsView] Get navigation state failed'
      )
      return {
        success: false,
        canGoBack: false,
        canGoForward: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  // Update proxy configuration for browser session
  ipcMain.handle('browser:update-proxy', async () => {
    try {
      const view = getBrowserView()
      if (!view) {
        throw new Error('WebContentsView not initialized')
      }

      const proxyConfig = await getGlobalProxy()
      const session = view.webContents.session

      if (!proxyConfig?.enabled || !proxyConfig.hostPort) {
        // Clear proxy (direct connection)
        await session.setProxy({ mode: 'direct' })
        logger.info('[WebContentsView] Proxy disabled, using direct connection')
        return { success: true, proxyEnabled: false }
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

      logger.info(`[WebContentsView] Proxy updated: ${proxyConfig.type}://${proxyConfig.hostPort}`)
      return {
        success: true,
        proxyEnabled: true,
        proxy: `${proxyConfig.type}://${proxyConfig.hostPort}`,
      }
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        '[WebContentsView] Update proxy failed'
      )
      return {
        success: false,
        proxyEnabled: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  logger.info('[IPC] Browser handlers registered')
}
