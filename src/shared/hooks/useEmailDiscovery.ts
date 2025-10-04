/**
 * @file Hook for email server auto-discovery functionality
 */
import { useCallback, useState } from 'react'

import type { DiscoveredConfig } from '../types/protocol'

export type DiscoveryStatus = 'idle' | 'searching' | 'found' | 'failed' | 'manual'

// Use the DiscoveredConfig type directly

type SetValueFunction = (
  name: string,
  value: unknown,
  options?: { shouldValidate?: boolean }
) => void

interface UseEmailDiscoveryReturn {
  isDiscovering: boolean
  discoveryStatus: DiscoveryStatus
  discoveryMessage: string
  discoveryCache: Map<string, DiscoveredConfig | null>
  discoveryInProgress: Set<string>
  discoverEmailSettings: (email: string, force?: boolean, setValue?: unknown) => Promise<void>
  applyDiscoveredConfig: (config: DiscoveredConfig, setValue: unknown) => void
  handleManualSetup: () => void
  handleRetryDiscovery: (email: string, setValue?: unknown) => void
  clearDiscoveryCache: () => void
  setDiscoveryStatus: (status: DiscoveryStatus) => void
  setDiscoveryMessage: (message: string) => void
}

/**
 * Hook for managing email server auto-discovery
 */
export const useEmailDiscovery = (): UseEmailDiscoveryReturn => {
  const [isDiscovering, setIsDiscovering] = useState(false)
  const [discoveryStatus, setDiscoveryStatus] = useState<DiscoveryStatus>('idle')
  const [discoveryMessage, setDiscoveryMessage] = useState<string>('')
  const [discoveryCache, setDiscoveryCache] = useState<Map<string, DiscoveredConfig | null>>(
    new Map()
  )
  const [discoveryInProgress, setDiscoveryInProgress] = useState<Set<string>>(new Set())

  const applyDiscoveredConfig = useCallback((config: DiscoveredConfig, setValue: unknown) => {
    const configObj = config
    const setValueFn = setValue as SetValueFunction
    if (configObj.imap !== null && configObj.imap !== undefined) {
      setValueFn('incoming.protocol', 'imap', { shouldValidate: true })
      setValueFn('incoming.host', configObj.imap.host, { shouldValidate: true })
      setValueFn('incoming.port', configObj.imap.port, { shouldValidate: true })
      setValueFn('incoming.useTls', configObj.imap.secure, { shouldValidate: true })
    }

    if (configObj.smtp !== null && configObj.smtp !== undefined) {
      setValueFn(
        'outgoing',
        {
          protocol: 'smtp',
          host: configObj.smtp.host,
          port: configObj.smtp.port,
          useTls: configObj.smtp.secure,
        },
        { shouldValidate: true }
      )
    } else {
      setValueFn('outgoing', undefined, { shouldValidate: true })
    }
  }, [])

  const discoverEmailSettings = useCallback(
    async (email: string, force = false, setValue?: unknown) => {
      const domain = email.split('@')[1]
      if (!domain) return

      // Check cache first
      if (!force && discoveryCache.has(domain)) {
        const cachedConfig = discoveryCache.get(domain)
        if (cachedConfig !== null && cachedConfig !== undefined) {
          setDiscoveryStatus('found')
          setDiscoveryMessage(`Settings found for ${domain}`)
          // Auto-apply cached config if setValue is provided
          if (setValue !== null && setValue !== undefined) {
            applyDiscoveredConfig(cachedConfig, setValue)
          }
        } else {
          setDiscoveryStatus('failed')
          setDiscoveryMessage(`No settings found for ${domain}`)
        }
        return
      }

      // Prevent duplicate discovery
      if (discoveryInProgress.has(domain)) {
        return
      }

      setDiscoveryInProgress(prev => new Set(prev).add(domain))
      setIsDiscovering(true)
      setDiscoveryStatus('searching')
      setDiscoveryMessage(`Searching for email settings for ${domain}...`)

      try {
        const rawConfig = await window.ipcApi.discoverEmailConfig(domain, force)
        // Type check and cast the result
        const config = rawConfig as DiscoveredConfig | null
        // Cache the result
        setDiscoveryCache(prev => new Map(prev).set(domain, config))

        if (
          config !== null &&
          config !== undefined &&
          config.imap !== null &&
          config.imap !== undefined
        ) {
          setDiscoveryStatus('found')
          const serverType = 'IMAP'
          const serverHost = config.imap.host
          setDiscoveryMessage(`[SUCCESS] Found ${serverType} server: ${serverHost}`)
          // Auto-apply discovered config if setValue is provided
          if (setValue !== null && setValue !== undefined) {
            applyDiscoveredConfig(config, setValue)
          }
        } else {
          setDiscoveryStatus('failed')
          setDiscoveryMessage(`[ERROR] No email servers found for ${domain}`)
        }
      } catch (error) {
        console.error('Email discovery failed:', error)
        setDiscoveryStatus('failed')
        setDiscoveryMessage(
          `[ERROR] Discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
        setDiscoveryCache(prev => new Map(prev).set(domain, null))
      } finally {
        setIsDiscovering(false)
        setDiscoveryInProgress(prev => {
          const newSet = new Set(prev)
          newSet.delete(domain)
          return newSet
        })
      }
    },
    [discoveryCache, discoveryInProgress, applyDiscoveredConfig]
  )

  const handleManualSetup = useCallback(() => {
    setDiscoveryStatus('manual')
    setDiscoveryMessage('Configure email settings manually')
  }, [])

  const handleRetryDiscovery = useCallback(
    (email: string, setValue?: unknown) => {
      const domain = email.split('@')[1]
      if (domain) {
        // Clear cache and retry
        setDiscoveryCache(prev => {
          const newCache = new Map(prev)
          newCache.delete(domain)
          return newCache
        })
        void discoverEmailSettings(email, true, setValue)
      }
    },
    [discoverEmailSettings]
  )

  const clearDiscoveryCache = useCallback(() => {
    setDiscoveryCache(new Map())
    setDiscoveryStatus('idle')
    setDiscoveryMessage('')
  }, [])

  return {
    isDiscovering,
    discoveryStatus,
    discoveryMessage,
    discoveryCache,
    discoveryInProgress,
    discoverEmailSettings,
    applyDiscoveredConfig,
    handleManualSetup,
    handleRetryDiscovery,
    clearDiscoveryCache,
    setDiscoveryStatus,
    setDiscoveryMessage,
  }
}
