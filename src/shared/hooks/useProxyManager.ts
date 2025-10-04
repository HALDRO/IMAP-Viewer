/**
 * @file Unified proxy management hook with advanced validation and duplicate handling
 * @description Centralized proxy state and operations management with minimal duplication. Strict Zod validation with IP/domain checking, intelligent duplicate prevention, react-hook-form integration. Features: proxy testing, import/export, manual source fetching, localStorage persistence. Module-level utilities prevent object recreation and performance issues. Auto-update functionality has been removed - proxies are now fetched only on explicit user action via the "Get" button.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { shallow } from 'zustand/shallow'

import {
  exportProxiesToString,
  normalizeProxy,
  parseProxyImport,
} from '../../services/proxyOrchestrator'
import { getProxyKey, useProxyListStore } from '../store/proxyListStore'
import { useProxyStore } from '../store/proxyStore'
import type {
  GlobalProxyConfig,
  ProxyConfig,
  ProxyItem,
  ProxyTestResult,
  TestConfig,
} from '../types/account'
import { showToast } from '../ui/Toast'
import { logger as appLogger } from '../utils/logger'
import { extractProxyContent, parseProxyLine } from '../utils/proxyParser'
import { useProxyForm } from './useProxyForm'
import { useProxyStatus } from './useProxyStatus'

interface TestProgress {
  total: number
  tested: number
  valid: number
  invalid: number
  startTime: number
}

interface UseProxyManagerReturn {
  // UI state
  isPasswordVisible: boolean
  setIsPasswordVisible: (_visible: boolean) => void

  // Actions
  handleSetProxy: (index: number | null) => Promise<void>
  handleTestProxy: (index: number, sessionId?: string) => Promise<void>
  handleTestAllProxies: () => Promise<void>
  handleStopTestAll: () => void
  handleDeleteInvalidProxies: () => Promise<void>
  deleteProxy: (index: number) => void
  handleImportProxies: (_text: string) => Promise<void>
  handleExportProxies: () => string
  handleFetchFromExternalSource: () => Promise<void>

  // Proxy settings
  enableProxies: boolean

  // Source randomization
  randomizeSource: boolean
  setRandomizeSource: (_enabled: boolean) => void
  proxySources: string[]
  setProxySources: (_sources: string[]) => void

  // Retry settings
  maxRetries: number
  setMaxRetries: (retries: number) => void

  // Test configuration
  testTimeout: number
  setTestTimeout: (timeout: number) => void
  testUrl: string
  setTestUrl: (url: string) => void
  delayBetweenRetries: number
  setDelayBetweenRetries: (delay: number) => void

  // Default proxy type (for proxies without explicit type)
  defaultProxyType: 'http' | 'https' | 'socks4' | 'socks5'
  setDefaultProxyType: (type: 'http' | 'https' | 'socks4' | 'socks5') => void

  // Selected proxy (null = rotation, number = specific proxy)
  selectedProxyIndex: number | null
  setSelectedProxyIndex: (index: number | null) => void

  // Loading states
  isLoading: boolean
  isTesting: Record<number, boolean>
  isTestingAll: boolean

  // Test progress statistics
  testProgress: TestProgress | null

  // State from store
  proxies: Array<{
    host: string
    port: number
    username?: string
    password?: string
    type?: 'http' | 'https' | 'socks4' | 'socks5'
  }>
  testResults: Record<string, ProxyTestResult>

  // Clear all proxies
  clearAllProxies: () => void
}

/**
 * Hook for managing proxy functionality
 */
export const useProxyManager = (): UseProxyManagerReturn => {
  // No longer a hook, just the object
  const toast = showToast
  const {
    proxies,
    selectedProxyIndex,
    testResults,
    deleteProxy,
    loadProxies,
    setSelectedProxyIndex: setSelectedProxyIndexInternal,
    isLoading: storeLoading,
    addProxies,
    clearAllProxies,
    setTestResult,
    setTestStatus,
  } = useProxyListStore()

  const {
    config,
    setConfig,
    randomizeSource,
    setRandomizeSource,
    proxySources,
    setProxySources,
    maxRetries,
    setMaxRetries,
    testTimeout,
    setTestTimeout,
    testUrl,
    setTestUrl,
    delayBetweenRetries,
    setDelayBetweenRetries,
    defaultProxyType,
    setDefaultProxyType,
  } = useProxyStore()

  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [isTesting, setIsTesting] = useState<Record<number, boolean>>({})
  const [isTestingAll, setIsTestingAll] = useState(false)
  const [testProgress, setTestProgress] = useState<TestProgress | null>(null)
  const testSessionId = useRef<string | null>(null)

  // Load proxies on mount
  useEffect(() => {
    void loadProxies()
  }, [loadProxies])

  // Sync proxy config from backend to frontend store on mount
  useEffect(() => {
    const syncFromBackend = async () => {
      try {
        const globalProxy = await window.ipcApi.proxy.getGlobal()
        if (globalProxy) {
          setConfig(globalProxy)
          appLogger.info('Synced proxy config from backend to store')
        } else {
          setConfig(null)
        }
      } catch (error) {
        appLogger.error(
          `Failed to sync proxy config: ${error instanceof Error ? error.message : 'Unknown'}`
        )
      }
    }
    void syncFromBackend()
  }, [setConfig])

  // Wrapper to sync selectedProxyIndex to backend config for IMAP connections
  // When user selects a proxy, automatically enable global proxy if it's not already enabled
  const setSelectedProxyIndex = useCallback(
    async (index: number | null) => {
      setSelectedProxyIndexInternal(index)

      // Sync to backend config so configureProxy() can use it
      try {
        const globalProxy = await window.ipcApi.proxy.getGlobal()

        // If user selects a proxy (index is not null) and global proxy exists but is disabled
        // automatically enable it to avoid confusion
        if (index !== null && globalProxy && !globalProxy.enabled) {
          const targetProxy = proxies[index]
          if (targetProxy) {
            appLogger.info(
              `Auto-enabling proxy when selecting specific proxy #${index + 1}: ${targetProxy.host}:${targetProxy.port}`
            )
            const updatedConfig = {
              enabled: true,
              type: targetProxy.type ?? 'socks5',
              hostPort: `${targetProxy.host}:${targetProxy.port}`,
              auth: !!(targetProxy.username && targetProxy.password),
              username: targetProxy.username,
              password: targetProxy.password,
              selectedProxyIndex: index,
            }
            setConfig(updatedConfig)
            await window.ipcApi.proxy.setGlobal(updatedConfig)

            // Update browser proxy
            try {
              await window.ipcApi.browser.updateProxy()
            } catch (browserError) {
              appLogger.warn(
                `Failed to update browser proxy: ${browserError instanceof Error ? browserError.message : 'Unknown'}`
              )
            }
            return
          }
        }

        // Normal case: update both selectedProxyIndex AND proxy config
        if (globalProxy) {
          if (index !== null) {
            // User selected a specific proxy - update full config
            const targetProxy = proxies[index]
            if (targetProxy) {
              appLogger.info(
                `Switching to proxy #${index + 1}: ${targetProxy.host}:${targetProxy.port}`
              )
              const updatedConfig = {
                enabled: globalProxy.enabled,
                type: targetProxy.type ?? 'socks5',
                hostPort: `${targetProxy.host}:${targetProxy.port}`,
                auth: !!(targetProxy.username && targetProxy.password),
                username: targetProxy.username,
                password: targetProxy.password,
                selectedProxyIndex: index,
              }
              setConfig(updatedConfig)
              await window.ipcApi.proxy.setGlobal(updatedConfig)

              // Update browser proxy
              try {
                await window.ipcApi.browser.updateProxy()
              } catch (browserError) {
                appLogger.warn(
                  `Failed to update browser proxy: ${browserError instanceof Error ? browserError.message : 'Unknown'}`
                )
              }
            }
          } else {
            // User deselected (switching to rotation) - just update index
            const updatedConfig = {
              ...globalProxy,
              selectedProxyIndex: undefined,
            }
            setConfig(updatedConfig)
            await window.ipcApi.proxy.setGlobal(updatedConfig)

            // Update browser proxy
            try {
              await window.ipcApi.browser.updateProxy()
            } catch (browserError) {
              appLogger.warn(
                `Failed to update browser proxy: ${browserError instanceof Error ? browserError.message : 'Unknown'}`
              )
            }
          }
        } else if (index !== null) {
          // If no global proxy exists yet and user selects a proxy, create one
          const targetProxy = proxies[index]
          if (targetProxy) {
            appLogger.info(
              `Creating global proxy config when selecting proxy #${index + 1}: ${targetProxy.host}:${targetProxy.port}`
            )
            const newConfig = {
              enabled: true,
              type: targetProxy.type ?? 'socks5',
              hostPort: `${targetProxy.host}:${targetProxy.port}`,
              auth: !!(targetProxy.username && targetProxy.password),
              username: targetProxy.username,
              password: targetProxy.password,
              selectedProxyIndex: index,
            }
            setConfig(newConfig)
            await window.ipcApi.proxy.setGlobal(newConfig)

            // Update browser proxy
            try {
              await window.ipcApi.browser.updateProxy()
            } catch (browserError) {
              appLogger.warn(
                `Failed to update browser proxy: ${browserError instanceof Error ? browserError.message : 'Unknown'}`
              )
            }
          }
        }
      } catch (error) {
        appLogger.error(
          `Failed to sync selected proxy to config: ${error instanceof Error ? error.message : 'Unknown'}`
        )
      }
    },
    [setSelectedProxyIndexInternal, proxies, setConfig]
  )

  // Derive enableProxies from global proxy store
  const enableProxies = config?.enabled ?? false

  const handleSetProxy = useCallback(
    async (index: number | null) => {
      try {
        if (index === null) {
          // Disable proxy
          setConfig(null)
          await window.ipcApi.proxy.setGlobal(null)
          setSelectedProxyIndexInternal(null)
          appLogger.info('Global proxy disabled')
        } else {
          // Enable proxy with specific index
          const targetProxy = proxies[index]
          if (targetProxy) {
            const proxyConfig: GlobalProxyConfig = {
              enabled: true,
              type: targetProxy.type ?? 'socks5',
              hostPort: `${targetProxy.host}:${targetProxy.port}`,
              auth: !!(targetProxy.username && targetProxy.password),
              username: targetProxy.username,
              password: targetProxy.password,
            }
            setConfig(proxyConfig)
            await window.ipcApi.proxy.setGlobal(proxyConfig)
            setSelectedProxyIndexInternal(index)
            appLogger.info(`Global proxy enabled: ${targetProxy.host}:${targetProxy.port}`)
          }
        }

        // Update browser proxy configuration
        try {
          const browserResult = await window.ipcApi.browser.updateProxy()
          if (browserResult.success) {
            appLogger.info(
              browserResult.proxyEnabled
                ? `Browser proxy updated: ${browserResult.proxy}`
                : 'Browser proxy disabled'
            )
          }
        } catch (browserError) {
          appLogger.warn(
            `Failed to update browser proxy: ${browserError instanceof Error ? browserError.message : 'Unknown'}`
          )
        }
      } catch (error) {
        appLogger.error(
          `Failed to set proxy: ${error instanceof Error ? error.message : 'Unknown'}`
        )
      }
    },
    [proxies, setConfig, setSelectedProxyIndexInternal]
  )

  const handleTestProxy = useCallback(
    async (index: number, sessionId?: string) => {
      const proxy = proxies[index]
      if (!proxy) return

      const proxyKey = getProxyKey(proxy)
      setIsTesting(prev => ({ ...prev, [index]: true }))
      setTestStatus(proxyKey, 'testing')
      appLogger.info(`Testing proxy ${proxy.host}:${proxy.port}...`)

      try {
        // Prepare proxy config for IPC
        const proxyConfig = {
          host: proxy.host,
          port: proxy.port,
          type: proxy.type ?? defaultProxyType,
          username: proxy.username,
          password: proxy.password,
          auth: !!(proxy.username && proxy.password),
        }

        // Prepare test config from Zustand store
        const testConfig: TestConfig = {
          testUrl,
          timeout: testTimeout,
          maxRetries,
          delayBetweenRetries,
        }

        const result = await window.ipcApi.proxy.test(proxyConfig, testConfig, sessionId)
        setTestResult(proxyKey, { ...result, timestamp: Date.now(), loading: false })

        if (result.success) {
          appLogger.info(
            `Proxy ${proxy.host}:${proxy.port} test successful | IP: ${result.ip || 'N/A'}`
          )
        } else {
          appLogger.error(
            `Proxy ${proxy.host}:${proxy.port} test failed: ${result.error || 'Unknown reason'}`
          )
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'An unknown error occurred during testing'
        appLogger.error(`Proxy ${proxy.host}:${proxy.port} test exception: ${errorMessage}`)
        setTestResult(proxyKey, {
          success: false,
          error: errorMessage,
          timestamp: Date.now(),
          loading: false,
        })
      } finally {
        setIsTesting(prev => ({ ...prev, [index]: false }))
        setTestStatus(proxyKey, 'idle')
      }
    },
    [
      proxies,
      setTestStatus,
      defaultProxyType,
      testUrl,
      testTimeout,
      maxRetries,
      delayBetweenRetries,
      setTestResult,
    ]
  )

  const handleTestAllProxies = useCallback(async () => {
    if (isTestingAll) return
    setIsTestingAll(true)

    const proxiesSnapshot = [...proxies]
    const total = proxiesSnapshot.length
    if (total === 0) {
      setIsTestingAll(false)
      return
    }

    const sessionId = crypto.randomUUID()
    testSessionId.current = sessionId
    await window.ipcApi.proxy.startTestSession(sessionId)
    appLogger.info(`Starting bulk proxy test with session ID: ${sessionId}`)

    const startTime = Date.now()
    setTestProgress({ total, tested: 0, valid: 0, invalid: 0, startTime })

    // Incremental progress tracking (O(1) instead of O(n))
    let tested = 0
    let valid = 0
    let invalid = 0

    try {
      const CONCURRENT_TESTS = 50

      // Process proxies sequentially with micro-batches to allow UI updates and cancellation
      for (let i = 0; i < total; i += CONCURRENT_TESTS) {
        if (!testSessionId.current) {
          appLogger.info('Bulk test aborted by user.')
          break
        }

        const batch = proxiesSnapshot.slice(i, Math.min(i + CONCURRENT_TESTS, total))

        // Launch all tests in the batch with immediate progress updates
        const batchPromises = batch.map(async (proxy, batchIndex) => {
          const originalIndex = i + batchIndex
          const proxyKey = getProxyKey(proxy)

          await handleTestProxy(originalIndex, sessionId)

          // Immediately update counters after test completes
          const currentTestResults = useProxyListStore.getState().testResults
          const result = currentTestResults[proxyKey]

          if (result && !result.loading && (result.success === true || result.success === false)) {
            tested++
            if (result.success === true) {
              valid++
            } else {
              invalid++
            }
            // Update UI immediately (React batches state updates automatically)
            setTestProgress(prev => (prev ? { ...prev, tested, valid, invalid } : null))
          }
        })

        // Use Promise.allSettled to avoid blocking and allow cancellation
        await Promise.allSettled(batchPromises)

        // Yield to event loop to allow UI updates and stop button processing
        await new Promise(resolve => setTimeout(resolve, 0))

        // Check abort flag again after yielding
        if (!testSessionId.current) {
          appLogger.info('Bulk test aborted after batch completion.')
          break
        }
      }
    } catch (error) {
      const errorMessage = `An unexpected error occurred during bulk proxy testing: ${
        error instanceof Error ? error.message : String(error)
      }`
      appLogger.error(errorMessage)
      toast.error({
        title: 'Error',
        message: 'An unexpected error occurred during bulk proxy testing.',
      })
    } finally {
      setIsTestingAll(false)
      if (testSessionId.current) {
        await window.ipcApi.proxy.stopTestSession(testSessionId.current)
        appLogger.info(`Cleaning up proxy test session: ${testSessionId.current}`)
        testSessionId.current = null
      }
      setTimeout(() => setTestProgress(null), 5000)
    }
  }, [proxies, handleTestProxy, isTestingAll, toast])

  const handleStopTestAll = useCallback(() => {
    if (!isTestingAll || !testSessionId.current) return

    appLogger.info(`User requested to stop all proxy tests for session: ${testSessionId.current}`)
    window.ipcApi.proxy.stopTestSession(testSessionId.current)
    testSessionId.current = null // Prevent further tests in the loop
    setIsTestingAll(false)
  }, [isTestingAll])

  const handleDeleteInvalidProxies = useCallback(async () => {
    const currentProxies = useProxyListStore.getState().proxies
    const currentTestResults = useProxyListStore.getState().testResults

    const indicesToDelete: number[] = []
    currentProxies.forEach((proxy, index) => {
      const proxyKey = getProxyKey(proxy)
      const result = currentTestResults[proxyKey]
      // Don't delete proxies that are currently being tested
      if (isTesting[index]) {
        return
      }
      // Delete if the test has been run and failed
      if (result && !result.success && !result.loading) {
        indicesToDelete.push(index)
      }
    })

    if (indicesToDelete.length > 0) {
      appLogger.info(`Deleting ${indicesToDelete.length} invalid proxies...`)
      // Delete in reverse order to maintain correct indices
      for (let i = indicesToDelete.length - 1; i >= 0; i--) {
        deleteProxy(indicesToDelete[i])
      }
      appLogger.info('Invalid proxies deleted')
    } else {
      appLogger.info('No invalid proxies found to delete')
    }
  }, [deleteProxy, isTesting])

  const handleImportProxies = useCallback(
    async (text: string) => {
      try {
        const parsedProxies = parseProxyImport(text, defaultProxyType, randomizeSource)

        // Bulk add - duplicates are filtered in addProxies
        if (parsedProxies.length > 0) {
          appLogger.info(`Importing ${parsedProxies.length} proxies...`)
          addProxies(parsedProxies)
          appLogger.info('Import completed')
        } else {
          appLogger.warn('No valid proxies found in the provided content')
        }
      } catch (error) {
        appLogger.error(
          `Failed to import proxies: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    },
    [addProxies, defaultProxyType, randomizeSource]
  )

  // External fetch functionality - fetch any URL and extract proxies from content
  const handleFetchFromExternalSource = useCallback(
    async (url?: string) => {
      // If specific URL provided, use it; otherwise fetch from all configured sources
      const sources = url ? [url] : proxySources

      if (sources.length === 0) {
        appLogger.error('No proxy sources configured')
        return
      }

      try {
        if (!window.ipcApi?.fetchExternal) {
          throw new Error('fetchExternal API is not available')
        }

        appLogger.info(`Fetching proxies from ${sources.length} source(s)`)

        // Fetch and combine proxies from all sources
        const allProxiesText: string[] = []

        for (const source of sources) {
          try {
            appLogger.info(`Fetching from: ${source}`)
            const text = await window.ipcApi.fetchExternal(source)
            if (text && text.trim().length > 0) {
              allProxiesText.push(text)
            }
          } catch (error) {
            appLogger.error(
              `Failed to fetch from ${source}: ${error instanceof Error ? error.message : 'Unknown error'}`
            )
            // Continue with other sources even if one fails
          }
        }

        if (allProxiesText.length > 0) {
          // Combine all fetched proxies and import them
          const combinedText = allProxiesText.join('\n')
          await handleImportProxies(combinedText)
          appLogger.info(
            `Successfully loaded proxies from ${allProxiesText.length}/${sources.length} source(s)`
          )
        } else {
          appLogger.error('No proxies fetched from any source')
        }
      } catch (error) {
        appLogger.error(
          `Failed to fetch proxies: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    },
    [proxySources, handleImportProxies]
  )

  const handleExportProxies = useCallback(() => {
    return exportProxiesToString(proxies)
  }, [proxies])

  const handleClearAllProxies = useCallback(async () => {
    try {
      // Disable global proxy when clearing all proxies
      const globalProxy = await window.ipcApi.proxy.getGlobal()
      if (globalProxy?.enabled) {
        appLogger.info('Clearing all proxies, disabling global proxy')
        setConfig(null)
        await window.ipcApi.proxy.setGlobal(null)
      }
    } catch (error) {
      appLogger.error(
        `Failed to disable global proxy: ${error instanceof Error ? error.message : 'Unknown'}`
      )
    }

    clearAllProxies()
    appLogger.info('All proxies cleared')
  }, [clearAllProxies, setConfig])

  return {
    isPasswordVisible,
    setIsPasswordVisible,
    handleSetProxy,
    handleTestProxy,
    handleTestAllProxies,
    handleStopTestAll,
    handleDeleteInvalidProxies,
    handleExportProxies,
    deleteProxy,
    enableProxies,
    randomizeSource,
    setRandomizeSource,
    proxySources,
    setProxySources,
    maxRetries,
    setMaxRetries,
    testTimeout,
    setTestTimeout,
    testUrl,
    setTestUrl,
    delayBetweenRetries,
    setDelayBetweenRetries,
    defaultProxyType,
    setDefaultProxyType,
    selectedProxyIndex,
    setSelectedProxyIndex,
    isLoading: storeLoading,
    isTesting,
    isTestingAll,
    testProgress,
    proxies,
    testResults,
    handleImportProxies,
    handleFetchFromExternalSource,
    clearAllProxies: handleClearAllProxies,
  }
}
