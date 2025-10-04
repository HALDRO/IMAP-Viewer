/**
 * @file Enhanced email list hook with proper email viewing and smart multi-select functionality
 * @description Manages email loading with clear separation between viewing and selection:
 * - Coordinates with useAccountInitializer to prevent concurrent IMAP operations
 * - Only loads emails after account switching is completed to ensure proper connection state
 * - selectEmail() properly opens emails by updating both local state and AccountStore
 * - Smart multi-select mode: auto-activates on first checkbox, auto-deactivates when empty via useEffect
 * - Handles "accidental click" scenario: click checkbox → click same checkbox → exits multi-select mode
 * - LOCAL STATE pagination: currentPage managed in local state, synced with store only for persistence
 * - ATOMIC pagination updates: currentPage updates AFTER data loaded to prevent UI showing wrong page with old emails
 * - Prevents race condition: loadingPageRef.current tracks pending page load, blocks duplicate requests
 * - This ensures UI never displays "Page 5" with emails from Page 3 during async load
 * - Boundary-checked page loading: loadPage validates page range (1-totalPages) to prevent invalid navigation
 * - Race condition prevention: isLoading + loadingPageRef guard prevents concurrent page loads
 * - Proper store synchronization: local selectedEmailId syncs with store for correct state management
 * - Clear separation: selectedEmailId (current email for viewing) vs selectedUids (multi-select)
 * - Toolbar visibility depends on both selection count AND multi-select mode being active
 * - Eliminates duplicate utility functions - single source of truth for formatDate, hasAttachments, isStarred
 * - Manages both viewing and selection state with proper cleanup on mailbox/account changes
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useAccountStore } from '../store/accounts/accountStore'
import type { EmailHeader } from '../types/email'

interface MailboxResult {
  emails?: EmailHeader[]
  totalCount?: number
}

interface EmailFrom {
  text?: string
}

interface UseEmailListProps {
  searchQuery?: string
}

interface UseEmailListReturn {
  // State
  isLoading: boolean
  isFetchingMore: boolean
  error: string | null
  hasLoadedOnce: boolean
  selectedUids: number[]
  selectAll: boolean
  isToolbarVisible: boolean
  keyboardSelectedIndex: number
  currentPage: number
  isMultiSelectMode: boolean
  selectedEmailId: number | null

  // Data
  emailHeaders: EmailHeader[]
  filteredEmails: EmailHeader[]

  // Legacy aliases for backward compatibility
  emails: EmailHeader[]
  selectEmail: (uid: number) => void
  keyboardSelectedEmailId: number | null
  hasMoreEmails: boolean
  totalEmailCount: number
  selectedAccountId: string | null
  selectedMailbox: string | null

  // Refs
  observer: React.MutableRefObject<IntersectionObserver | null>
  lastEmailElementRef: React.MutableRefObject<HTMLDivElement | null>

  // Handlers
  loadMoreEmails: () => Promise<void>
  loadPage: (page: number) => Promise<void>
  handleSelectEmail: (_uid: number) => void
  handleCheckboxSelect: (_uid: number) => void
  handleSelectAll: () => void
  handleCancelSelection: () => void
  handleDeleteSelected: () => Promise<void>
  setKeyboardSelectedIndex: (_index: number) => void
  setSelectedUids: (_uids: number[] | ((_prev: number[]) => number[])) => void
  setSelectAll: (_selectAll: boolean) => void
  setCurrentPage: (_page: number) => void

  // Utils
  formatDate: (_dateString: string) => string
  hasAttachments: (_email: EmailHeader) => boolean
  isStarred: (_email: EmailHeader) => boolean
}

export const PAGE_SIZE = 50

/**
 * Hook for managing email list functionality
 */
export const useEmailList = ({ searchQuery = '' }: UseEmailListProps): UseEmailListReturn => {
  const {
    selectedAccountId,
    selectedMailbox,
    selectedEmailId: storeSelectedEmailId,
    emailHeadersByMailbox,
    emailCountByMailbox,
    currentPageByMailbox,
    setEmailHeadersForMailbox,
    appendEmailHeadersToMailbox,
    prependEmailHeaders,
    hasMoreEmailsByMailbox,
    setHasMoreEmailsForMailbox,
    setEmailCountForMailbox,
    setCurrentPageForMailbox,
    removeEmailHeaders,
    isAccountSwitching,
  } = useAccountStore()

  const mailboxKey = useMemo(() => {
    return (selectedAccountId?.length ?? 0) > 0 && (selectedMailbox?.length ?? 0) > 0
      ? `${selectedAccountId}-${selectedMailbox}`
      : null
  }, [selectedAccountId, selectedMailbox])

  const emailHeaders = useMemo(() => {
    const headers =
      mailboxKey !== null && mailboxKey !== undefined && mailboxKey.length > 0
        ? (emailHeadersByMailbox[mailboxKey] ?? [])
        : []
    return headers
  }, [mailboxKey, emailHeadersByMailbox])

  const hasMoreEmails = useMemo(() => {
    return mailboxKey !== null && mailboxKey !== undefined && mailboxKey.length > 0
      ? hasMoreEmailsByMailbox[mailboxKey] === true
      : false
  }, [mailboxKey, hasMoreEmailsByMailbox])

  const [isLoading, setIsLoading] = useState(false)
  const [isFetchingMore, setIsFetchingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  const [totalEmailCount, setTotalEmailCount] = useState(0)

  // Local state for current page to prevent race conditions with store updates
  const [currentPage, setLocalCurrentPage] = useState(1)

  // Sync local currentPage with store value when mailbox changes
  useEffect(() => {
    if (mailboxKey) {
      const savedPage = currentPageByMailbox[mailboxKey] || 1
      setLocalCurrentPage(savedPage)
    } else {
      setLocalCurrentPage(1)
    }
  }, [mailboxKey, currentPageByMailbox])

  const observer = useRef<IntersectionObserver | null>(null)
  const lastEmailElementRef = useRef<HTMLDivElement>(null)
  const loadingPageRef = useRef<number | null>(null) // Track which page is currently loading

  const [selectedUids, setSelectedUids] = useState<number[]>([])
  const [selectAll, setSelectAll] = useState(false)
  const [isToolbarVisible, setIsToolbarVisible] = useState(false)
  const [keyboardSelectedIndex, setKeyboardSelectedIndex] = useState(-1)
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false)
  const [selectedEmailId, setSelectedEmailId] = useState<number | null>(null)

  // Use refs to track previous values and prevent unnecessary effect triggers
  const prevSelectedAccountIdRef = useRef<string | null>(null)
  const prevSelectedMailboxRef = useRef<string | null>(null)
  const prevMailboxKeyRef = useRef<string | null>(null)

  // Sync local selectedEmailId with store
  useEffect(() => {
    setSelectedEmailId(storeSelectedEmailId)
  }, [storeSelectedEmailId])

  // Effect to handle selecting a mailbox
  useEffect(() => {
    // Don't load emails while account is switching to prevent race conditions
    if (isAccountSwitching) {
      return
    }

    if (selectedAccountId && selectedMailbox) {
      const hasSelectionChanged =
        selectedAccountId !== prevSelectedAccountIdRef.current ||
        selectedMailbox !== prevSelectedMailboxRef.current

      if (!hasSelectionChanged) {
        return
      }

      // Update refs
      prevSelectedAccountIdRef.current = selectedAccountId
      prevSelectedMailboxRef.current = selectedMailbox

      // Check if we already have data for this mailbox
      const currentKey = `${selectedAccountId}-${selectedMailbox}`
      const existingHeaders = emailHeadersByMailbox[currentKey]

      // Only load if we don't have data yet
      if (!existingHeaders || existingHeaders.length === 0) {
        const loadMailboxContent = async (): Promise<void> => {
          setIsLoading(true)
          setError(null)
          try {
            const result = await window.ipcApi.selectMailbox(
              selectedAccountId,
              selectedMailbox,
              PAGE_SIZE
            )

            const resultObj = result as MailboxResult
            const initialEmails = Array.isArray(result) ? result : (resultObj.emails ?? [])
            const totalCount = Array.isArray(result)
              ? initialEmails.length // Legacy format - total count not available
              : (resultObj.totalCount ?? initialEmails.length)

            // Set total count first
            setEmailCountForMailbox(selectedAccountId, selectedMailbox, totalCount)
            setTotalEmailCount(totalCount)

            // Now load the correct page (saved page or first page)
            const savedPage = currentPageByMailbox[currentKey] || 1
            const offset = (savedPage - 1) * PAGE_SIZE
            const pageEmails = await window.ipcApi.getEmails(
              selectedAccountId,
              selectedMailbox,
              offset,
              PAGE_SIZE
            )

            // Set emails for the correct page
            setEmailHeadersForMailbox(selectedAccountId, selectedMailbox, pageEmails)
            setHasMoreEmailsForMailbox(
              selectedAccountId,
              selectedMailbox,
              pageEmails.length === PAGE_SIZE
            )

            // Clear any previous errors if successful
            setError(null)
          } catch (e: unknown) {
            // Set empty state to show that loading completed (even with error)
            setEmailHeadersForMailbox(selectedAccountId, selectedMailbox, [])
            setHasMoreEmailsForMailbox(selectedAccountId, selectedMailbox, false)
            setEmailCountForMailbox(selectedAccountId, selectedMailbox, 0)
            setTotalEmailCount(0)

            // Enhanced error handling with recovery suggestions
            const errorMessage = e instanceof Error ? e.message : 'Failed to load emails'
            if (errorMessage.includes('Connection not available')) {
              setError(
                'Connection temporarily unavailable. This often resolves automatically - try refreshing the mailbox or re-selecting the account.'
              )
            } else if (errorMessage.includes('ECONNREFUSED')) {
              setError('Cannot connect to email server. Please check your account settings.')
            } else if (
              errorMessage.includes('Invalid credentials') ||
              errorMessage.includes('AUTHENTICATIONFAILED')
            ) {
              setError('Authentication failed. Please check your email and password.')
            } else if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('ECONNRESET')) {
              setError(
                'Network connection issue. Please check your internet connection and proxy settings.'
              )
            } else {
              setError(`${errorMessage} - Try refreshing the mailbox or reconnecting the account.`)
            }
          } finally {
            setIsLoading(false)
            setHasLoadedOnce(true)
          }
        }
        void loadMailboxContent()
      } else {
        // Data already exists, just update loading state and ensure count is correct
        setIsLoading(false)
        setHasLoadedOnce(true)
        setError(null)

        // Update total count if available - this ensures count is always correct
        const existingCount = emailCountByMailbox[currentKey]
        if (existingCount !== undefined) {
          setTotalEmailCount(existingCount)
        } else {
          // Fallback: if count not in store, set to current emails length
          setTotalEmailCount(existingHeaders?.length ?? 0)
        }

        // Update hasMore based on whether we have a full page
        const hasMore = existingHeaders ? existingHeaders.length === PAGE_SIZE : false
        setHasMoreEmailsForMailbox(selectedAccountId, selectedMailbox, hasMore)
      }
    } else {
      // Reset refs when no selection
      prevSelectedAccountIdRef.current = null
      prevSelectedMailboxRef.current = null

      setIsLoading(false)
      setError(null)
      setHasLoadedOnce(false)
    }
  }, [
    selectedAccountId,
    selectedMailbox,
    isAccountSwitching,
    setEmailHeadersForMailbox,
    setHasMoreEmailsForMailbox,
    setEmailCountForMailbox,
    emailHeadersByMailbox,
    emailCountByMailbox,
    currentPageByMailbox,
  ])

  // Effect to listen for new mail events
  useEffect(() => {
    const cleanup = window.ipcApi.onNewMail((_, { accountId, mailboxName, newMailCount }) => {
      if (accountId === selectedAccountId && mailboxName === selectedMailbox) {
        void (async (): Promise<void> => {
          try {
            const newEmails = await window.ipcApi.getEmails(accountId, mailboxName, 0, newMailCount)
            if (newEmails.length > 0) {
              prependEmailHeaders(accountId, mailboxName, newEmails)
            }
          } catch (e) {
            console.error('Failed to fetch new emails:', e)
          }
        })()
      }
    })

    return cleanup
  }, [selectedAccountId, selectedMailbox, prependEmailHeaders])

  // Filter emails based on search query
  const filteredEmails = useMemo(() => {
    if (!searchQuery) return emailHeaders

    const query = searchQuery.toLowerCase()
    return emailHeaders.filter(
      (email: EmailHeader) =>
        email.subject?.toLowerCase().includes(query) ||
        (typeof email.from === 'string'
          ? (email.from as string).toLowerCase().includes(query)
          : (email.from as EmailFrom)?.text?.toLowerCase()?.includes(query))
    )
  }, [emailHeaders, searchQuery])

  // Load specific page
  const loadPage = useCallback(
    async (page: number) => {
      if (
        (selectedAccountId?.length ?? 0) === 0 ||
        (selectedMailbox?.length ?? 0) === 0 ||
        selectedAccountId === null ||
        selectedAccountId === undefined ||
        selectedMailbox === null ||
        selectedMailbox === undefined ||
        isLoading || // Prevent race conditions
        loadingPageRef.current !== null // Prevent duplicate requests
      ) {
        return
      }

      // Check if we're trying to load the same page
      if (page === currentPage && !isLoading) {
        return
      }

      // Calculate total pages and validate page number
      const currentKey = `${selectedAccountId}-${selectedMailbox}`
      const existingCount = emailCountByMailbox[currentKey] ?? 0
      const totalPages = Math.ceil(existingCount / PAGE_SIZE)

      // Boundary check: ensure page is within valid range
      if (page < 1 || (totalPages > 0 && page > totalPages)) {
        return
      }

      // Mark this page as loading
      loadingPageRef.current = page
      setIsLoading(true)
      setError(null)

      try {
        const offset = (page - 1) * PAGE_SIZE
        const emails = await window.ipcApi.getEmails(
          selectedAccountId,
          selectedMailbox,
          offset,
          PAGE_SIZE
        )

        // Update local state ONLY AFTER successful data fetch
        // This prevents showing wrong page number with old emails
        setLocalCurrentPage(page)

        // Update store for persistence
        if (mailboxKey) {
          setCurrentPageForMailbox(selectedAccountId, selectedMailbox, page)
        }

        // Replace current emails with page data
        setEmailHeadersForMailbox(selectedAccountId, selectedMailbox, emails)

        // Update hasMore based on whether we got a full page
        setHasMoreEmailsForMailbox(selectedAccountId, selectedMailbox, emails.length === PAGE_SIZE)

        // Update total count from store (it should be already set during mailbox selection)
        if (existingCount !== undefined && existingCount > 0) {
          setTotalEmailCount(existingCount)
        }
      } catch (e: unknown) {
        const errorMsg = e instanceof Error ? e.message : 'Failed to load page'
        setError(errorMsg)
        // On error, revert to previous page
        const previousPage = currentPageByMailbox[currentKey] || 1
        setLocalCurrentPage(previousPage)
        // Clear emails on error
        setEmailHeadersForMailbox(selectedAccountId, selectedMailbox, [])
        setHasMoreEmailsForMailbox(selectedAccountId, selectedMailbox, false)
        setTotalEmailCount(0)
      } finally {
        loadingPageRef.current = null // Clear loading state
        setIsLoading(false)
        setHasLoadedOnce(true)
      }
    },
    [
      selectedAccountId,
      selectedMailbox,
      setEmailHeadersForMailbox,
      setHasMoreEmailsForMailbox,
      setCurrentPageForMailbox,
      emailCountByMailbox,
      currentPageByMailbox,
      isLoading,
      mailboxKey,
      currentPage,
    ]
  )

  // Load more emails (for backward compatibility)
  const loadMoreEmails = useCallback(async () => {
    if (
      (selectedAccountId?.length ?? 0) === 0 ||
      (selectedMailbox?.length ?? 0) === 0 ||
      hasMoreEmails === false ||
      isFetchingMore === true ||
      selectedAccountId === null ||
      selectedAccountId === undefined ||
      selectedMailbox === null ||
      selectedMailbox === undefined
    ) {
      return
    }

    setIsFetchingMore(true)
    try {
      const currentOffset = emailHeaders.length
      const newEmails = await window.ipcApi.getEmails(
        selectedAccountId,
        selectedMailbox,
        currentOffset,
        PAGE_SIZE
      )

      appendEmailHeadersToMailbox(selectedAccountId, selectedMailbox, newEmails)

      if (newEmails.length < PAGE_SIZE) {
        setHasMoreEmailsForMailbox(selectedAccountId, selectedMailbox, false)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load more emails')
    } finally {
      setIsFetchingMore(false)
    }
  }, [
    selectedAccountId,
    selectedMailbox,
    hasMoreEmails,
    isFetchingMore,
    emailHeaders.length,
    appendEmailHeadersToMailbox,
    setHasMoreEmailsForMailbox,
  ])

  // Reset selection when changing mailbox or account
  useEffect(() => {
    if (mailboxKey !== prevMailboxKeyRef.current) {
      prevMailboxKeyRef.current = mailboxKey
      setSelectedUids([])
      setSelectAll(false)
      setIsToolbarVisible(false)
      setKeyboardSelectedIndex(-1)
      setIsMultiSelectMode(false)
      setSelectedEmailId(null)
      setError(null)
      setHasLoadedOnce(false)
    }
  }, [mailboxKey])

  // Update totalEmailCount when emailCountByMailbox changes
  useEffect(() => {
    if (mailboxKey) {
      const existingCount = emailCountByMailbox[mailboxKey]
      if (existingCount !== undefined) {
        setTotalEmailCount(existingCount)
      }
    }
  }, [mailboxKey, emailCountByMailbox])

  // Auto-exit multi-select mode when no items are selected
  useEffect(() => {
    if (isMultiSelectMode && selectedUids.length === 0) {
      setIsMultiSelectMode(false)
    }
  }, [selectedUids, isMultiSelectMode])

  // Update toolbar visibility when selection changes or mode changes
  useEffect(() => {
    setIsToolbarVisible(selectedUids.length > 0 && isMultiSelectMode)
  }, [selectedUids, isMultiSelectMode])

  const handleSelectEmail = useCallback((uid: number, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation()
    }

    setSelectedUids(prev => (prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]))
  }, [])

  const handleCheckboxSelect = useCallback((uid: number, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation()
    }

    setSelectedUids(prev => {
      const newSelectedUids = prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]

      // If this is the first selection, enable multi-select mode
      if (prev.length === 0 && newSelectedUids.length > 0) {
        setIsMultiSelectMode(true)
      }

      return newSelectedUids
    })
  }, [])

  const handleSelectAll = useCallback(() => {
    if (selectAll) {
      setSelectedUids([])
      setSelectAll(false)
      // Disable multi-select mode when Deselect All
      setIsMultiSelectMode(false)
    } else {
      // Enable multi-select mode when Select All
      setIsMultiSelectMode(true)
      setSelectedUids(filteredEmails.map(email => email.uid))
      setSelectAll(true)
    }
  }, [selectAll, filteredEmails])

  const handleCancelSelection = useCallback(() => {
    setSelectedUids([])
    setSelectAll(false)
    // Disable multi-select mode
    setIsMultiSelectMode(false)
  }, [])

  const handleDeleteSelected = useCallback(async () => {
    if (
      (selectedAccountId?.length ?? 0) === 0 ||
      selectedUids.length === 0 ||
      (selectedMailbox?.length ?? 0) === 0 ||
      selectedAccountId === null ||
      selectedAccountId === undefined ||
      selectedMailbox === null ||
      selectedMailbox === undefined
    )
      return

    try {
      await window.ipcApi.deleteEmails(selectedAccountId, selectedMailbox, selectedUids)
      removeEmailHeaders(selectedUids)
      setSelectedUids([])
      setSelectAll(false)
    } catch (e: unknown) {
      console.error('Failed to delete selected emails:', e)
      setError(e instanceof Error ? e.message : 'Failed to delete selected emails')
    }
  }, [selectedAccountId, selectedUids, selectedMailbox, removeEmailHeaders])

  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()

    if (isToday) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    }

    const isThisYear = date.getFullYear() === now.getFullYear()
    if (isThisYear) {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }

    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  }, [])

  const hasAttachments = useCallback((email: EmailHeader): boolean => {
    return (
      (email.flags?.includes('\\HasAttachment') ?? false) ||
      email.attributes?.hasAttachment === true ||
      false
    )
  }, [])

  const isStarred = useCallback((email: EmailHeader): boolean => {
    return email.flags?.includes('\\Flagged') ?? false
  }, [])

  return {
    isLoading,
    isFetchingMore,
    error,
    hasLoadedOnce,
    selectedUids,
    selectAll,
    isToolbarVisible,
    keyboardSelectedIndex,
    isMultiSelectMode,
    selectedEmailId,
    emailHeaders,
    filteredEmails,
    hasMoreEmails,
    totalEmailCount,
    currentPage,
    observer,

    // Legacy aliases for backward compatibility
    emails: filteredEmails,
    selectEmail: (uid: number) => {
      // Update store for EmailViewer
      const { selectEmail: storeSelectEmail } = useAccountStore.getState()
      storeSelectEmail(uid)
      // Local state synchronizes automatically through useEffect
    },
    keyboardSelectedEmailId:
      keyboardSelectedIndex >= 0 ? filteredEmails[keyboardSelectedIndex]?.uid || null : null,
    selectedAccountId,
    selectedMailbox,
    lastEmailElementRef,
    loadMoreEmails,
    loadPage,
    handleSelectEmail,
    handleCheckboxSelect,
    handleSelectAll,
    handleCancelSelection,
    handleDeleteSelected,
    setKeyboardSelectedIndex,
    setSelectedUids,
    setSelectAll,
    setCurrentPage: (page: number) => {
      // Update local state immediately
      setLocalCurrentPage(page)
      // Also update store for persistence
      if (selectedAccountId && selectedMailbox) {
        setCurrentPageForMailbox(selectedAccountId, selectedMailbox, page)
      }
    },
    formatDate,
    hasAttachments,
    isStarred,
  }
}
