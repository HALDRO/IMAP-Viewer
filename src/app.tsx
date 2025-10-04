import type React from 'react'
import { useCallback, useEffect, useRef } from 'react'
import { Toaster } from 'sonner'

import ErrorBoundary from './components/ErrorBoundary'
import Layout from './components/Layout'
import type { UILog } from './services/logger'
import { useAccountInitializer } from './shared/hooks/useAccountInitializer'
import { useAccountStore } from './shared/store/accounts/accountStore'
import { useLogStore } from './shared/store/logStore'
import { useUIStore } from './shared/store/uiStore'
import { ThemeProvider } from './shared/ui/theme-provider'
import { logger } from './shared/utils/logger'

const App = (): React.JSX.Element => {
  const isInitialized = useRef(false)

  logger.info('App component rendering...')

  // Initialize the application (load accounts, proxy, main settings, UI config, etc.)
  useAccountInitializer()

  useEffect(() => {
    // Prevent multiple initializations
    if (isInitialized.current) {
      return
    }

    const handleLogAdd = (log: UILog) => {
      if (log.msg) {
        useLogStore.getState().addLog(log)
      }
    }

    const handleConnectionStatus = ({
      accountId,
      status,
    }: { accountId: string; status: 'connected' | 'connecting' | 'disconnected' }) => {
      useAccountStore.getState().setAccountConnectionStatus(accountId, status)
    }

    try {
      // Load UI config from file once on startup
      void useUIStore.getState().loadConfig()

      // Listen for log messages from the main process
      window.ipcApi.on('log:add', handleLogAdd)

      // Listen for account connection status updates
      window.ipcApi.on('account:connection-status', handleConnectionStatus)

      // Notify the main process that the renderer is ready
      void window.ipcApi.rendererReady()

      isInitialized.current = true
    } catch (error) {
      logger.error(
        `Failed to initialize application: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }, [])

  return (
    <ThemeProvider defaultTheme="dark" storageKey="iview-ui-theme">
      <ErrorBoundary>
        <Layout />
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            style: {
              background: 'rgb(var(--background))',
              border: '1px solid rgb(var(--border))',
              color: 'rgb(var(--foreground))',
            },
          }}
        />
      </ErrorBoundary>
    </ThemeProvider>
  )
}

export default App
