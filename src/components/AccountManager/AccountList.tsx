/**
 * @file Account list component for displaying and managing accounts
 */
import { Copy, Edit, Trash2, LogIn } from 'lucide-react';
import React, { useRef, useEffect, useCallback } from 'react';

import type { Account } from '../../shared/types/account';
import { useMainSettingsStore } from '../../shared/store/mainSettingsStore';
import { Avatar, AvatarFallback, CustomScrollbar } from '../../shared/ui';
import { Button } from '../../shared/ui/button';
import { cn } from '../../shared/utils/utils';

interface AccountListProps {
  accounts: Account[];
  selectedAccountId: string | null;
  recentlyDeletedId: string | null;
  onSelectAccount: (accountId: string) => void;
  onContextMenu: (e: React.MouseEvent, accountId: string) => void;
  onEdit: (account: Account) => void;
  onDelete: (accountId: string) => void;
  onUndo: (accountId: string) => void;
  onCopyCredentials: (account: Account) => void;
  onConnectAccount?: (accountId: string) => void;
  collapsed?: boolean;
  onSaveScrollPosition?: (position: number) => void;
  scrollPositionToRestore?: number;
}

// Мемоизированный компонент для отдельного элемента аккаунта
const AccountListItem = React.memo<{
  account: Account;
  index: number;
  isSelected: boolean;
  recentlyDeletedId: string | null;
  onSelectAccount: (accountId: string) => void;
  onContextMenu: (e: React.MouseEvent, accountId: string) => void;
  onEdit: (account: Account) => void;
  onDelete: (accountId: string) => void;
  onCopyCredentials: (account: Account) => void;
  onConnectAccount?: (accountId: string) => void;
  onSaveScrollPosition?: (position: number) => void;
  scrollContainerRef: React.RefObject<HTMLDivElement>;
  settings: any;
}>(({ account, index, isSelected, recentlyDeletedId, onSelectAccount, onContextMenu, onEdit, onDelete, onCopyCredentials, onConnectAccount, onSaveScrollPosition, scrollContainerRef, settings }) => {
  
  const handleSelectAccount = useCallback(() => {
    const debugMode = JSON.parse(localStorage.getItem('main-settings-storage') || '{}')?.state?.settings?.debugMode;
    if (debugMode) {
      window.ipcApi.logMessage('info', `🔍 DIAGNOSTIC: Account clicked (expanded): ${account.id} (${account.email})`);
    }
    onSelectAccount(account.id);
  }, [account.id, account.email, onSelectAccount]);
  
  const handleEdit = useCallback(() => {
    if (onSaveScrollPosition && scrollContainerRef.current) {
      onSaveScrollPosition(scrollContainerRef.current.scrollTop);
    }
    onEdit(account);
  }, [account, onEdit, onSaveScrollPosition, scrollContainerRef]);
  
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    onContextMenu(e, account.id);
  }, [account.id, onContextMenu]);
  
  const handleDelete = useCallback(() => {
    onDelete(account.id);
  }, [account.id, onDelete]);
  
  const handleCopyCredentials = useCallback(() => {
    onCopyCredentials(account);
  }, [account, onCopyCredentials]);
  
  const handleConnect = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (onConnectAccount) {
      onConnectAccount(account.id);
    }
  }, [account.id, onConnectAccount]);

  const displayLabel = account.displayName ?? account.email;
  const isDefaultName = /^Account \d+ \w+$/.test(account.displayName ?? '');
  const avatarName = isDefaultName ? account.email : account.displayName;

  return (
    <div
      className={`
        relative rounded-lg transition-all duration-75 group overflow-hidden
        ${isSelected ? 'bg-blue-900/30' : 'hover:bg-white/5'}
      `}
      onDoubleClick={handleEdit}
      onContextMenu={handleContextMenu}
    >
      <div className={cn("flex items-center", settings.compactAccountView === true ? "p-1.5" : "p-2")}>
        <div
          className="flex items-center flex-grow gap-3 min-w-0 text-left cursor-pointer"
          onClick={handleSelectAccount}
          title={account.email}
        >
          {settings.compactAccountView === true ? (
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span
                className={cn(
                  "text-xs font-mono w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0",
                  account.connectionStatus === 'connected' ? "bg-green-500/20 text-green-400" :
                  account.connectionStatus === 'connecting' ? "bg-yellow-500/20 text-yellow-400" :
                  "bg-red-500/20 text-red-400"
                )}
                title={`Account ${index + 1} - ${account.connectionStatus ?? 'disconnected'}`}
              >
                {index + 1}
              </span>
              <span className="text-sm truncate">
                {displayLabel}
              </span>
            </div>
          ) : (
            <>
              <div className="relative group/avatar">
                <Avatar className={cn(
                  "w-10 h-10",
                  isSelected && "ring-2 ring-primary"
                )}>
                  <AvatarFallback className={cn(
                    "font-medium text-sm",
                    isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                  )}>
                    {(avatarName?.length ?? 0) > 0 ?
                      (avatarName ?? '').split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase() :
                      account.email[0]?.toUpperCase() ?? '?'
                    }
                  </AvatarFallback>
                </Avatar>

                {/* Login hover button for avatar */}
                {onConnectAccount && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-0 bg-black/50 rounded-full">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleConnect}
                      className="h-6 w-6 bg-card/95 backdrop-blur-sm border border-border shadow-lg hover:bg-accent/50"
                      title="Connect to account"
                    >
                      <LogIn size={12} />
                    </Button>
                  </div>
                )}

                {/* Index number */}
                <div className="absolute -top-1 -left-1 rounded-full border-2 border-background bg-muted text-muted-foreground text-xs font-bold flex items-center justify-center w-5 h-5">
                  {index + 1}
                </div>

                {/* Status indicator */}
                {account.connectionStatus && (
                  <div className={cn(
                    "absolute -bottom-1 -right-1 rounded-full border-2 border-background w-3 h-3",
                    account.connectionStatus === 'connected' && 'bg-green-500',
                    account.connectionStatus === 'connecting' && 'bg-yellow-500',
                    account.connectionStatus === 'disconnected' && 'bg-red-500'
                  )} />
                )}
              </div>

              <div className="flex-grow min-w-0 overflow-hidden">
                <p className={`truncate text-sm ${isSelected ? 'text-blue-200 font-medium' : 'text-gray-200'}`}>
                  {displayLabel}
                </p>
                <p className="truncate text-xs text-gray-400">{account.email}</p>
              </div>
            </>
          )}
        </div>
      </div>

      <div
        className={cn(
          "absolute inset-y-0 right-0 flex items-center opacity-0 transition-opacity duration-0",
          recentlyDeletedId !== account.id && "group-hover:opacity-100"
        )}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-full items-center gap-0.5 bg-card/95 backdrop-blur-sm px-2 py-1 rounded-l-full border-l border-t border-b border-border shadow-lg">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full hover:bg-accent/50"
            onClick={handleCopyCredentials}
            title="Copy credentials"
          >
            <Copy size={12} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full hover:bg-accent/50"
            onClick={handleEdit}
            title="Edit account"
          >
            <Edit size={12} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleDelete}
            title="Delete account"
          >
            <Trash2 size={12} />
          </Button>
        </div>
      </div>
    </div>
  );
});

export const AccountList: React.FC<AccountListProps> = React.memo(({
  accounts,
  selectedAccountId,
  recentlyDeletedId,
  onSelectAccount,
  onContextMenu,
  onEdit,
  onDelete,
  onUndo,
  onCopyCredentials,
  onConnectAccount,
  collapsed = false,
  onSaveScrollPosition,
  scrollPositionToRestore,
}) => {
  const { settings } = useMainSettingsStore();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Handle scroll position restoration
  useEffect(() => {
    if (scrollPositionToRestore && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollPositionToRestore;
    }
  }, [scrollPositionToRestore]);



  if (accounts.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <p className="text-sm">No accounts configured</p>
          {!collapsed && (
            <p className="text-xs mt-1">Add an account to get started</p>
          )}
        </div>
      </div>
    );
  }

  // Collapsed sidebar view - show only numbered buttons
  if (collapsed) {
    return (
      <nav className={cn(
        "flex flex-col items-center w-full px-2",
        settings.compactAccountView === true ? "gap-2" : "gap-3"
      )} aria-label="Account list">
        {accounts.map((account, index) => (
          <div key={account.id} className="relative group">
            <button
              onClick={() => {
                const debugMode = JSON.parse(localStorage.getItem('main-settings-storage') || '{}')?.state?.settings?.debugMode;
                if (debugMode) {
                  window.ipcApi.logMessage('info', `🔍 DIAGNOSTIC: Account clicked: ${account.id} (${account.email})`);
                }
                onSelectAccount(account.id);
              }}
              title={`${account.displayName ?? account.email} - ${account.connectionStatus ?? 'disconnected'}`}
              className={cn(
                "flex items-center justify-center text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all",
                settings.compactAccountView === true ? "w-8 h-6 rounded-lg" : "w-8 h-8 rounded-full",
                selectedAccountId === account.id ? "ring-2 ring-primary" : "",
                account.connectionStatus === 'connected' ? "bg-green-500/20 text-green-400" :
                account.connectionStatus === 'connecting' ? "bg-yellow-500/20 text-yellow-400" :
                "bg-red-500/20 text-red-400"
              )}
              aria-label={`Select account ${account.displayName ?? account.email}`}
            >
              {index + 1}
            </button>

            {/* Login hover button for collapsed view */}
            {onConnectAccount && (
              <div className="absolute -right-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-0 z-10">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onConnectAccount(account.id)}
                  className="h-6 w-6 bg-card/95 backdrop-blur-sm border border-border shadow-lg hover:bg-accent/50"
                  title="Connect to account"
                >
                  <LogIn size={12} />
                </Button>
              </div>
            )}
          </div>
        ))}
      </nav>
    );
  }

  return (
    <CustomScrollbar
      ref={scrollContainerRef}
      data-scroll-container="account-list"
      className="flex-1"
    >
      <div className="space-y-1">
        {accounts.map((account, index) => (
          <AccountListItem
            key={account.id}
            account={account}
            index={index}
            isSelected={selectedAccountId === account.id}
            recentlyDeletedId={recentlyDeletedId}
            onSelectAccount={onSelectAccount}
            onContextMenu={onContextMenu}
            onEdit={onEdit}
            onDelete={onDelete}
            onCopyCredentials={onCopyCredentials}
            onConnectAccount={onConnectAccount}
            onSaveScrollPosition={onSaveScrollPosition}
            scrollContainerRef={scrollContainerRef}
            settings={settings}
          />
        ))}
      </div>
    </CustomScrollbar>
  );
});
