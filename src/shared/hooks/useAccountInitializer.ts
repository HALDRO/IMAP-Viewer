/**
 * @file Simple hook for managing application initialization
 */
import { useState, useEffect, useCallback } from 'react';

import { useAccountStore } from '../store/accounts/accountStore';
import { useMainSettingsStore } from '../store/mainSettingsStore';
import { useProxyStore } from '../store/proxyStore';
import type { MailBoxes } from '../types/electron';

interface UseAccountInitializerReturn {
  isInitialized: boolean;
  isInitializing: boolean;
  initializationError: string | null;
  mailboxes: MailBoxes | null;
  isLoadingAccounts: boolean;
  retryInitialization: () => Promise<void>;
  initializeAccount: (accountId: string, forceRefresh?: boolean) => Promise<void>;
}

/**
 * Simple hook for managing account initialization with coordination
 */
export const useAccountInitializer = (): UseAccountInitializerReturn => {
  const {
    setAccounts,
    accounts,
    selectedAccountId,
    selectMailbox,
    setMailboxesForAccount,
    isAccountSwitching,
    finishAccountSwitch
  } = useAccountStore();
  const { initializeProxy } = useProxyStore();
  const { settings } = useMainSettingsStore();

  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [mailboxes, setMailboxes] = useState<MailBoxes | null>(null);

  const loadAccounts = useCallback(async () => {
    setIsLoadingAccounts(true);
    try {
      const accountsData = await window.ipcApi.getAccounts();
      setAccounts(accountsData);
    } catch (error) {
      console.error('Failed to load accounts:', error);
      throw error;
    } finally {
      setIsLoadingAccounts(false);
    }
  }, [setAccounts]);

  const initializeAccount = useCallback(async (accountId: string, forceRefresh = false) => {
    if (!accountId) return;

    setInitializationError(null);
    setIsInitializing(true);

    try {
      // Use the unified initialize-account handler for coordinated initialization
      const result = await window.ipcApi.initializeAccount(accountId, 50);
      
      // Set all the data from the unified result
      setMailboxesForAccount(accountId, result.mailboxes);

      if (selectedAccountId === accountId) {
        setMailboxes(result.mailboxes);
        
        // Auto-select the default mailbox that was determined by the backend
        if (result.defaultMailbox) {
          selectMailbox(result.defaultMailbox);
        }

        // Mark account switch as finished
        finishAccountSwitch();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error(`Failed to initialize account ${accountId}:`, error);
      setInitializationError(errorMessage);
      finishAccountSwitch(); // Always finish switch even on error
    } finally {
      setIsInitializing(false);
    }
  }, [selectedAccountId, setMailboxesForAccount, setMailboxes, selectMailbox, finishAccountSwitch]);

  const retryInitialization = useCallback(async () => {
    setInitializationError(null);
    setIsInitializing(true);
    
    try {
      await loadAccounts();
      await initializeProxy();
      setIsInitialized(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setInitializationError(errorMessage);
    } finally {
      setIsInitializing(false);
    }
  }, [loadAccounts, initializeProxy]);

  // Initialize on mount
  useEffect(() => {
    if (!isInitialized && !isInitializing) {
      retryInitialization();
    }
  }, [isInitialized, isInitializing, retryInitialization]);

  // Initialize account when selection changes, but only if not currently switching
  useEffect(() => {
    if (isInitialized && selectedAccountId && isAccountSwitching) {
      initializeAccount(selectedAccountId);
    }
  }, [isInitialized, selectedAccountId, isAccountSwitching, initializeAccount]);

  return {
    isInitialized,
    isInitializing,
    initializationError,
    mailboxes,
    isLoadingAccounts,
    retryInitialization,
    initializeAccount,
  };
};
