import { AlertTriangle } from 'lucide-react'
/**
 * @file Account management panel with unified behavior and Portal-based ActionButtons
 * @description React component with fully identical behavior in both states:
 * - Collapsed mode: compact layout with 1px left border (border-l) when ResizeHandle is hidden
 *   ActionButtons rendered via Portal outside narrow Panel container for full interactivity
 * - Expanded mode: full width, no panel border (ResizeHandle provides 1px visual separator)
 *   ActionButtons rendered normally inside panel
 * - AccountList uses portal-based hover effects for action buttons on accounts
 *
 * Visual consistency:
 * - Collapsed: 1px left border on panel (ResizeHandle hidden)
 * - Expanded: ResizeHandle provides 1px separator (panel has no border to avoid doubling)
 * - Collapsed width: controlled by react-resizable-panels collapsedSize prop (6% ≈ 65-80px on standard screens)
 * - ActionButtons have fixed height 56px
 * - In collapsed mode Portal positioned by container coordinates via getBoundingClientRect
 *
 * Solving overflow: hidden problem:
 * - react-resizable-panels automatically applies overflow: hidden to Panel in collapsed mode
 * - ActionButtons in collapsed rendered via createPortal in document.body
 * - This guarantees full interactivity regardless of narrow container
 *
 * Provides interface for creating, editing, deleting and reconnecting accounts with validation,
 * status tracking and error handling. Supports drag-and-drop import, context menus
 * and undo notifications.
 */
import React from 'react'

import { useAccountManager } from '../../shared/hooks/useAccountManager'
import { useAccountStore } from '../../shared/store/accounts/accountStore'
import { ImportDialog } from '../ImportDialog'

import AccountForm from './AccountForm'
import { AccountList } from './AccountList'
import { ActionButtons } from './ActionButtons'
import { ContextMenu } from './ContextMenu'
import { DragDropZone, useDragDrop } from './DragDropZone'
import { UndoNotification } from './UndoNotification'

const AccountManagerPanel: React.FC<{
  collapsed: boolean
  onRequestExpand?: () => void
}> = React.memo(({ collapsed, onRequestExpand }) => {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [recentlyDeletedId, setRecentlyDeletedId] = React.useState<string | null>(null)
  const [contextMenu, setContextMenu] = React.useState<{
    x: number
    y: number
    accountId: string
  } | null>(null)

  const accounts = useAccountStore(state => state.accounts)
  const selectedAccountId = useAccountStore(state => state.selectedAccountId)
  const selectAccount = useAccountStore(state => state.selectAccount)
  const reconnectAccount = useAccountStore(state => state.reconnectAccount)

  // Handle account connection
  const handleConnectAccount = React.useCallback(
    (accountId: string) => {
      if (!accountId) {
        console.error('handleConnectAccount: No accountId provided')
        return
      }

      // Verify account exists before attempting reconnection
      const account = accounts.find(acc => acc.id === accountId)
      if (!account) {
        console.error(
          `handleConnectAccount: Account with id ${accountId} not found in local accounts list`
        )
        return
      }

      try {
        // Set connection status to connecting for UI feedback
        const { setAccountConnectionStatus } = useAccountStore.getState()
        setAccountConnectionStatus(accountId, 'connecting')

        // Perform the reconnection
        reconnectAccount(accountId)
      } catch (error) {
        console.error(`Failed to reconnect account ${accountId}:`, error)
        // Reset connection status on error
        const { setAccountConnectionStatus } = useAccountStore.getState()
        setAccountConnectionStatus(accountId, 'disconnected')
      }
    },
    [accounts, reconnectAccount]
  )

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
  } = useAccountManager()

  // Drag and drop functionality
  const { isDragOver, handleDragOver, handleDragLeave, handleDrop } =
    useDragDrop(handleImportComplete)

  // Context menu handlers
  const handleContextMenu = React.useCallback((e: React.MouseEvent, accountId: string) => {
    e.preventDefault()
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      accountId,
    })
  }, [])

  const closeContextMenu = React.useCallback(() => {
    setContextMenu(null)
  }, [])

  // Close context menu on click outside
  React.useEffect(() => {
    const handleClickOutside = (): void => closeContextMenu()
    if (contextMenu) {
      document.addEventListener('click', handleClickOutside)
      return (): void => {
        document.removeEventListener('click', handleClickOutside)
      }
    }
  }, [contextMenu, closeContextMenu])

  // Enhanced delete handler with hover protection
  const handleDeleteWithProtection = React.useCallback(
    async (accountId: string) => {
      // Mark as recently deleted to prevent hover on next item
      setRecentlyDeletedId(accountId)

      // Clear the protection after a longer delay for better UX
      setTimeout(() => {
        setRecentlyDeletedId(null)
      }, 1000)

      await handleDelete(accountId)
    },
    [handleDelete]
  )

  // Collapsed sidebar view
  if (collapsed) {
    return (
      <DragDropZone
        ref={containerRef}
        isDragOver={isDragOver}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="h-full flex flex-col w-full border-border transition-colors overflow-visible"
      >
        <div
          className="h-full flex flex-col items-center overflow-visible"
          data-panel-id="account-panel"
        >
          <div className="flex-1 flex flex-col items-center overflow-visible w-full">
            <AccountList
              accounts={accounts}
              selectedAccountId={selectedAccountId}
              recentlyDeletedId={recentlyDeletedId}
              onSelectAccount={selectAccount}
              onContextMenu={handleContextMenu}
              onEdit={handleEdit}
              onDelete={accountId => {
                void handleDelete(accountId)
              }}
              onUndo={accountId => {
                void handleUndoDelete(accountId)
              }}
              onCopyCredentials={account => {
                void handleCopyCredentials(account)
              }}
              onConnectAccount={handleConnectAccount}
              collapsed
              onSaveScrollPosition={saveScrollPosition}
              scrollPositionToRestore={view === 'list' ? restoreScrollPosition() : undefined}
            />
          </div>

          <ActionButtons
            onAddNew={() => {
              // Expand panel before opening form
              onRequestExpand?.()
              // Small delay to let panel expand
              setTimeout(() => {
                void handleAddNew()
              }, 100)
            }}
            onImport={() => {
              // Expand panel before opening dialog
              onRequestExpand?.()
              // Small delay to let panel expand
              setTimeout(() => {
                handleImport()
              }, 100)
            }}
            isDragOver={isDragOver}
            collapsed={true}
            containerRef={containerRef}
          />
        </div>
      </DragDropZone>
    )
  }

  // Expanded view with account list or form
  return (
    <DragDropZone
      isDragOver={isDragOver}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="h-full flex flex-col w-full transition-colors"
    >
      {view === 'form' ? (
        <AccountForm
          accountToEdit={editingAccount}
          onCancel={handleCancel}
          onSuccess={handleSave}
          initialData={prefillData}
        />
      ) : (
        <div className="h-full flex flex-col" data-panel-id="account-panel">
          <AccountList
            accounts={accounts}
            selectedAccountId={selectedAccountId}
            recentlyDeletedId={recentlyDeletedId}
            onSelectAccount={selectAccount}
            onContextMenu={handleContextMenu}
            onEdit={handleEdit}
            onDelete={accountId => {
              void handleDelete(accountId)
            }}
            onUndo={accountId => {
              void handleUndoDelete(accountId)
            }}
            onCopyCredentials={account => {
              void handleCopyCredentials(account)
            }}
            onConnectAccount={handleConnectAccount}
            collapsed={false}
            onSaveScrollPosition={saveScrollPosition}
            scrollPositionToRestore={view === 'list' ? restoreScrollPosition() : undefined}
          />

          {(error?.length ?? 0) > 0 && (
            <div className="mx-3 mb-3 p-3 border border-destructive bg-destructive/10 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-destructive shrink-0 mt-0.5" />
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
  )
})

export default AccountManagerPanel
