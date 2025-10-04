/**
 * @file Modern in-app browser component using WebContentsView API
 * @description Uses latest Electron WebContentsView (replaces deprecated BrowserView and <webview>).
 * - Primary goal: Enable users to interact with email links without losing context
 * - WebContentsView runs in separate process (main) - superior security and stability
 * - All navigation handled via IPC - clean separation of concerns
 * - Target="_blank" links work natively - setWindowOpenHandler in main process
 * - State persists: Component ALWAYS mounted, WebContentsView moved off-screen when hidden
 * - Latest Electron API - no deprecated warnings, full future compatibility
 * Architecture: Renderer (always mounted, visibility via isVisible prop) → IPC → Main Process → WebContentsView
 * Uses semantic color coding: neutral grays for structure, accent colors for actions, warning colors for states.
 * CRITICAL: useLayoutEffect for synchronous bounds updates - prevents race conditions
 * CRITICAL: Component must remain mounted (no AnimatePresence) to preserve WebContentsView state (history, cookies, DOM)
 */
import { ArrowLeft, ArrowRight, ExternalLink, Home, Mail, RefreshCw } from 'lucide-react'
import type React from 'react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { useUIStore } from '../shared/store/uiStore'
import { Button } from '../shared/ui/button'
import { logger as appLogger } from '../shared/utils/logger'

interface InAppBrowserProps {
  initialUrl: string
  onUrlChange?: (url: string) => void
  isVisible?: boolean // Controls if browser should be visible (considers both open and minimized state)
}

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 2000

/**
 * Modern in-app browser using WebContentsView API
 */
const InAppBrowser: React.FC<InAppBrowserProps> = ({
  initialUrl,
  onUrlChange,
  isVisible = true,
}) => {
  const { minimizeBrowser } = useUIStore()
  const isWebContentsViewVisible = useUIStore(state => state.isWebContentsViewVisible)

  // UI State
  const [currentUrl, setCurrentUrl] = useState(initialUrl)
  const [addressBarUrl, setAddressBarUrl] = useState(initialUrl)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  // Refs for non-reactive values
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastLoadedUrlRef = useRef<string>(initialUrl)
  const containerRef = useRef<HTMLDivElement>(null)

  // This effect handles both initial navigation on mount and subsequent navigations
  // when the `initialUrl` prop changes from the parent component.
  useEffect(() => {
    appLogger.info(`[InAppBrowser] Navigation requested for: ${initialUrl}`)
    void window.ipcApi.browser.navigate(initialUrl)

    // Cleanup: move WebContentsView off-screen when component unmounts (app close)
    // Note: This won't run on mailbox/account switches as component stays mounted
    return () => {
      void window.ipcApi.browser.hide()
    }
  }, [initialUrl])

  // Synchronously update WebContentsView bounds - runs AFTER DOM updates, BEFORE browser paint
  // This prevents race conditions and visual glitches
  // CRITICAL: Uses isWebContentsViewVisible from store to hide WebContentsView when overlays are active
  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Hide browser if:
    // 1. Component prop isVisible is false (browser closed/minimized by user)
    // 2. Store isWebContentsViewVisible is false (overlays active - dialogs, tooltips, settings)
    const shouldShowWebContents = isVisible && isWebContentsViewVisible

    if (!shouldShowWebContents) {
      void window.ipcApi.browser.hide()
      appLogger.info(
        '[InAppBrowser] Hidden (moved off-screen) - overlays active or browser minimized'
      )
    } else {
      const rect = container.getBoundingClientRect()
      const bounds = {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      }
      void window.ipcApi.browser.show(bounds)
      appLogger.info(`[InAppBrowser] Shown at: ${JSON.stringify(bounds)}`)
    }

    // Use ResizeObserver to automatically update bounds when the container size changes.
    // This is more reliable than listening to window resize events, especially with resizable panels.
    const observer = new ResizeObserver(() => {
      if (!shouldShowWebContents || !containerRef.current) return

      const rect = containerRef.current.getBoundingClientRect()
      const bounds = {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      }
      void window.ipcApi.browser.setBounds(bounds)
    })

    observer.observe(container)

    return () => {
      observer.disconnect()
    }
  }, [isVisible, isWebContentsViewVisible]) // Re-run when visibility state changes

  // Subscribe to WebContentsView events
  useEffect(() => {
    const unsubscribeStartLoading = window.ipcApi.browser.onDidStartLoading(() => {
      setIsLoading(true)
      setLoadError(null)
    })

    const unsubscribeStopLoading = window.ipcApi.browser.onDidStopLoading(() => {
      setIsLoading(false)
    })

    const unsubscribeNavigate = window.ipcApi.browser.onDidNavigate(data => {
      const { url, canGoBack: back, canGoForward: forward } = data

      setCurrentUrl(url)
      setAddressBarUrl(url)
      setCanGoBack(back)
      setCanGoForward(forward)
      lastLoadedUrlRef.current = url

      // Reset retry counter on successful navigation
      setRetryCount(0)

      // Notify parent about URL change
      if (onUrlChange) {
        onUrlChange(url)
      }

      appLogger.info(`[InAppBrowser] Navigated to: ${url}`)
    })

    const unsubscribeNavigateInPage = window.ipcApi.browser.onDidNavigateInPage(data => {
      const { url, canGoBack: back, canGoForward: forward } = data

      setCurrentUrl(url)
      setAddressBarUrl(url)
      setCanGoBack(back)
      setCanGoForward(forward)
      lastLoadedUrlRef.current = url

      if (onUrlChange) {
        onUrlChange(url)
      }
    })

    const unsubscribeFailLoad = window.ipcApi.browser.onDidFailLoad(data => {
      const { errorCode, errorDescription, validatedURL } = data

      // Ignore ERR_ABORTED (-3) - normal for redirects and tracking links
      if (errorCode === -3) {
        appLogger.info(
          `[InAppBrowser] ERR_ABORTED ignored (normal redirect behavior): ${validatedURL}`
        )
        return
      }

      // Handle ERR_FAILED (-2) with retry logic
      if (errorCode === -2) {
        if (retryCount < MAX_RETRIES) {
          setRetryCount(count => count + 1)

          appLogger.warn(
            `[InAppBrowser] Retry ${retryCount + 1}/${MAX_RETRIES} for ${validatedURL}`
          )

          // Clear previous timeout
          if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current)
          }

          // Schedule retry
          retryTimeoutRef.current = setTimeout(() => {
            void window.ipcApi.browser.reload()
          }, RETRY_DELAY_MS)

          return
        }

        // Max retries reached
        setLoadError(
          `Loading failed after ${MAX_RETRIES} attempts. ${errorDescription} (${errorCode})`
        )
        setIsLoading(false)
        appLogger.error(`[InAppBrowser] Max retries reached for ${validatedURL}`)
        return
      }

      // Other errors
      setLoadError(`${errorDescription} (${errorCode})`)
      setIsLoading(false)
      appLogger.error(`[InAppBrowser] Load failed: ${errorDescription} (${errorCode})`)
    })

    const unsubscribeFinishLoad = window.ipcApi.browser.onDidFinishLoad(() => {
      setIsLoading(false)
      setLoadError(null)
      setRetryCount(0)

      // Clear any pending retry timeout
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = null
      }
    })

    const unsubscribeWillRedirect = window.ipcApi.browser.onWillRedirect(() => {
      setIsLoading(true)
    })

    // Cleanup all subscriptions
    return () => {
      unsubscribeStartLoading()
      unsubscribeStopLoading()
      unsubscribeNavigate()
      unsubscribeNavigateInPage()
      unsubscribeFailLoad()
      unsubscribeFinishLoad()
      unsubscribeWillRedirect()

      // Cleanup pending retry timeout
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = null
      }
    }
  }, [onUrlChange, retryCount])

  // Navigation handlers
  const handleGoBack = (): void => {
    void window.ipcApi.browser.goBack()
  }

  const handleGoForward = (): void => {
    void window.ipcApi.browser.goForward()
  }

  const handleReload = (): void => {
    setRetryCount(0)
    setLoadError(null)
    void window.ipcApi.browser.reload()
  }

  const handleGoHome = (): void => {
    const homeUrl = initialUrl || 'https://www.google.com'
    setAddressBarUrl(homeUrl)
    setRetryCount(0)
    setLoadError(null)
    void window.ipcApi.browser.navigate(homeUrl)
  }

  const handleAddressBarChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setAddressBarUrl(e.target.value)
  }

  const handleAddressBarSubmit = (e: React.FormEvent): void => {
    e.preventDefault()

    // Validate and normalize URL
    let targetUrl = addressBarUrl.trim()

    // Check if URL starts with protocol
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = `https://${targetUrl}`
    }

    // Validate URL format
    try {
      const url = new URL(targetUrl)
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        appLogger.warn(`[InAppBrowser] Invalid protocol: ${url.protocol}`)
        return
      }

      setRetryCount(0)
      setLoadError(null)
      void window.ipcApi.browser.navigate(targetUrl)
    } catch {
      appLogger.warn(`[InAppBrowser] Invalid URL: ${targetUrl}`)
    }
  }

  const handleOpenExternal = (): void => {
    void window.ipcApi.openExternal(currentUrl)
  }

  const handleMinimize = (): void => {
    minimizeBrowser()
  }

  return (
    <div className="flex flex-col h-full bg-neutral-900">
      {/* Browser Controls */}
      <div className="flex items-center gap-2 p-2 bg-neutral-800 border-b border-neutral-700">
        {/* Left: Mail icon to minimize */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleMinimize}
          className="h-8 w-8 text-purple-400 hover:text-purple-300 hover:bg-purple-900/20"
          title="Minimize browser (return to email)"
        >
          <Mail size={16} />
        </Button>

        {/* Navigation Controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleGoBack}
            disabled={!canGoBack}
            className="h-8 w-8 disabled:opacity-30"
            title={canGoBack ? 'Go back' : 'No history'}
          >
            <ArrowLeft size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleGoForward}
            disabled={!canGoForward}
            className="h-8 w-8 disabled:opacity-30"
            title={canGoForward ? 'Go forward' : 'No forward history'}
          >
            <ArrowRight size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleReload}
            className="h-8 w-8"
            title="Reload page"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleGoHome}
            className="h-8 w-8"
            title="Go to home page"
          >
            <Home size={16} />
          </Button>
        </div>

        {/* Address Bar */}
        <form onSubmit={handleAddressBarSubmit} className="flex-1">
          <input
            type="text"
            value={addressBarUrl}
            onChange={handleAddressBarChange}
            className="w-full h-8 px-3 text-sm bg-neutral-700 text-neutral-100 border border-neutral-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="Enter URL..."
            spellCheck={false}
          />
        </form>

        {/* Open in External Browser */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleOpenExternal}
          className="h-8 w-8"
          title="Open in external browser"
        >
          <ExternalLink size={16} />
        </Button>
      </div>

      {/* Error Display */}
      {loadError && (
        <div className="p-4 bg-red-900/20 border-b border-red-800 text-red-300">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <h3 className="font-semibold mb-1">Failed to load page</h3>
              <p className="text-sm">{loadError}</p>
              {retryCount > 0 && retryCount < MAX_RETRIES && (
                <p className="text-sm mt-2 text-yellow-300">
                  Retrying... (Attempt {retryCount}/{MAX_RETRIES})
                </p>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={handleReload} className="shrink-0">
              Try Again
            </Button>
          </div>
        </div>
      )}

      {/* WebContentsView Container - invisible placeholder for positioning */}
      <div ref={containerRef} className="flex-1 relative bg-transparent">
        {/* WebContentsView will be positioned here by Electron */}
        {isLoading && !loadError && (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-900/50">
            <div className="flex flex-col items-center gap-3">
              <RefreshCw className="animate-spin text-purple-400" size={32} />
              <p className="text-sm text-neutral-300">Loading...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default InAppBrowser
