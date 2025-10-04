/**
 * @file Hook for managing account operations and state
 */
import { useCallback, useState } from 'react'
import type { z } from 'zod'

import type { ImportResult } from '../../components/AccountManager/DragDropZone'
// ClipboardService is now accessed via IPC API
import { useAccountStore } from '../store/accounts/accountStore'
import { useLogStore } from '../store/logStore'
import { type Account, accountSchema } from '../types/account'
import { logger as appLogger } from '../utils/logger'

// The form schema mirrors the main account schema but omits the ID
const formSchema = accountSchema.omit({ id: true })

export type AccountFormData = z.infer<typeof formSchema>

interface DeletedAccountEntry {
  account: Account
  deletedAt: number
}

interface UseAccountManagerReturn {
  // State
  view: 'list' | 'form'
  setView: (_view: 'list' | 'form') => void
  editingAccount: Account | null
  setEditingAccount: (_account: Account | null) => void
  error: string | null
  setError: (_error: string | null) => void
  prefillData: {
    email: string
    password: string
    refreshToken?: string
    clientId?: string
    isOAuth2?: boolean
  } | null
  setPrefillData: (
    _data: {
      email: string
      password: string
      refreshToken?: string
      clientId?: string
      isOAuth2?: boolean
    } | null
  ) => void
  isImportDialogOpen: boolean
  setIsImportDialogOpen: (_open: boolean) => void
  deletedAccounts: DeletedAccountEntry[]
  setDeletedAccounts: (_accounts: DeletedAccountEntry[]) => void
  savedScrollPosition: number
  setSavedScrollPosition: (_position: number) => void

  // Handlers
  handleSave: (_data: AccountFormData) => Promise<void>
  handleAddNew: () => Promise<void>
  handleEdit: (_account: Account) => void
  handleDelete: (_accountId: string) => Promise<void>
  handleCancel: () => void
  handleCopyCredentials: (_account: Account) => Promise<void>
  handleImport: () => void
  handleImportComplete: (_result: ImportResult) => void
  handleUndoDelete: (_accountId: string) => Promise<void>
  handleDismissUndo: (_accountId: string) => void
  handleClearAllUndo: () => void
  saveScrollPosition: (_position: number) => void
  restoreScrollPosition: () => number
}

/**
 * Hook for managing account operations
 */
export const useAccountManager = (): UseAccountManagerReturn => {
  const accounts = useAccountStore(state => state.accounts)
  const addAccount = useAccountStore(state => state.addAccount)
  const deleteAccount = useAccountStore(state => state.deleteAccount)
  const setAccounts = useAccountStore(state => state.setAccounts)

  const [view, setView] = useState<'list' | 'form'>('list')
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [prefillData, setPrefillData] = useState<{
    email: string
    password: string
    refreshToken?: string
    clientId?: string
    isOAuth2?: boolean
  } | null>(null)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [deletedAccounts, setDeletedAccounts] = useState<DeletedAccountEntry[]>([])
  const [savedScrollPosition, setSavedScrollPosition] = useState<number>(0)

  const handleSave = useCallback(
    async (data: AccountFormData) => {
      setError(null)
      const dataToSave = { ...data }

      try {
        if (editingAccount) {
          const updatedAccount = await window.ipcApi.updateAccount(editingAccount.id, dataToSave)
          appLogger.info(
            `Account "${(updatedAccount.displayName?.length ?? 0) > 0 ? updatedAccount.displayName : updatedAccount.email}" updated.`
          )
        } else {
          if ((dataToSave.displayName?.length ?? 0) === 0) {
            const emailDomain = dataToSave.email.split('@')[1]?.split('.')[0] || 'Email'
            const newAccountName = `Account ${accounts.length + 1} ${emailDomain.toUpperCase()}`
            dataToSave.displayName = newAccountName
          }
          const newAccount = await window.ipcApi.addAccount(dataToSave)
          addAccount(newAccount)
          appLogger.info(`Account "${newAccount.displayName}" added.`)
        }

        // ALWAYS reload all accounts from file to ensure store is in sync.
        const allAccounts = await window.ipcApi.getAccounts()
        setAccounts(allAccounts)

        setView('list')
        setEditingAccount(null)
      } catch (err: unknown) {
        console.error('Error in handleSave:', err)
        const errorMessage = err instanceof Error ? err.message : 'Failed to save account.'
        setError(errorMessage)
        appLogger.error(errorMessage)
      }
    },
    [editingAccount, accounts.length, addAccount, setAccounts]
  )

  const handleAddNew = useCallback(async () => {
    let prefill: {
      email: string
      password: string
      refreshToken?: string
      clientId?: string
      isOAuth2?: boolean
    } | null = null

    try {
      const result = await window.ipcApi.detectCredentialsFromClipboard()

      if (result.success && result.credentials) {
        prefill = result.credentials
        appLogger.info('Credentials detected in clipboard, pre-filling form.')
      } else if (result.error?.includes('resembles credentials') === true) {
        appLogger.info(result.error)
      }
    } catch (_err) {
      // Don't block the UI if clipboard reading fails
    }

    // Use setTimeout to prevent UI blocking
    setTimeout(() => {
      setPrefillData(prefill)
      setEditingAccount(null)
      setView('form')
    }, 0)
  }, [])

  const handleEdit = useCallback((account: Account) => {
    setEditingAccount(account)
    setView('form')
  }, [])

  const handleDelete = useCallback(
    async (accountId: string) => {
      const accountToDelete = accounts.find(acc => acc.id === accountId)
      if (!accountToDelete) return

      const accountName =
        (accountToDelete.displayName?.length ?? 0) > 0
          ? accountToDelete.displayName
          : accountToDelete.email

      try {
        await window.ipcApi.deleteAccount(accountId)
        deleteAccount(accountId)

        // Add to deleted accounts stack (max 10 accounts)
        setDeletedAccounts(prev => {
          const newEntry: DeletedAccountEntry = {
            account: accountToDelete,
            deletedAt: Date.now(),
          }

          // Keep only last 10 deleted accounts
          const updated = [newEntry, ...prev].slice(0, 10)

          // Auto-cleanup entries older than 5 minutes
          return updated.filter(entry => Date.now() - entry.deletedAt < 5 * 60 * 1000)
        })

        appLogger.info(`Account "${accountName}" deleted.`)
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to delete account.'
        setError(errorMessage)
        appLogger.error(errorMessage)
      }
    },
    [accounts, deleteAccount]
  )

  const handleCancel = useCallback(() => {
    setEditingAccount(null)
    setView('list')
    setError(null)
  }, [])

  const handleCopyCredentials = useCallback(async (account: Account) => {
    try {
      const success = (await window.ipcApi.copyAccountCredentials(
        account.email,
        account.password
      )) as boolean
      if (success) {
        appLogger.info(
          `Credentials for "${(account.displayName?.length ?? 0) > 0 ? account.displayName : account.email}" copied to clipboard.`
        )
      } else {
        appLogger.error('Failed to copy credentials to clipboard.')
      }
    } catch (_error) {
      appLogger.error('Failed to copy credentials to clipboard.')
    }
  }, [])

  const handleImport = useCallback(() => {
    setIsImportDialogOpen(true)
  }, [])

  const handleImportComplete = useCallback(
    (result: ImportResult) => {
      appLogger.info(
        `Successfully imported ${result.addedCount} accounts. ${result.skippedCount} lines were skipped.`
      )

      // Refresh accounts from store asynchronously
      void Promise.resolve(window.ipcApi.getAccounts())
        .then((updatedAccounts: Account[]) => {
          setAccounts(updatedAccounts)
        })
        .catch((error: unknown) => {
          const errorMessage =
            error instanceof Error ? error.message : 'Failed to refresh accounts.'
          appLogger.error(errorMessage)
        })

      // Close the dialog
      setIsImportDialogOpen(false)
    },
    [setAccounts]
  )

  const handleUndoDelete = useCallback(
    async (accountId: string) => {
      const deletedEntry = deletedAccounts.find(entry => entry.account.id === accountId)
      if (!deletedEntry) return

      try {
        const restoredAccount = await window.ipcApi.addAccount(deletedEntry.account)
        addAccount(restoredAccount)

        // Remove from deleted accounts stack
        setDeletedAccounts(prev => prev.filter(entry => entry.account.id !== accountId))

        appLogger.info(
          `Account "${(deletedEntry.account.displayName?.length ?? 0) > 0 ? deletedEntry.account.displayName : deletedEntry.account.email}" restored.`
        )
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to restore account.'
        setError(errorMessage)
        appLogger.error(errorMessage)
      }
    },
    [deletedAccounts, addAccount]
  )

  const handleDismissUndo = useCallback((accountId: string) => {
    // Remove specific account from deleted stack (user explicitly dismissed)
    setDeletedAccounts(prev => prev.filter(entry => entry.account.id !== accountId))
  }, [])

  const handleClearAllUndo = useCallback(() => {
    // Clear all deleted accounts (e.g., on app close)
    setDeletedAccounts([])
  }, [])

  // Scroll position management functions
  const saveScrollPosition = useCallback((position: number) => {
    setSavedScrollPosition(position)
  }, [])

  const restoreScrollPosition = useCallback(() => {
    return savedScrollPosition
  }, [savedScrollPosition])

  return {
    view,
    setView,
    editingAccount,
    setEditingAccount,
    error,
    setError,
    prefillData,
    setPrefillData,
    isImportDialogOpen,
    setIsImportDialogOpen,
    deletedAccounts,
    setDeletedAccounts,
    savedScrollPosition,
    setSavedScrollPosition,
    handleSave,
    handleAddNew,
    handleEdit,
    handleDelete,
    handleCancel,
    handleCopyCredentials,
    handleImport,
    handleImportComplete,
    handleUndoDelete,
    handleDismissUndo,
    handleClearAllUndo,
    saveScrollPosition,
    restoreScrollPosition,
  }
}
