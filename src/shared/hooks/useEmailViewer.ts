/**
 * @file Hook for managing email viewer functionality
 */
import { useCallback, useEffect, useState } from 'react'

import { useAccountStore } from '../store/accounts/accountStore'
import type { Email } from '../types/email'
import { logger as appLogger } from '../utils/logger'

interface EmailContent {
  html?: string | false
  text?: string
  textAsHtml?: string
}

interface UseEmailViewerReturn {
  // State
  emailContent: EmailContent | null
  isLoading: boolean
  error: string | null
  isStarred: boolean

  // Computed values
  hasContent: boolean
  hasSuspiciousContent: boolean

  // Actions
  loadEmailContent: (_accountId: string, _mailboxName: string, _uid: number) => Promise<void>
  clearContent: () => void
  retryLoad: () => void
  handleDelete: () => Promise<void>
  handleStar: () => void
  formatDate: (_dateString?: string) => string
}

/**
 * Hook for managing email viewer functionality
 */
export const useEmailViewer = (): UseEmailViewerReturn => {
  const {
    selectedAccountId,
    selectedMailbox,
    selectedEmailId,
    removeEmailHeaders,
    selectEmail,
    setCurrentEmail,
  } = useAccountStore()

  const [emailContent, setEmailContent] = useState<EmailContent | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isStarred, setIsStarred] = useState(false)
  const [lastLoadParams, setLastLoadParams] = useState<{
    accountId: string
    mailboxName: string
    uid: number
  } | null>(null)

  const loadEmailContent = useCallback(
    async (accountId: string, mailboxName: string, uid: number) => {
      setIsLoading(true)
      setError(null)
      setLastLoadParams({ accountId, mailboxName, uid })

      try {
        const content = (await window.ipcApi.getEmailBody(
          accountId,
          mailboxName,
          uid
        )) as EmailContent
        setEmailContent(content)
        // Also update currentEmail in store with full email data including subject
        setCurrentEmail(content as Email)
      } catch (err: unknown) {
        console.error('Failed to load email content:', err)
        const errorMessage = err instanceof Error ? err.message : 'Failed to load email content'
        setError(errorMessage)
        setEmailContent(null)
      } finally {
        setIsLoading(false)
      }
    },
    [setCurrentEmail]
  )

  const clearContent = useCallback(() => {
    setEmailContent(null)
    setError(null)
    setIsLoading(false)
    setLastLoadParams(null)
  }, [])

  const retryLoad = useCallback(() => {
    if (lastLoadParams !== null && lastLoadParams !== undefined) {
      void loadEmailContent(
        lastLoadParams.accountId,
        lastLoadParams.mailboxName,
        lastLoadParams.uid
      )
    }
  }, [lastLoadParams, loadEmailContent])

  // Auto-load content when selected email changes
  useEffect(() => {
    if (
      selectedAccountId !== null &&
      selectedAccountId !== undefined &&
      selectedAccountId.length > 0 &&
      selectedMailbox !== null &&
      selectedMailbox !== undefined &&
      selectedMailbox.length > 0 &&
      selectedEmailId !== null &&
      selectedEmailId !== undefined &&
      selectedEmailId > 0
    ) {
      void loadEmailContent(selectedAccountId, selectedMailbox, selectedEmailId)
    } else {
      clearContent()
    }
  }, [selectedAccountId, selectedMailbox, selectedEmailId, loadEmailContent, clearContent])

  // Computed values
  const hasContent = Boolean(emailContent !== null && emailContent !== undefined)

  const hasSuspiciousContent = false // Simplified - no longer using EmailSanitizationService

  // Email action handlers
  const handleDelete = useCallback(async () => {
    if (
      (selectedAccountId?.length ?? 0) === 0 ||
      (selectedEmailId ?? 0) === 0 ||
      (selectedMailbox?.length ?? 0) === 0 ||
      selectedAccountId === null ||
      selectedAccountId === undefined ||
      selectedEmailId === null ||
      selectedEmailId === undefined ||
      selectedMailbox === null ||
      selectedMailbox === undefined
    )
      return

    try {
      await window.ipcApi.deleteEmail(selectedAccountId, selectedMailbox, selectedEmailId)
      removeEmailHeaders([selectedEmailId])
      selectEmail(null)
    } catch (err: unknown) {
      console.error('Failed to delete email:', err)
      appLogger.error(err instanceof Error ? err.message : 'Failed to delete email')
    }
  }, [selectedAccountId, selectedEmailId, selectedMailbox, removeEmailHeaders, selectEmail])

  const handleStar = useCallback(() => {
    try {
      // Toggle starred state
      setIsStarred(!isStarred)
      // TODO: Add actual API call here when implemented
    } catch (err: unknown) {
      console.error('Failed to toggle star:', err)
      appLogger.error(err instanceof Error ? err.message : 'Failed to toggle star')
      // Revert the state change on error
      setIsStarred(isStarred)
    }
  }, [isStarred])

  // Format readable date
  const formatDate = useCallback((dateString?: string) => {
    if (dateString === null || dateString === undefined || dateString.length === 0) return ''

    const date = new Date(dateString)
    const now = new Date()

    const isToday = date.toDateString() === now.toDateString()
    if (isToday) {
      // Just time, e.g., "4:56 PM"
      return new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: 'numeric',
      }).format(date)
    }

    const isThisYear = date.getFullYear() === now.getFullYear()
    if (isThisYear) {
      // e.g., "Apr 20"
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
      }).format(date)
    }

    // e.g., "Apr 20, 2023"
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date)
  }, [])

  return {
    emailContent,
    isLoading,
    error,
    isStarred,
    hasContent,
    hasSuspiciousContent,
    loadEmailContent,
    clearContent,
    retryLoad,
    handleDelete,
    handleStar,
    formatDate,
  }
}
