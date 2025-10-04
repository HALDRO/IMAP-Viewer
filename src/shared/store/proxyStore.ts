/**
 * @file Zustand store for managing global proxy state
 * @description Manages global proxy configuration, status, and settings (randomization, sources, test config, retry settings). Provides persistent storage via zustand/persist middleware. Handles proxy initialization and status updates from main process. Auto-update settings have been removed - proxy fetching is now manual only.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { GlobalProxyConfig } from '../types/account'
import type { ProxyStatus } from '../types/electron'

interface ProxySettings {
  randomizeSource: boolean
  proxySources: string[]
  maxRetries: number
  testTimeout: number // in milliseconds
  testUrl: string
  delayBetweenRetries: number // in milliseconds
  defaultProxyType: 'http' | 'https' | 'socks4' | 'socks5'
}

interface ProxyState extends ProxySettings {
  config: GlobalProxyConfig | null
  status: ProxyStatus
  error: string | null
  externalIp: string | null
  setConfig: (config: GlobalProxyConfig | null) => void
  setStatus: (status: ProxyStatus, details?: { ip?: string; error?: string }) => void
  initializeProxy: () => Promise<void>
  // Setters for all settings
  setRandomizeSource: (value: boolean) => void
  setProxySources: (sources: string[]) => void
  setMaxRetries: (value: number) => void
  setTestTimeout: (value: number) => void
  setTestUrl: (value: string) => void
  setDelayBetweenRetries: (value: number) => void
  setDefaultProxyType: (value: 'http' | 'https' | 'socks4' | 'socks5') => void
}

export const useProxyStore = create<ProxyState>()(
  persist(
    (set, get) => ({
      // Default settings values
      randomizeSource: false,
      proxySources: [],
      maxRetries: 2,
      testTimeout: 3000,
      // Fast and reliable endpoint (500ms avg vs 4000ms+ httpbin.org)
      testUrl: 'http://ip-api.com/json/?fields=query',
      delayBetweenRetries: 0,
      defaultProxyType: 'socks5',

      // Core proxy state
      config: null,
      status: 'disabled',
      error: null,
      externalIp: null,

      /**
       * Updates the global proxy configuration.
       */
      setConfig: (config: GlobalProxyConfig | null): void => {
        set({ config })
      },

      setStatus: (status: ProxyStatus, details: { error?: string; ip?: string } = {}): void => {
        const newState: Partial<ProxyState> = {
          status,
          error: details.error ?? null,
        }
        if (status === 'connected') {
          newState.externalIp = details.ip ?? null
        } else if (status === 'disabled' || status === 'error') {
          newState.externalIp = null
        }
        set(newState)
      },

      /**
       * Fetches the initial proxy configuration from the main process.
       */
      initializeProxy: async (): Promise<void> => {
        try {
          const config = await window.ipcApi.proxy.getGlobal()
          get().setConfig(config)

          // Set up listener for proxy status updates
          window.ipcApi.proxy.onStatusUpdate((_event, status) => {
            get().setStatus(status.status, {
              ip: status.ip,
              error: status.error,
            })
          })
        } catch (e) {
          console.error('Failed to initialize proxy settings:', e)
          get().setStatus('error', {
            error: e instanceof Error ? e.message : 'Initialization failed',
          })
        }
      },

      // Implement setters for all settings
      setRandomizeSource: (value: boolean) => set({ randomizeSource: value }),
      setProxySources: (sources: string[]) => set({ proxySources: sources }),
      setMaxRetries: (value: number) => set({ maxRetries: value }),
      setTestTimeout: (value: number) => set({ testTimeout: value }),
      setTestUrl: (value: string) => set({ testUrl: value }),
      setDelayBetweenRetries: (value: number) => set({ delayBetweenRetries: value }),
      setDefaultProxyType: (value: 'http' | 'https' | 'socks4' | 'socks5') =>
        set({ defaultProxyType: value }),
    }),
    {
      name: 'proxy-settings-storage', // unique name
      version: 1, // Increment this when changing defaults to force migration
      partialize: state => ({
        randomizeSource: state.randomizeSource,
        proxySources: state.proxySources,
        maxRetries: state.maxRetries,
        testTimeout: state.testTimeout,
        testUrl: state.testUrl,
        delayBetweenRetries: state.delayBetweenRetries,
        defaultProxyType: state.defaultProxyType,
      }),
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as Partial<ProxyState>

        // Migration for version 0 -> 1: Update testUrl from httpbin.org to ip-api.com
        if (version === 0) {
          if (state.testUrl === 'https://httpbin.org/ip') {
            state.testUrl = 'http://ip-api.com/json/?fields=query'
          }
        }

        return state as ProxyState
      },
    }
  )
)
