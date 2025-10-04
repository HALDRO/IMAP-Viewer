/**
 * @file Zustand store for managing proxy list state with stable proxy identification.
 * @description Single proxy selection only - no rotation. Uses composite key (host:port:username) for stable proxy tracking across operations.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

import type { ProxyConfig, ProxyItem, ProxyTestResult, TestStatus } from '../types/account'

// Utility to create a stable, unique key for a proxy
export const getProxyKey = (proxy: ProxyItem): string => {
  return `${proxy.host}:${proxy.port}:${proxy.username || 'noauth'}:${proxy.type || 'socks5'}`
}

// ====================================
// STATE AND STORE DEFINITION
// ====================================

interface ProxyListState {
  proxies: ProxyItem[]
  selectedProxyIndex: number | null
  testResults: Record<string, ProxyTestResult>
  isLoading: boolean
  addProxies: (proxies: ProxyItem[]) => void
  addProxy: (proxy: ProxyItem) => void
  updateProxy: (index: number, proxy: ProxyItem) => void
  deleteProxy: (index: number) => void
  setTestResult: (proxyKey: string, result: ProxyTestResult) => void
  setTestStatus: (proxyKey: string, status: TestStatus) => void
  loadProxies: () => Promise<void>
  saveProxies: () => Promise<void>
  removeDuplicates: () => number
  clearAllProxies: () => void
  setSelectedProxyIndex: (index: number | null) => void
}

export const useProxyListStore = create<ProxyListState>()(
  persist(
    immer((set, get) => ({
      proxies: [],
      selectedProxyIndex: null,
      testResults: {},
      isLoading: false,

      addProxies: (proxiesToAdd: ProxyItem[]) => {
        set(state => {
          const existingKeys = new Set(state.proxies.map(p => getProxyKey(p)))
          const newProxies = proxiesToAdd.filter(p => !existingKeys.has(getProxyKey(p)))
          state.proxies.push(...newProxies)
        })
        void get().saveProxies()
      },

      addProxy: (proxy: ProxyItem) => {
        set(state => {
          state.proxies.push(proxy)
        })
        void get().saveProxies()
      },

      updateProxy: (index: number, proxy: ProxyItem) => {
        set(state => {
          if (state.proxies[index]) {
            state.proxies[index] = proxy
          }
        })
        void get().saveProxies()
      },

      deleteProxy: (index: number) => {
        set(state => {
          if (index >= 0 && index < state.proxies.length) {
            state.proxies.splice(index, 1)
          }
        })
        void get().saveProxies()
      },

      setSelectedProxyIndex: (index: number | null) => {
        set({ selectedProxyIndex: index })
      },

      setTestResult: (proxyKey: string, result: ProxyTestResult) => {
        set(state => {
          state.testResults = {
            ...state.testResults,
            [proxyKey]: result,
          }
        })
      },

      setTestStatus: (proxyKey: string, status: TestStatus) => {
        set(state => {
          const result = state.testResults[proxyKey]
          if (result) {
            result.loading = status === 'testing'
          } else {
            // Don't set success:false for new test - let it be undefined until test completes
            state.testResults[proxyKey] = {
              timestamp: Date.now(),
              loading: status === 'testing',
            } as ProxyTestResult
          }
        })
      },

      loadProxies: async () => {
        set({ isLoading: true })
        try {
          const proxyConfigs = await window.ipcApi.getProxyList()
          const proxies: ProxyItem[] = (proxyConfigs as ProxyConfig[]).map(config => {
            const [host, port] = (config.hostPort ?? `${config.host}:${config.port}`).split(':')
            return {
              host,
              port: Number.parseInt(port),
              username: config.username,
              password: config.password,
              type: config.type,
            }
          })
          set({ proxies })
        } catch {
          // Failed to load proxies
        } finally {
          set({ isLoading: false })
        }
      },

      saveProxies: async () => {
        try {
          const state = get()
          const proxyConfigs = state.proxies.map((proxy: ProxyItem) => ({
            host: proxy.host,
            port: proxy.port,
            hostPort: `${proxy.host}:${proxy.port}`,
            auth: !!(
              proxy.username !== null &&
              proxy.username !== undefined &&
              proxy.username.length > 0 &&
              proxy.password !== null &&
              proxy.password !== undefined &&
              proxy.password.length > 0
            ),
            username: proxy.username,
            password: proxy.password,
            type: proxy.type ?? 'socks5',
          }))
          await window.ipcApi.saveProxyList(proxyConfigs)
        } catch {
          // Failed to save proxies
        }
      },

      removeDuplicates: (): number => {
        let removedCount = 0
        set(state => {
          const initialCount = state.proxies.length
          const seen = new Set<string>()
          state.proxies = state.proxies.filter(proxy => {
            const key = getProxyKey(proxy)
            if (seen.has(key)) {
              return false
            }
            seen.add(key)
            return true
          })
          removedCount = initialCount - state.proxies.length
        })
        if (removedCount > 0) {
          void get().saveProxies()
        }
        return removedCount
      },

      clearAllProxies: () => {
        set({ proxies: [], selectedProxyIndex: null, testResults: {} })
        void get().saveProxies()
      },
    })),
    {
      name: 'proxy-list-storage',
      partialize: state => ({
        selectedProxyIndex: state.selectedProxyIndex,
      }),
    }
  )
)
