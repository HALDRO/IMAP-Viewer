/**
 * @file Hook for managing application initialization
 */
import { useState, useEffect, useCallback, useRef } from 'react';

import { useAccountStore } from '../store/accounts/accountStore';
import { useLogStore } from '../store/logStore';
import { useMainSettingsStore } from '../store/mainSettingsStore';
import { useProxyStore } from '../store/proxyStore';
import { logger as appLogger } from '../utils/logger';

interface UseAppInitializationReturn {
  // Initialization state
  isInitialized: boolean;
  initializationError: string | null;

  // Loading states
  isLoadingAccounts: boolean;

  // Actions
  retryInitialization: () => Promise<void>;
}

/**
 * Hook for managing application initialization
 */
export const useAppInitialization = (): UseAppInitializationReturn => {
  console.log('useAppInitialization hook called');
  const { setAccounts, accounts } = useAccountStore();
  const { initializeProxy } = useProxyStore();
  const { settings } = useMainSettingsStore();
  const addLog = useLogStore((state) => state.addLog);

  const [isInitialized, setIsInitialized] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);

  // Prevent double initialization
  const hasInitialized = useRef(false);

  const loadAccounts = useCallback(async () => {
    setIsLoadingAccounts(true);
    try {
      const accounts = await window.ipcApi.getAccounts();
      setAccounts(accounts);

      appLogger.info(`Loaded ${accounts.length} accounts`);
      return accounts;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to load accounts:', error);
      appLogger.error('Failed to load accounts');
      throw new Error('Failed to load accounts');
    } finally {
      setIsLoadingAccounts(false);
    }
  }, [setAccounts]);

  const autoConnectAccounts = useCallback(async (accountsToConnect: typeof accounts) => {
    if (!settings.autoLoginOnStartup || accountsToConnect.length === 0) {
      return;
    }

    appLogger.info(`Auto-connecting to ${accountsToConnect.length} accounts...`);

    try {
      // Start watching all accounts in the background
      const connectPromises = accountsToConnect.map(account =>
        window.ipcApi.watchInbox(account.id).catch(error => {
          appLogger.error(`Failed to connect to ${account.email}: ${error instanceof Error ? error.message : String(error)}`);
        })
      );

      await Promise.allSettled(connectPromises);
      appLogger.info(`Auto-connect completed for ${accountsToConnect.length} accounts`);
    } catch (error) {
      appLogger.error(`Auto-connect failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [settings.autoLoginOnStartup]);

  const initializeApp = useCallback(async () => {
    setInitializationError(null);
    appLogger.info('Starting app initialization...');
    appLogger.info('Initializing application...');

    try {
      const [loadedAccounts] = await Promise.all([
        loadAccounts(),
        initializeProxy(),
      ]);

      // Auto-connect to accounts if enabled (in background, don't await)
      if (settings.autoLoginOnStartup && loadedAccounts.length > 0) {
        // Запускаем в фоне без блокировки UI
        setTimeout(() => {
          autoConnectAccounts(loadedAccounts);
        }, 100);
      }

      setIsInitialized(true);
      appLogger.info('Application initialized successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown initialization error';
      setInitializationError(errorMessage);
      appLogger.error(`Application initialization failed: ${errorMessage}`);
    }
  }, [loadAccounts, initializeProxy, autoConnectAccounts]);

  const retryInitialization = useCallback(async () => {
    hasInitialized.current = false;
    setIsInitialized(false);
    await initializeApp();
  }, [initializeApp]);

  // Initialize app on mount (only once)
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    void initializeApp();
  }, [initializeApp]);

  return {
    isInitialized,
    initializationError,
    isLoadingAccounts,
    retryInitialization,
  };
};
