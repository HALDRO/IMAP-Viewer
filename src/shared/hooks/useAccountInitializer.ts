/**
 * @file Enhanced account initialization hook with race condition prevention
 * @description Manages account initialization with duplicate prevention and coordination
 * with useEmailList. Prevents race conditions by tracking active initializations and
 * coordinating with account switching state. Ensures emails are loaded only after
 * successful account initialization to prevent "Connection not available" errors.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

import { useAccountStore } from '../store/accounts/accountStore'
import { useMainSettingsStore } from '../store/mainSettingsStore'
import { useProxyStore } from '../store/proxyStore'
import { useUIStore } from '../store/uiStore'
import type { MailBoxes } from '../types/electron'

interface UseAccountInitializerReturn {
  isInitialized: boolean
  isInitializing: boolean
  initializationError: string | null
  mailboxes: MailBoxes | null
  isLoadingAccounts: boolean
  retryInitialization: () => Promise<void>
  initializeAccount: (accountId: string, forceRefresh?: boolean) => Promise<void>
}

/**
 * Simple hook for managing account initialization with coordination
 */
export const useAccountInitializer = (): UseAccountInitializerReturn => {
  const {
    selectedAccountId,
    selectMailbox,
    setMailboxesForAccount,
    isAccountSwitching,
    finishAccountSwitch,
  } = useAccountStore()

  // Don't use selectors - get stable references to prevent re-initialization loop
  // Selectors return new function references on every store change, causing useEffect to re-trigger
  const initializeProxyRef = useRef(useProxyStore.getState().initializeProxy)
  const initializeSettingsRef = useRef(useMainSettingsStore.getState().initializeSettings)

  const [isInitialized, setIsInitialized] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const [initializationError, setInitializationError] = useState<string | null>(null)
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false)
  const [mailboxes, setMailboxes] = useState<MailBoxes | null>(null)

  // Track which accounts are currently being initialized to prevent duplicates
  const initializingAccounts = useRef<Set<string>>(new Set())
  // Track if initialization has been triggered to prevent re-initialization on store updates
  const hasTriggeredInit = useRef(false)

  const loadAccounts = useCallback(async () => {
    setIsLoadingAccounts(true)
    try {
      const accountsData = await window.ipcApi.getAccounts()
      // Use getState() to avoid dependency on selector
      useAccountStore.getState().setAccounts(accountsData)
    } catch (error) {
      console.error('Failed to load accounts:', error)
      throw error
    } finally {
      setIsLoadingAccounts(false)
    }
  }, [])

  const initializeAccount = useCallback(
    async (accountId: string, forceRefresh = false) => {
      if (!accountId) {
        console.warn('initializeAccount: No accountId provided')
        return
      }

      // Prevent duplicate initialization unless forced
      if (!forceRefresh && initializingAccounts.current.has(accountId)) {
        return
      }

      // Mark account as being initialized
      initializingAccounts.current.add(accountId)

      setInitializationError(null)
      setIsInitializing(true)

      try {
        // Use the unified initialize-account handler for coordinated initialization
        const result = await window.ipcApi.initializeAccount(accountId, 50)

        // Set all the data from the unified result
        setMailboxesForAccount(accountId, result.mailboxes)

        if (selectedAccountId === accountId) {
          setMailboxes(result.mailboxes)

          // Auto-select the default mailbox that was determined by the backend
          if (result.defaultMailbox) {
            selectMailbox(result.defaultMailbox)

            // Set initial emails if available
            if (result.initialEmails && result.initialEmails.length > 0) {
              const {
                setEmailHeadersForMailbox,
                setEmailCountForMailbox,
                setHasMoreEmailsForMailbox,
              } = useAccountStore.getState()
              setEmailHeadersForMailbox(accountId, result.defaultMailbox, result.initialEmails)
              setEmailCountForMailbox(
                accountId,
                result.defaultMailbox,
                result.totalEmailCount || result.initialEmails.length
              )
              setHasMoreEmailsForMailbox(
                accountId,
                result.defaultMailbox,
                (result.totalEmailCount || 0) > result.initialEmails.length
              )
            }
          }

          // Update connection status to 'connected' after successful initialization
          const { setAccountConnectionStatus } = useAccountStore.getState()
          setAccountConnectionStatus(accountId, 'connected')

          // Mark account switch as finished
          finishAccountSwitch()
        } else {
          finishAccountSwitch() // Still finish the switch
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
        console.error(`Failed to initialize account ${accountId}:`, error)

        // Update connection status to 'disconnected' on error
        const { setAccountConnectionStatus } = useAccountStore.getState()
        setAccountConnectionStatus(accountId, 'disconnected')

        setInitializationError(errorMessage)
        finishAccountSwitch() // Always finish switch even on error
      } finally {
        // Remove account from initializing set
        initializingAccounts.current.delete(accountId)
        setIsInitializing(false)
      }
    },
    [selectedAccountId, setMailboxesForAccount, selectMailbox, finishAccountSwitch]
  )

  const retryInitialization = useCallback(async () => {
    setInitializationError(null)
    setIsInitializing(true)

    try {
      // UI config is loaded synchronously on store creation (getInitialState in uiStore.ts)
      // No need to reload it here - this was causing the re-initialization loop
      await Promise.all([
        loadAccounts(),
        initializeProxyRef.current(),
        initializeSettingsRef.current(),
      ])
      setIsInitialized(true)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      setInitializationError(errorMessage)
    } finally {
      setIsInitializing(false)
    }
  }, [loadAccounts])

  // Initialize on mount - only once, use ref to prevent re-initialization on store updates
  useEffect(() => {
    if (hasTriggeredInit.current) {
      return
    }
    hasTriggeredInit.current = true
    void retryInitialization()
  }, [retryInitialization])

  // Initialize account when selection changes and switching starts
  useEffect(() => {
    if (isInitialized && selectedAccountId && isAccountSwitching) {
      initializeAccount(selectedAccountId)
    }
  }, [isInitialized, selectedAccountId, isAccountSwitching, initializeAccount])

  return {
    isInitialized,
    isInitializing,
    initializationError,
    mailboxes,
    isLoadingAccounts,
    retryInitialization,
    initializeAccount,
  }
}
