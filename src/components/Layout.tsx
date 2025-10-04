/**
 * @file Main layout component with shadcn resizable panels architecture
 * @description Fully unified three-level resizable panel architecture using only shadcn components (ResizablePanel/ResizablePanelGroup/ResizableHandle):
 *
 * Layout structure:
 * - Level 1 (horizontal): Main area + Right account panel
 *   - Level 2 (vertical): Content + Log panel
 *     - Level 3 (horizontal): Left email list + Center email view
 *
 * All panels support:
 * - Mouse drag resizing via ResizableHandle
 * - Programmatic collapse/expand via ImperativePanelHandle refs
 * - State persistence via UIStore + localStorage
 * - Callbacks: onResize, onCollapse, onExpand sync with store
 *
 * Browser: Always-mounted overlay (z-30) over email view panel, visibility controlled via CSS
 * Minimum window size: 900x700 to ensure all panels are usable
 *
 * Architecture improvements:
 * - Eliminated raw Panel/PanelGroup mixing (was breaking resize functionality)
 * - Uniform shadcn ResizablePanel* everywhere enables proper mouse drag
 * - Imperative refs (leftPanelRef, logPanelRef, accountManagerPanelRef) for programmatic control
 * - useEffect hooks sync collapsed state changes from buttons/store to panel API
 * - InAppBrowser always mounted to preserve WebContentsView state (history, cookies, DOM) across navigation
 * - Removed mobile layout logic as Electron apps run only on desktop platforms
 */
import { motion } from 'framer-motion'
import { Eraser, Globe, PanelLeft } from 'lucide-react'
import React, { useState, useRef } from 'react'
import type { ImperativePanelHandle } from 'react-resizable-panels'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../shared/ui/resizable'

import { useAccountStore } from '../shared/store/accounts/accountStore'
import { useMainSettingsStore } from '../shared/store/mainSettingsStore'
import { useUIStore } from '../shared/store/uiStore'
import { ToastContainer } from '../shared/ui/Toast'
import { Button } from '../shared/ui/button'
import { TopBar, TopBarSection, TopBarTitle } from '../shared/ui/top-bar'
import { TopBarAccountSection } from '../shared/ui/top-bar-account-section'
import { logger as appLogger } from '../shared/utils/logger'
import { cn } from '../shared/utils/utils'

import AccountManagerPanel from './AccountManager'
import { ClearBrowserDataDialog } from './ClearBrowserDataDialog'
import { DeleteAllAccountsDialog } from './DeleteAllAccountsDialog'
import EmailListPanel from './EmailListPanel'
import EmailViewPanel from './EmailViewPanel'
import { ImportDialog } from './ImportDialog'
import InAppBrowser from './InAppBrowser'
import LogPanel from './LogPanel'

const Layout = (): React.JSX.Element => {
  const accounts = useAccountStore(state => state.accounts)
  const accountCount = React.useMemo(() => accounts.length, [accounts.length])
  const { settings } = useMainSettingsStore()
  const {
    currentView,
    openSettings,
    closeSettings,
    isLeftPanelCollapsed: isLeftPanelHidden,
    setLeftPanelCollapsed: setLeftPanelHidden,
    isSettingsOpen,
    isAccountPanelCollapsed,
    setAccountPanelCollapsed,
    isLogPanelCollapsed,
    leftPanelWidth,
    rightPanelWidth,
    logPanelHeight,
    setPanelSizes,
    loadConfig,
    isBrowserOpen,
    isBrowserMinimized,
    browserUrl,
  } = useUIStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [isConnectingAll, setIsConnectingAll] = useState(false)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [isDeleteAllDialogOpen, setIsDeleteAllDialogOpen] = useState(false)
  const [isClearBrowserDataDialogOpen, setIsClearBrowserDataDialogOpen] = useState(false)
  const accountManagerPanelRef = useRef<ImperativePanelHandle>(null)
  const logPanelRef = useRef<ImperativePanelHandle>(null)
  const leftPanelRef = useRef<ImperativePanelHandle>(null)

  // Load UI config on mount
  React.useEffect(() => {
    void loadConfig()
  }, [loadConfig])

  // Sync left panel
  const handleLeftPanelCollapse = React.useCallback(() => {
    leftPanelRef.current?.collapse()
  }, [])

  const handleLeftPanelExpand = React.useCallback(() => {
    leftPanelRef.current?.expand()
  }, [])

  React.useEffect(() => {
    if (isLeftPanelHidden) {
      handleLeftPanelCollapse()
    } else {
      handleLeftPanelExpand()
    }
  }, [isLeftPanelHidden, handleLeftPanelCollapse, handleLeftPanelExpand])

  // Sync log panel
  const handleLogPanelCollapse = React.useCallback(() => {
    logPanelRef.current?.collapse()
  }, [])

  const handleLogPanelExpand = React.useCallback(() => {
    logPanelRef.current?.expand()
  }, [])

  React.useEffect(() => {
    if (isLogPanelCollapsed) {
      handleLogPanelCollapse()
    } else {
      handleLogPanelExpand()
    }
  }, [isLogPanelCollapsed, handleLogPanelCollapse, handleLogPanelExpand])

  // Sync account panel - inline calls to avoid unused vars
  React.useEffect(() => {
    if (isAccountPanelCollapsed) {
      accountManagerPanelRef.current?.collapse()
    } else {
      accountManagerPanelRef.current?.expand()
    }
  }, [isAccountPanelCollapsed])

  // handleConnectAllAccounts - remains the same
  const handleConnectAllAccounts = React.useCallback(() => {
    const currentAccounts = useAccountStore.getState().accounts

    if (currentAccounts.length === 0) {
      appLogger.info('No accounts to connect to.')
      return
    }

    setIsConnectingAll(true)
    try {
      appLogger.info(`Starting to connect to ${currentAccounts.length} accounts...`)

      for (const account of currentAccounts) {
        void window.ipcApi.watchInbox(account.id)
      }

      appLogger.info(`Successfully started watching ${currentAccounts.length} accounts.`)
    } catch (error) {
      appLogger.error(
        `Failed to connect to accounts: ${error instanceof Error ? error.message : String(error)}`
      )
    } finally {
      setIsConnectingAll(false)
    }
  }, [])

  // Other handlers remain the same: handleDataFiles, handleImportAccounts, handleDeleteAllAccounts, handleToggleBrowser, handleClearBrowserData, handleConfirmClearBrowserData, handleConfirmDeleteAll

  const handleDataFiles = React.useCallback(async () => {
    try {
      await window.ipcApi.openDataFolder()
      appLogger.info('Data folder opened')
    } catch (error) {
      appLogger.error('Failed to open data folder:', error as object)
    }
  }, [])

  const handleImportAccounts = React.useCallback(() => {
    setIsImportDialogOpen(true)
  }, [])

  const handleDeleteAllAccounts = React.useCallback(() => {
    setIsDeleteAllDialogOpen(true)
  }, [])

  const handleToggleBrowser = React.useCallback(() => {
    const { openBrowser, minimizeBrowser, isBrowserOpen, isBrowserMinimized } =
      useUIStore.getState()

    if (isBrowserOpen && !isBrowserMinimized) {
      minimizeBrowser()
    } else {
      openBrowser('https://www.duckduckgo.com')
    }
  }, [])

  const handleClearBrowserData = React.useCallback(() => {
    setIsClearBrowserDataDialogOpen(true)
  }, [])

  const handleConfirmClearBrowserData = React.useCallback(async () => {
    try {
      const result = await window.ipcApi.clearBrowserData()
      if (result.success) {
        appLogger.info('Browser data cleared successfully')
      } else {
        appLogger.error(`Failed to clear browser data: ${result.error ?? 'Unknown error'}`)
      }
    } catch (error) {
      appLogger.error('Error clearing browser data:', error as object)
    }
  }, [])

  const handleConfirmDeleteAll = React.useCallback(async () => {
    try {
      await window.ipcApi.deleteAllAccounts()

      const { deleteAllAccounts } = useAccountStore.getState()
      deleteAllAccounts()

      appLogger.info('All accounts deleted by user')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      appLogger.error('Failed to delete all accounts:', { error: errorMessage })
    }
  }, [])

  // handleToggleAccountPanel - remains, toggles setAccountPanelCollapsed
  const handleToggleAccountPanel = React.useCallback(() => {
    setAccountPanelCollapsed(!isAccountPanelCollapsed)
  }, [isAccountPanelCollapsed, setAccountPanelCollapsed])

  // handleToggleLeftPanel
  const handleToggleLeftPanel = React.useCallback(() => {
    if (isLeftPanelHidden) {
      handleLeftPanelExpand()
    } else {
      handleLeftPanelCollapse()
    }
  }, [isLeftPanelHidden, handleLeftPanelExpand, handleLeftPanelCollapse])

  // Handle layout changes - called only when resize is complete (mouse up)
  const handleMainLayoutChange = React.useCallback(
    (sizes: number[]) => {
      if (sizes.length >= 2) {
        setPanelSizes({ rightPanelWidth: sizes[1] })
      }
    },
    [setPanelSizes]
  )

  const handleContentLayoutChange = React.useCallback(
    (sizes: number[]) => {
      if (sizes.length >= 2) {
        setPanelSizes({ logPanelHeight: sizes[1] })
      }
    },
    [setPanelSizes]
  )

  const handleEmailLayoutChange = React.useCallback(
    (sizes: number[]) => {
      if (sizes.length >= 2) {
        setPanelSizes({ leftPanelWidth: sizes[0] })
      }
    },
    [setPanelSizes]
  )

  // getViewTitle - remains
  const getViewTitle = React.useMemo(() => {
    switch (currentView) {
      case 'settings':
        return 'Settings'
      default:
        return 'IMAP Viewer'
    }
  }, [currentView])

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background text-foreground">
      {/* Top Bar */}
      <TopBar>
        <TopBarSection side="left" className="pl-1 pr-1">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleToggleLeftPanel}
              className="rounded-full h-9 w-9"
              title={isLeftPanelHidden ? 'Expand left panel' : 'Collapse left panel'}
            >
              <PanelLeft size={18} />
            </Button>
            <Button
              variant={isBrowserOpen && !isBrowserMinimized ? 'default' : 'ghost'}
              size="sm"
              onClick={handleToggleBrowser}
              className="rounded-full h-9 px-3 gap-1.5"
              title={
                isBrowserOpen && !isBrowserMinimized
                  ? 'Minimize browser (Ctrl+Shift+B)'
                  : 'Open browser (Ctrl+Shift+B)'
              }
            >
              <Globe size={16} />
              <span className="text-sm font-medium">Browser</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClearBrowserData}
              className="rounded-full h-9 w-9"
              title="Clear browser data"
            >
              <Eraser size={16} />
            </Button>
          </div>
        </TopBarSection>

        <TopBarSection side="center">
          {currentView === 'settings' ? (
            <TopBarTitle size="md">{getViewTitle}</TopBarTitle>
          ) : (
            <div className="flex items-center justify-center gap-3">
              <img
                src="/icon.svg"
                alt="IMAP Viewer"
                className="h-11 w-11 transition-transform hover:scale-125"
                onError={e => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            </div>
          )}
        </TopBarSection>

        <TopBarSection side="right" className="pl-1 pr-0">
          <TopBarAccountSection
            accountCount={accountCount}
            isCollapsed={isAccountPanelCollapsed}
            isConnectingAll={isConnectingAll}
            isSettingsOpen={isSettingsOpen}
            onSettings={isSettingsOpen ? closeSettings : openSettings}
            onToggleCollapse={handleToggleAccountPanel}
            onConnectAll={handleConnectAllAccounts}
            onDataFiles={handleDataFiles}
            onImportAccounts={handleImportAccounts}
            onDeleteAllAccounts={handleDeleteAllAccounts}
          />
        </TopBarSection>
      </TopBar>

      {/* Main content */}
      <div className="flex-1 overflow-hidden relative">
        {/* Desktop: ResizablePanelGroup horizontal for main + right */}
        <ResizablePanelGroup direction="horizontal" onLayout={handleMainLayoutChange}>
          <ResizablePanel defaultSize={100 - rightPanelWidth} minSize={60}>
            {/* Main content: vertical group left-center-log */}
            <ResizablePanelGroup direction="vertical" onLayout={handleContentLayoutChange}>
              <ResizablePanel defaultSize={100 - logPanelHeight} minSize={40}>
                <ResizablePanelGroup direction="horizontal" onLayout={handleEmailLayoutChange}>
                  <ResizablePanel
                    ref={leftPanelRef}
                    defaultSize={leftPanelWidth}
                    minSize={7}
                    maxSize={40}
                    collapsible
                    collapsedSize={5}
                    onCollapse={() => setLeftPanelHidden(true)}
                    onExpand={() => setLeftPanelHidden(false)}
                    className={cn(
                      'min-w-20',
                      'border-r border-border' // Always show 1px border (ResizableHandle no longer provides background)
                    )}
                  >
                    <EmailListPanel
                      searchQuery={searchQuery}
                      onSearchChange={setSearchQuery}
                      collapsed={isLeftPanelHidden}
                    />
                  </ResizablePanel>

                  <ResizableHandle className="hover:bg-primary/20" />

                  <ResizablePanel minSize={30} className="relative">
                    <div className="h-full flex flex-col">
                      <div className="flex-1">
                        <EmailViewPanel searchQuery={searchQuery} />
                      </div>
                      {/* Browser overlay - always mounted, visibility controlled via CSS (--z-browser: 20) */}
                      <motion.div
                        initial={false}
                        animate={{
                          opacity: isBrowserOpen && !isBrowserMinimized ? 1 : 0,
                          pointerEvents: isBrowserOpen && !isBrowserMinimized ? 'auto' : 'none',
                        }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        className="absolute inset-0 z-[var(--z-browser)] bg-background"
                      >
                        <InAppBrowser
                          initialUrl={browserUrl || 'https://www.google.com'}
                          isVisible={isBrowserOpen && !isBrowserMinimized}
                          onUrlChange={url => {
                            appLogger.info(`Browser URL changed to: ${url}`)
                          }}
                        />
                      </motion.div>
                    </div>
                  </ResizablePanel>
                </ResizablePanelGroup>
              </ResizablePanel>

              {!settings.hideEventLogger && (
                <>
                  {!isLogPanelCollapsed && <ResizableHandle className="hover:bg-primary/20" />}
                  <ResizablePanel
                    ref={logPanelRef}
                    defaultSize={15}
                    collapsible
                    collapsedSize={6}
                    className={cn(
                      'min-h-[56px]',
                      isLogPanelCollapsed ? 'border-t border-border' : '' // Conditional border: 1px collapsed only, expanded has ResizableHandle (1px)
                    )}
                    onCollapse={() => useUIStore.getState().setLogPanelCollapsed(true)}
                    onExpand={() => useUIStore.getState().setLogPanelCollapsed(false)}
                  >
                    <LogPanel />
                  </ResizablePanel>
                </>
              )}
            </ResizablePanelGroup>
          </ResizablePanel>

          <ResizableHandle className="hover:bg-primary/20" />

          <ResizablePanel
            ref={accountManagerPanelRef}
            defaultSize={rightPanelWidth}
            minSize={8} // 8% min in expanded
            maxSize={40}
            collapsible
            collapsedSize={6} // 6% when collapsed
            onCollapse={() => setAccountPanelCollapsed(true)}
            onExpand={() => setAccountPanelCollapsed(false)}
            data-panel-id="account-panel"
            className={cn(
              'flex flex-col bg-background min-w-20', // Base styles
              'border-l border-border' // Always show 1px border (ResizableHandle no longer provides background)
            )}
          >
            <AccountManagerPanel
              collapsed={isAccountPanelCollapsed}
              onRequestExpand={() => setAccountPanelCollapsed(false)}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Toast notifications - remains */}
      <ToastContainer />

      {/* Dialogs - remain the same */}
      <ImportDialog
        isOpen={isImportDialogOpen}
        onClose={() => setIsImportDialogOpen(false)}
        onImportComplete={() => {
          setIsImportDialogOpen(false)
        }}
      />

      <DeleteAllAccountsDialog
        isOpen={isDeleteAllDialogOpen}
        onClose={() => setIsDeleteAllDialogOpen(false)}
        onConfirm={handleConfirmDeleteAll}
        accountCount={accountCount}
      />

      <ClearBrowserDataDialog
        isOpen={isClearBrowserDataDialogOpen}
        onClose={() => setIsClearBrowserDataDialogOpen(false)}
        onConfirm={handleConfirmClearBrowserData}
      />
    </div>
  )
}

export default Layout
