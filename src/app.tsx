import React, { useEffect, useCallback, useRef } from 'react';
import { Toaster } from 'sonner';

import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import { useAccountInitializer } from './shared/hooks/useAccountInitializer';
import { useAccountStore } from './shared/store/accounts/accountStore';
import { useLogStore } from './shared/store/logStore';
import { ThemeProvider } from './shared/ui/theme-provider';
import { logger } from './shared/utils/logger';


const App = (): React.JSX.Element => {
  const isInitialized = useRef(false);
  const addLogRef = useRef(useLogStore.getState().addLog);
  const setAccountConnectionStatusRef = useRef(useAccountStore.getState().setAccountConnectionStatus);

  // Update refs when store functions change
  useEffect(() => {
    addLogRef.current = useLogStore.getState().addLog;
  });

  useEffect(() => {
    setAccountConnectionStatusRef.current = useAccountStore.getState().setAccountConnectionStatus;
  });

  logger.info('App component rendering...');

  // Initialize the application (load accounts, proxy settings, etc.)
  useAccountInitializer();

  // Stable log handler using ref
  const handleLogAdd = useCallback((log: any) => {
    // Add additional check to prevent potential loops
    if (log && typeof log === 'object' && log.msg) {
      addLogRef.current(log);
    }
  }, []);

  // Stable connection status handler using ref
  const handleConnectionStatus = useCallback(({ accountId, status }: { accountId: string, status: 'connected' | 'connecting' | 'disconnected' }) => {
    setAccountConnectionStatusRef.current(accountId, status);
  }, []);

  useEffect(() => {
    // Prevent multiple initializations
    if (isInitialized.current) {
      return;
    }

    try {
      // Listen for log messages from the main process
      window.ipcApi.on('log:add', handleLogAdd);

      // Listen for account connection status updates
      window.ipcApi.on('account:connection-status', handleConnectionStatus);

      // Notify the main process that the renderer is ready
      void window.ipcApi.rendererReady();

      isInitialized.current = true;
    } catch (error) {
      logger.error(`Failed to initialize application: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

  }, []); // Remove dependencies to prevent re-initialization

  return (
    <ThemeProvider defaultTheme="dark" storageKey="imapviewer-ui-theme">
      <ErrorBoundary>
        <Layout />
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            style: {
              background: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              color: 'hsl(var(--foreground))',
            },
          }}
        />
      </ErrorBoundary>
    </ThemeProvider>
  );
};

export default App;