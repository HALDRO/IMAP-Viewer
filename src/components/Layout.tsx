/**
 * @file The main layout component using react-resizable-panels.
 * It sets up the three-panel view for the application.
 */
import { ArrowLeft, PanelLeft } from 'lucide-react';
import React, { useEffect, useState, useRef } from 'react';
import { Panel, PanelGroup, PanelResizeHandle, type ImperativePanelHandle } from 'react-resizable-panels';


import { useAccountStore } from '../shared/store/accounts/accountStore';
import { useMainSettingsStore } from '../shared/store/mainSettingsStore';
import { useUIStore } from '../shared/store/uiStore';
import { Button } from '../shared/ui/button';
import { ToastContainer } from '../shared/ui/Toast';
import { TopBar, TopBarSection, TopBarTitle, TopBarSearch } from '../shared/ui/top-bar';
import { TopBarAccountSection } from '../shared/ui/top-bar-account-section';
import { logger as appLogger } from '../shared/utils/logger';

import AccountManagerPanel from './AccountManager';
import { DeleteAllAccountsDialog } from './DeleteAllAccountsDialog';
import EmailListPanel from './EmailListPanel';
import EmailViewPanel from './EmailViewPanel';
import { ImportDialog } from './ImportDialog';
import LogPanel from './LogPanel';

/**
 * Global styles for YouTube-inspired dark mode theme
 */
const GlobalStyles = (): null => {
  useEffect(() => {
    // Add dark class to body for dark theme
    document.body.classList.add('dark');

    const style = document.createElement('style');
    style.textContent = `
      /* Utility class to hide number input spinners */
      .hide-spin-buttons::-webkit-outer-spin-button,
      .hide-spin-buttons::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
      .hide-spin-buttons {
        -moz-appearance: textfield !important;
      }

      /* Hide number input spinners (general rule, kept as fallback) */
      input[type='number']::-webkit-outer-spin-button,
      input[type='number']::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
      input[type='number'] {
        -moz-appearance: textfield;
      }
      
      /* Selection color */
      ::selection {
        background: rgba(59, 130, 246, 0.4);
        color: white;
      }
      
      /* YouTube-style focus outlines */
      *:focus-visible {
        outline: 2px solid rgba(59, 130, 246, 0.5);
        outline-offset: 2px;
      }
    `;
    document.head.appendChild(style);
    
    return (): void => {
      style.remove();
    };
  }, []);
  
  return null;
};

/**
 * Custom resize handle with YouTube-inspired design
 */
const CustomResizeHandle = ({ direction = 'horizontal', className = '' }: { direction?: 'horizontal' | 'vertical'; className?: string }): React.JSX.Element => {
  return (
    <PanelResizeHandle
      className={`flex items-center justify-center transition-colors bg-border ${
        direction === 'horizontal'
          ? 'w-px hover:bg-primary/20'
          : 'h-px hover:bg-primary/20'
      } ${className}`}
    />
  );
};

const Layout = (): React.JSX.Element => {
  const accounts = useAccountStore((state) => state.accounts);
  const accountCount = React.useMemo(() => accounts.length, [accounts.length]);
  const { settings } = useMainSettingsStore();
  const {
    currentView,
    openSettings,
    closeSettings,
    isLeftPanelHidden,
    setLeftPanelHidden,
    isSettingsOpen,
    isAccountPanelCollapsed,
    setAccountPanelCollapsed,
    isLogPanelCollapsed,
    leftPanelWidth,
    rightPanelWidth,
    logPanelHeight,
    setPanelSizes,
    loadConfig
  } = useUIStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isConnectingAll, setIsConnectingAll] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isDeleteAllDialogOpen, setIsDeleteAllDialogOpen] = useState(false);
  const accountManagerPanelRef = useRef<ImperativePanelHandle>(null);
  const logPanelRef = useRef<ImperativePanelHandle>(null);

  // Load UI config on mount
  React.useEffect(() => {
    void loadConfig();
  }, [loadConfig]); // Include loadConfig dependency

  const handleCollapse = React.useCallback(() => {
    accountManagerPanelRef.current?.collapse();
  }, []);

  const handleExpand = React.useCallback(() => {
    accountManagerPanelRef.current?.expand();
  }, []);

  const handleLogPanelCollapse = React.useCallback(() => {
    logPanelRef.current?.collapse();
  }, []);

  const handleLogPanelExpand = React.useCallback(() => {
    logPanelRef.current?.expand();
  }, []);

  // Sync log panel state with UI store
  React.useEffect(() => {
    if (isLogPanelCollapsed) {
      handleLogPanelCollapse();
    } else {
      handleLogPanelExpand();
    }
  }, [isLogPanelCollapsed, handleLogPanelCollapse, handleLogPanelExpand]);

  const handleConnectAllAccounts = React.useCallback(() => {
    // Получаем актуальные аккаунты из стора
    const currentAccounts = useAccountStore.getState().accounts;
    
    if (currentAccounts.length === 0) {
      appLogger.info('No accounts to connect to.');
      return;
    }

    setIsConnectingAll(true);
    try {
      appLogger.info(`Starting to connect to ${currentAccounts.length} accounts...`);

      // Start watching all accounts in the background
      currentAccounts.forEach(account => {
        void window.ipcApi.watchInbox(account.id);
      });

      appLogger.info(`Successfully started watching ${currentAccounts.length} accounts.`);
    } catch (error) {
      appLogger.error(`Failed to connect to accounts: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsConnectingAll(false);
    }
  }, []); // Убираем зависимость от accounts

  // Handle data files access
  const handleDataFiles = React.useCallback(async () => {
    try {
      await window.ipcApi.openDataFolder();
      appLogger.info('Data folder opened');
    } catch (error) {
      appLogger.error('Failed to open data folder:', error as object);
    }
  }, []);

  // Handle import accounts
  const handleImportAccounts = React.useCallback(() => {
    setIsImportDialogOpen(true);
  }, []);

  // Handle delete all accounts
  const handleDeleteAllAccounts = React.useCallback(() => {
    setIsDeleteAllDialogOpen(true);
  }, []);

  // Handle confirm delete all accounts
  const handleConfirmDeleteAll = React.useCallback(async () => {
    try {
      // First delete all accounts from file via IPC
      await window.ipcApi.deleteAllAccounts();

      // Then clear the store
      const { deleteAllAccounts } = useAccountStore.getState();
      deleteAllAccounts();

      appLogger.info('All accounts deleted by user');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      appLogger.error('Failed to delete all accounts:', { error: errorMessage });
    }
  }, []);

  // Handle left panel toggle
  const handleToggleLeftPanel = React.useCallback(() => {
    setLeftPanelHidden(!isLeftPanelHidden);
  }, [isLeftPanelHidden, setLeftPanelHidden]);

  const handleToggleAccountPanel = React.useCallback(() => {
    if (isAccountPanelCollapsed) {
      handleExpand();
    } else {
      handleCollapse();
    }
  }, [isAccountPanelCollapsed, handleExpand, handleCollapse]);

  // Handle panel resize - optimized for performance during drag
  const handleLeftPanelResize = React.useCallback((size: number) => {
    // Minimal operations during resize for smooth dragging
    setPanelSizes({ leftPanelWidth: size });
  }, [setPanelSizes]);

  const handleRightPanelResize = React.useCallback((size: number) => {
    setPanelSizes({ rightPanelWidth: size });
  }, [setPanelSizes]);

  const handleLogPanelResize = React.useCallback((size: number) => {
    // Minimal operations during resize for smooth dragging
    setPanelSizes({ logPanelHeight: size });
  }, [setPanelSizes]);

  // Get current view title
  const getViewTitle = React.useMemo(() => {
    switch (currentView) {
      case 'settings':
        return 'Settings';
      case 'email':
      default:
        return 'IMAP Viewer';
    }
  }, [currentView]);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background text-foreground">
      <GlobalStyles />

      {/* Skip to main content link for accessibility */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Top Bar */}
      <TopBar>
        <TopBarSection side="left" className="pl-1 pr-1">
          {currentView === 'settings' ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={closeSettings}
              className="rounded-full h-9 w-9"
            >
              <ArrowLeft size={18} />
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleToggleLeftPanel}
                className="rounded-full h-8 w-8"
                title={isLeftPanelHidden ? "Show left panel" : "Hide left panel"}
              >
                <PanelLeft size={16} />
              </Button>
              <TopBarSearch
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search..."
              />
            </div>
          )}
        </TopBarSection>

        <TopBarSection side="center">
          <TopBarTitle size="md">{getViewTitle}</TopBarTitle>
        </TopBarSection>

        <TopBarSection side="right" className="pl-1 pr-0.0">
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

      <div className="flex-1 overflow-hidden">
        <PanelGroup
          direction="horizontal"
          aria-label="Main application layout"
          storage={{
            getItem: (name: string) => {
              const value = localStorage.getItem(`panel-layout-${name}`);
              return value !== null && value.length > 0 ? JSON.parse(value) : null;
            },
            setItem: (name: string, value: unknown) => {
              localStorage.setItem(`panel-layout-${name}`, JSON.stringify(value));
            }
          }}
        >
        <Panel id="main-panel" order={1}>
          <PanelGroup
            direction="vertical"
            storage={{
              getItem: (name: string) => {
                const value = localStorage.getItem(`panel-layout-vertical-${name}`);
                return value !== null && value.length > 0 ? JSON.parse(value) : null;
              },
              setItem: (name: string, value: unknown) => {
                localStorage.setItem(`panel-layout-vertical-${name}`, JSON.stringify(value));
              }
            }}
          >
            <Panel id="content-panel" order={1}>
              <PanelGroup
                direction="horizontal"
                storage={{
                  getItem: (name: string) => {
                    const value = localStorage.getItem(`panel-layout-content-${name}`);
                    return value !== null && value.length > 0 ? JSON.parse(value) : null;
                  },
                  setItem: (name: string, value: unknown) => {
                    localStorage.setItem(`panel-layout-content-${name}`, JSON.stringify(value));
                  }
                }}
              >
                {!isLeftPanelHidden && (
                  <>
                    <Panel
                      id="left-panel"
                      order={1}
                      defaultSize={leftPanelWidth}
                      minSize={20}
                      className="border-r border-border"
                      onResize={handleLeftPanelResize}
                    >
                      <EmailListPanel searchQuery={searchQuery} />
                    </Panel>
                    <CustomResizeHandle direction="horizontal" />
                  </>
                )}
                <Panel id="email-view-panel" order={2} minSize={30}>
                  <div className="h-full flex flex-col">
                    <div className="flex-1">
                      <EmailViewPanel searchQuery={searchQuery} />
                    </div>
                  </div>
                </Panel>
              </PanelGroup>
            </Panel>
            {!settings.hideEventLogger && (
              <>
                <CustomResizeHandle direction="vertical" />
                <Panel
                  id="log-panel"
                  order={2}
                  ref={logPanelRef}
                  defaultSize={logPanelHeight}
                  minSize={10}
                  collapsible
                  collapsedSize={8}
                  className="border border-border"
                  onResize={handleLogPanelResize}
                  onCollapse={() => {
                    // Panel collapsed by user interaction
                  }}
                  onExpand={() => {
                    // Panel expanded by user interaction
                  }}
                >
                  <LogPanel />
                </Panel>
              </>
            )}
          </PanelGroup>
        </Panel>
        <CustomResizeHandle direction="horizontal" />
        <Panel
          id="account-panel"
          ref={accountManagerPanelRef}
          defaultSize={rightPanelWidth}
          minSize={15}
          maxSize={40}
          collapsible
          collapsedSize={7}
          onCollapse={() => setAccountPanelCollapsed(true)}
          onExpand={() => setAccountPanelCollapsed(false)}
          onResize={handleRightPanelResize}
          order={2}
        >
          <div className="h-full w-full">
            <AccountManagerPanel
              collapsed={isAccountPanelCollapsed}
            />
          </div>
        </Panel>
      </PanelGroup>
      </div>

      {/* Toast notifications */}
      <ToastContainer />

      {/* Import Dialog */}
      <ImportDialog
        isOpen={isImportDialogOpen}
        onClose={() => setIsImportDialogOpen(false)}
        onImportComplete={() => {
          setIsImportDialogOpen(false);
          // Accounts will be automatically updated through the store
        }}
      />

      {/* Delete All Accounts Dialog */}
      <DeleteAllAccountsDialog
        isOpen={isDeleteAllDialogOpen}
        onClose={() => setIsDeleteAllDialogOpen(false)}
        onConfirm={handleConfirmDeleteAll}
                      accountCount={accountCount}
      />
    </div>
  );
};

export default Layout;
