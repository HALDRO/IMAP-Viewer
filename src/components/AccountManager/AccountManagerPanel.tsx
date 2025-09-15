/**
 * @file Panel for managing email accounts with a modern dark design
 */
import React from 'react';

import { useAccountManager } from '../../shared/hooks/useAccountManager';
import { useAccountStore } from '../../shared/store/accounts/accountStore';
import { ImportDialog } from '../ImportDialog';

import AccountForm from './AccountForm';
import { ActionButtons } from './ActionButtons';
import { AccountList } from './AccountList';
import { ContextMenu } from './ContextMenu';
import { DragDropZone, useDragDrop } from './DragDropZone';
import { UndoNotification } from './UndoNotification';

const AccountManagerPanel: React.FC<{
  collapsed: boolean;
}> = React.memo(({ collapsed }) => {
  const [recentlyDeletedId, setRecentlyDeletedId] = React.useState<string | null>(null);
  const [contextMenu, setContextMenu] = React.useState<{
    x: number;
    y: number;
    accountId: string;
  } | null>(null);

  const {
    accounts,
    selectedAccountId,
    selectAccount,
  } = useAccountStore();

  // Handle account connection
  const handleConnectAccount = React.useCallback(async (accountId: string) => {
    try {
      await window.ipcApi.watchInbox(accountId);
    } catch (error) {
      console.error('Failed to connect to account:', error);
    }
  }, []);

  const {
    view,
    editingAccount,
    error,
    prefillData,
    handleSave,
    handleAddNew,
    handleEdit,
    handleDelete,
    handleCancel,
    handleCopyCredentials,
    handleImport,
    isImportDialogOpen,
    setIsImportDialogOpen,
    handleImportComplete,
    deletedAccounts,
    handleUndoDelete,
    handleDismissUndo,
    saveScrollPosition,
    restoreScrollPosition,
  } = useAccountManager();

  // Drag and drop functionality
  const {
    isDragOver,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  } = useDragDrop(handleImportComplete);

  // Context menu handlers
  const handleContextMenu = React.useCallback((e: React.MouseEvent, accountId: string) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      accountId
    });
  }, []);

  const closeContextMenu = React.useCallback(() => {
    setContextMenu(null);
  }, []);

  // Close context menu on click outside
  React.useEffect(() => {
    const handleClickOutside = (): void => closeContextMenu();
    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      return (): void => { document.removeEventListener('click', handleClickOutside); };
    }
  }, [contextMenu, closeContextMenu]);

  // Enhanced delete handler with hover protection
  const handleDeleteWithProtection = React.useCallback(async (accountId: string) => {
    // Mark as recently deleted to prevent hover on next item
    setRecentlyDeletedId(accountId);

    // Clear the protection after a longer delay for better UX
    setTimeout(() => {
      setRecentlyDeletedId(null);
    }, 1000);

    await handleDelete(accountId);
  }, [handleDelete]);

  // Collapsed sidebar view
  if (collapsed) {
    return (
      <DragDropZone
        isDragOver={isDragOver}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="bg-[#121212] h-full flex flex-col items-center py-3 w-full transition-colors"
      >
        <div className="flex flex-col items-center gap-4 w-full flex-1">
          <AccountList
            accounts={accounts}
            selectedAccountId={selectedAccountId}
            recentlyDeletedId={recentlyDeletedId}
            onSelectAccount={selectAccount}
            onContextMenu={handleContextMenu}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onUndo={handleUndoDelete}
            onCopyCredentials={handleCopyCredentials}
            onConnectAccount={handleConnectAccount}
            collapsed={true}
            onSaveScrollPosition={saveScrollPosition}
            scrollPositionToRestore={view === 'list' ? restoreScrollPosition() : undefined}
          />
        </div>
        <div className="mt-auto w-full">
          <ActionButtons
            onAddNew={handleAddNew}
            onImport={handleImport}
            isDragOver={isDragOver}
            collapsed={true}
          />
        </div>
      </DragDropZone>
    );
  }
  
  // Expanded view with account list or form
  return (
    <DragDropZone
      isDragOver={isDragOver}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="h-full flex flex-col w-full border-l border-border transition-colors"
    >
      {view === 'form' ? (
        <AccountForm
          accountToEdit={editingAccount}
          onCancel={handleCancel}
          onSuccess={handleSave}
          initialData={prefillData}
        />
      ) : (
        <div className="h-full flex flex-col">
          <AccountList
            accounts={accounts}
            selectedAccountId={selectedAccountId}
            recentlyDeletedId={recentlyDeletedId}
            onSelectAccount={selectAccount}
            onContextMenu={handleContextMenu}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onUndo={handleUndoDelete}
            onCopyCredentials={handleCopyCredentials}
            onConnectAccount={handleConnectAccount}
            collapsed={false}
            onSaveScrollPosition={saveScrollPosition}
            scrollPositionToRestore={view === 'list' ? restoreScrollPosition() : undefined}
          />

          {(error?.length ?? 0) > 0 && (
            <div className="mx-3 mb-3 p-3 border border-destructive bg-destructive/10 rounded-lg">
              <div className="flex items-start gap-2">
                <div className="text-destructive flex-shrink-0 mt-0.5">⚠</div>
                <p className="text-sm text-destructive">{error}</p>
              </div>
            </div>
          )}

          <UndoNotification
            deletedAccounts={deletedAccounts}
            onUndo={handleUndoDelete}
            onDismiss={handleDismissUndo}
          />

          <ActionButtons
            onAddNew={handleAddNew}
            onImport={handleImport}
            isDragOver={isDragOver}
            collapsed={false}
          />
        </div>
      )}

      <ContextMenu
        contextMenu={contextMenu}
        accounts={accounts}
        onEdit={handleEdit}
        onCopyCredentials={handleCopyCredentials}
        onDelete={handleDeleteWithProtection}
        onClose={closeContextMenu}
        onSaveScrollPosition={saveScrollPosition}
      />

      <ImportDialog
        isOpen={isImportDialogOpen}
        onClose={() => setIsImportDialogOpen(false)}
        onImportComplete={handleImportComplete}
      />
    </DragDropZone>
  );
});

export default AccountManagerPanel;