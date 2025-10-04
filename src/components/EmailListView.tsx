/**
 * @file Renders the list of emails with pagination, search filtering, and smart multi-select functionality.
 * @description Email list component with smart view and selection mode management:
 * - Regular click on email opens it for viewing (selectEmail → AccountStore)
 * - Checkbox click activates multi-select mode (handleCheckboxSelect)
 * - Mode automatically deactivates when last checkbox is unchecked
 * - In active mode, click on email works as checkbox (handleSelectEmail)
 * - Cancel button completely exits multi-select mode
 * - Toolbar displayed only in active mode AND when emails are selected
 * - Uses utility functions from hook (formatDate, hasAttachments, isStarred)
 * - Delete confirmation dialog with selected email count
 * - Keyboard shortcuts: Arrow Left/Right for page navigation (disabled in input fields)
 * - Flexbox layout for proper adaptation to full screen height
 */
import { CheckSquare, Inbox, Mail, Paperclip, Star, Trash2, User, X } from 'lucide-react'
import type React from 'react'
import { useEffect, useState } from 'react'

import { PAGE_SIZE, useEmailList } from '../shared/hooks/useEmailList'
import type { EmailHeader } from '../shared/types/email'
import { Button } from '../shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../shared/ui/dialog'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '../shared/ui/pagination'
import { ScrollArea } from '../shared/ui/scroll-area'
import { cn } from '../shared/utils/utils'
import EmailListSkeleton from './EmailListSkeleton'
import RelativeTime from './RelativeTime'

interface EmailListViewProps {
  searchQuery?: string
}

const EmailListView: React.FC<EmailListViewProps> = ({ searchQuery = '' }) => {
  const {
    emails,
    selectedEmailId,
    selectEmail,
    keyboardSelectedEmailId,
    isLoading,
    selectedUids,
    totalEmailCount,
    currentPage,
    loadPage,
    handleSelectEmail,
    handleCheckboxSelect,
    handleSelectAll,
    handleCancelSelection,
    handleDeleteSelected,
    isToolbarVisible,
    isMultiSelectMode,
    filteredEmails,
    selectedAccountId,
    formatDate,
    hasAttachments,
    isStarred,
  } = useEmailList({ searchQuery })

  const totalPages = Math.ceil(totalEmailCount / PAGE_SIZE)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  // Keyboard shortcuts for pagination
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not in input/textarea and pagination exists
      if (
        totalPages <= 1 ||
        isLoading ||
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return
      }

      if (e.key === 'ArrowLeft' && currentPage > 1) {
        e.preventDefault()
        loadPage(currentPage - 1)
      } else if (e.key === 'ArrowRight' && currentPage < totalPages) {
        e.preventDefault()
        loadPage(currentPage + 1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentPage, totalPages, isLoading, loadPage])

  // Function for confirmed deletion
  const handleConfirmedDelete = async () => {
    await handleDeleteSelected()
    setIsDeleteDialogOpen(false)
  }

  if (isLoading && emails.length === 0) {
    return <EmailListSkeleton />
  }

  if (emails.length === 0) {
    const isAccountSelected = selectedAccountId !== null && selectedAccountId !== undefined
    const message = isAccountSelected ? 'No emails found' : 'Select an account'

    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="text-center text-gray-500">
          <Inbox size={48} className="mx-auto" />
          <p className="mt-4 text-lg">{message}</p>
        </div>
      </div>
    )
  }

  // Email selection toolbar
  const EmailSelectionToolbar = () => {
    if (!isToolbarVisible || selectedUids.length === 0) return null

    return (
      <div className="bg-blue-900/20 border-b border-blue-800/30 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSelectAll}
            className="text-blue-300 hover:text-blue-100 hover:bg-blue-800/30"
          >
            <CheckSquare size={16} className="mr-2" />
            {selectedUids.length === filteredEmails.length ? 'Deselect All' : 'Select All'}
          </Button>
          <span className="text-sm text-blue-300">
            {selectedUids.length} of {filteredEmails.length} selected
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancelSelection}
            className="text-gray-400 hover:text-gray-300 hover:bg-gray-800/30"
          >
            <X size={16} className="mr-2" />
            Cancel
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsDeleteDialogOpen(true)}
            className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
          >
            <Trash2 size={16} className="mr-2" />
            Delete
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full bg-background text-foreground flex flex-col">
      <EmailSelectionToolbar />
      <div className="flex-1 flex flex-col min-h-0">
        <ScrollArea className="divide-y divide-gray-800/20 flex-1" aria-label="Email list">
          <ul>
            {emails.map((email: EmailHeader) => {
              const isCurrent = selectedEmailId === email.uid
              const isSelected = selectedUids.includes(email.uid)
              const isKeyboardSelected = keyboardSelectedEmailId === email.uid
              const emailHasAttachments = hasAttachments(email)
              const emailIsStarred = isStarred(email)

              // Determine click logic: in multi-select mode work as checkbox, otherwise open email
              const handleEmailClick = () => {
                if (isMultiSelectMode) {
                  // Multi-select mode: add/remove from selection (DO NOT enable mode)
                  handleSelectEmail(email.uid)
                } else {
                  // Normal mode: select single email for viewing (DO NOT enable multi-select mode)
                  selectEmail(email.uid)
                }
              }

              const handleEmailKeyDown = (e: React.KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleEmailClick()
                }
              }

              return (
                <li
                  key={email.uid}
                  className={cn(
                    'px-4 py-2 cursor-pointer transition-all hover:bg-gray-800/30 flex items-center gap-3 border-b border-gray-800/20',
                    isCurrent && 'bg-blue-900/30',
                    isSelected && 'bg-gray-800/40',
                    isKeyboardSelected && 'ring-2 ring-yellow-500'
                  )}
                  onClick={handleEmailClick}
                  onKeyDown={handleEmailKeyDown}
                  aria-selected={isCurrent}
                  tabIndex={isKeyboardSelected ? 0 : -1}
                >
                  {/* Checkbox */}
                  <div className="flex items-center justify-center w-5 h-5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={e => {
                        e.stopPropagation()
                        handleCheckboxSelect(email.uid)
                      }}
                      onClick={e => {
                        e.stopPropagation()
                      }}
                      className="w-4 h-4 rounded bg-transparent border border-gray-500 accent-blue-500 cursor-pointer focus:ring-2 focus:ring-blue-500"
                      aria-label={`Select email from ${email.from.text}`}
                    />
                  </div>

                  {/* Star */}
                  <div className="flex items-center justify-center w-5 h-5">
                    {emailIsStarred && <Star size={16} className="text-yellow-400 fill-current" />}
                  </div>

                  {/* Main content area */}
                  <div className="flex-1 min-w-0 pr-3">
                    {/* First line: Sender with icon */}
                    <div className="flex items-center gap-2 mb-1">
                      <User size={14} className="text-blue-400 shrink-0" />
                      <span
                        className={cn(
                          'text-sm font-medium truncate',
                          !email.seen ? 'text-white' : 'text-gray-300'
                        )}
                      >
                        {email.from.text}
                      </span>
                    </div>

                    {/* Second line: Subject with icon */}
                    <div className="flex items-center gap-2">
                      <Mail size={14} className="text-green-400 shrink-0" />
                      <span
                        className={cn(
                          'text-sm truncate',
                          !email.seen ? 'text-gray-200' : 'text-gray-400'
                        )}
                      >
                        {email.subject || '(no subject)'}
                      </span>
                    </div>
                  </div>

                  {/* Attachments and time */}
                  <div className="flex items-center gap-2 shrink-0 w-20">
                    {emailHasAttachments && <Paperclip size={16} className="text-gray-400" />}

                    <div className="flex flex-col items-end text-xs">
                      <span className={cn(!email.seen ? 'text-gray-300' : 'text-gray-500')}>
                        {formatDate(email.date)}
                      </span>
                      <RelativeTime
                        dateString={email.date}
                        className={cn(
                          'text-xs mt-0.5',
                          !email.seen ? 'text-blue-300' : 'text-gray-400'
                        )}
                        maxRelativeTime={24 * 60 * 60 * 1000} // Show relative time for 24 hours
                        showOnlyRelative
                      />
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </ScrollArea>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="relative px-3 flex items-center border-t border-border bg-card shrink-0 h-component-lg">
            {/* Email count info */}
            <div className="absolute left-3 text-xs text-muted-foreground top-1/2 -translate-y-1/2">
              {(currentPage - 1) * PAGE_SIZE + 1}-
              {Math.min(currentPage * PAGE_SIZE, totalEmailCount)} of {totalEmailCount} emails
            </div>

            {/* Pagination controls */}
            <Pagination className="justify-center">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => {
                      if (currentPage > 1 && !isLoading) {
                        loadPage(currentPage - 1)
                      }
                    }}
                    size="sm"
                    className={cn(
                      'cursor-pointer text-foreground hover:bg-accent',
                      (currentPage === 1 || isLoading) && 'pointer-events-none opacity-50'
                    )}
                  />
                </PaginationItem>

                {/* Page numbers */}
                {(() => {
                  const pages: (number | string)[] = []

                  if (totalPages <= 3) {
                    // If pages are few (≤3), show all
                    for (let i = 1; i <= totalPages; i++) {
                      pages.push(i)
                    }
                  } else {
                    // Compact pagination: maximum 3 pages + ellipsis

                    if (currentPage <= 2) {
                      // At start: 1 2 3 ... last
                      pages.push(1, 2, 3)
                      pages.push('ellipsis-end')
                      pages.push(totalPages)
                    } else if (currentPage >= totalPages - 1) {
                      // At end: 1 ... penultimate last-1 last
                      pages.push(1)
                      pages.push('ellipsis-start')
                      pages.push(totalPages - 2, totalPages - 1, totalPages)
                    } else {
                      // In middle: 1 ... current-1 current current+1 ... last
                      pages.push(1)
                      pages.push('ellipsis-start')
                      pages.push(currentPage - 1, currentPage, currentPage + 1)
                      pages.push('ellipsis-end')
                      pages.push(totalPages)
                    }
                  }

                  return pages.map(page => {
                    if (typeof page === 'string') {
                      return (
                        <PaginationItem key={page}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      )
                    }

                    return (
                      <PaginationItem key={page}>
                        <PaginationLink
                          onClick={() => {
                            if (page !== currentPage && !isLoading) {
                              loadPage(page)
                            }
                          }}
                          isActive={page === currentPage}
                          size="sm"
                          className={cn(
                            'cursor-pointer min-w-8 h-8 text-foreground hover:bg-accent',
                            page === currentPage && 'bg-primary hover:bg-primary/90',
                            isLoading && 'pointer-events-none opacity-50'
                          )}
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    )
                  })
                })()}

                <PaginationItem>
                  <PaginationNext
                    onClick={() => {
                      if (currentPage < totalPages && !isLoading) {
                        loadPage(currentPage + 1)
                      }
                    }}
                    size="sm"
                    className={cn(
                      'cursor-pointer text-foreground hover:bg-accent',
                      (currentPage === totalPages || isLoading) && 'pointer-events-none opacity-50'
                    )}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedUids.length} selected email
              {selectedUids.length > 1 ? 's' : ''}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                void handleConfirmedDelete()
              }}
            >
              Delete {selectedUids.length} Email{selectedUids.length > 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default EmailListView
