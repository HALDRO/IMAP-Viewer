/**
 * @file Panel that contains the list of mailboxes with collapsible support
 * @description Displays email folders with two view modes:
 * - Expanded: Full view with folder names, counts, and controls
 * - Collapsed: Compact icon-only view (80px width) showing only folder icons
 * Supports folder refresh, search filtering, and adaptive UI based on collapsed state.
 */
import {
  Archive,
  ChevronDown,
  Folder,
  Inbox,
  Loader2,
  Mailbox,
  RefreshCw,
  Search,
  Send,
  Trash2,
} from 'lucide-react'
import React, { useState, useMemo, useCallback } from 'react'

import { useAccountInitializer } from '../shared/hooks/useAccountInitializer'
import { useAccountStore } from '../shared/store/accounts/accountStore'
import type { MailBoxes } from '../shared/types/electron'
import { Button } from '../shared/ui/button'
import { ScrollArea } from '../shared/ui/scroll-area'
import { ProxyStatusWidget } from './ProxyStatusWidget'

interface EmailListPanelProps {
  searchQuery?: string
  onSearchChange?: (query: string) => void
  collapsed?: boolean
}

/**
 * Component for displaying and managing email folders
 */
const EmailListPanel: React.FC<EmailListPanelProps> = React.memo(
  ({ searchQuery = '', onSearchChange, collapsed = false }) => {
    const {
      selectedAccountId,
      selectedMailbox,
      selectMailbox,
      emailCountByMailbox,
      emailHeadersByMailbox,
      clearEmailHeadersForMailbox,
    } = useAccountStore()

    const { isInitializing, initializationError, mailboxes, initializeAccount } =
      useAccountInitializer()

    // Local state for UI
    const [showFolders, setShowFolders] = useState(true)
    const [isRefreshing, setIsRefreshing] = useState(false)

    // Helper function to get icon for mailbox
    const getMailboxIcon = useCallback(
      (mailboxName: string, attribs: string[] = []): React.ElementType => {
        const name = mailboxName.toLowerCase()
        const attributes = attribs.map(attr => attr.toLowerCase())

        if (attributes.includes('\\inbox') || name === 'inbox') return Inbox
        if (attributes.includes('\\sent') || name.includes('sent')) return Send
        if (attributes.includes('\\trash') || name.includes('trash') || name.includes('deleted'))
          return Trash2
        if (attributes.includes('\\archive') || name.includes('archive')) return Archive
        return Folder
      },
      []
    )

    // Convert mailboxes to flat list for rendering
    const renderedFolders = useMemo(() => {
      if (!mailboxes) return []

      const processMailboxes = (
        boxes: MailBoxes,
        prefix = ''
      ): {
        name: string
        label: string
        Icon: React.ElementType
        count: number
        isSelectable: boolean
        isRoot: boolean
      }[] => {
        const localResult: {
          name: string
          label: string
          Icon: React.ElementType
          count: number
          isSelectable: boolean
          isRoot: boolean
        }[] = []

        for (const [name, box] of Object.entries(boxes)) {
          const boxWithAttribs = box as {
            attribs: string[]
            children: MailBoxes
            delimiter: string
          }
          const fullName = prefix ? `${prefix}${boxWithAttribs.delimiter}${name}` : name
          const Icon = getMailboxIcon(name, boxWithAttribs.attribs)

          // Get email count from store
          const mailboxKey = `${selectedAccountId}-${fullName}`
          const count = emailCountByMailbox[mailboxKey] || 0

          const isSelectable = !boxWithAttribs.attribs.includes('\\Noselect')

          localResult.push({
            name: fullName,
            label: name,
            Icon,
            count,
            isSelectable,
            isRoot: prefix === '',
          })

          if (boxWithAttribs.children) {
            localResult.push(...processMailboxes(boxWithAttribs.children, fullName))
          }
        }
        return localResult
      }

      return processMailboxes(mailboxes)
    }, [mailboxes, selectedAccountId, emailCountByMailbox, getMailboxIcon])

    // Handle refresh - refreshes both folders and all emails
    const handleRefresh = useCallback(async (): Promise<void> => {
      if (selectedAccountId === null || selectedAccountId === '' || isRefreshing) return

      setIsRefreshing(true)
      try {
        // Clear all cached emails for this account
        for (const key of Object.keys(emailHeadersByMailbox)) {
          if (key.startsWith(`${selectedAccountId}-`)) {
            const mailboxName = key.substring(`${selectedAccountId}-`.length)
            clearEmailHeadersForMailbox(selectedAccountId, mailboxName)
          }
        }

        // Refresh account (folders and mailboxes)
        await initializeAccount(selectedAccountId, true)

        // Force reload of currently selected mailbox if any
        if (selectedMailbox !== null && selectedMailbox !== '') {
          // Trigger a re-selection to force email reload
          const currentMailbox = selectedMailbox
          selectMailbox('') // Clear selection temporarily
          setTimeout(() => {
            selectMailbox(currentMailbox) // Re-select to trigger reload
          }, 100)
        }
      } finally {
        setIsRefreshing(false)
      }
    }, [
      selectedAccountId,
      isRefreshing,
      emailHeadersByMailbox,
      clearEmailHeadersForMailbox,
      selectedMailbox,
      selectMailbox,
      initializeAccount,
    ])

    if (isInitializing) {
      return (
        <div className="flex flex-col h-full bg-background text-foreground">
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="flex flex-col items-center space-y-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center bg-muted">
                <Loader2 size={28} className="text-primary animate-spin" />
              </div>
              {!collapsed && (
                <div className="text-center">
                  <h3 className="text-lg font-medium mb-2">Initializing Account</h3>
                  <p className="text-sm text-muted-foreground">Loading folders and emails...</p>
                </div>
              )}
            </div>
          </div>
          {/* Proxy status widget - fixed at bottom */}
          <ProxyStatusWidget collapsed={collapsed} />
        </div>
      )
    }

    if (initializationError !== null && initializationError !== '') {
      return (
        <div className="flex flex-col h-full bg-background text-foreground">
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="flex flex-col items-center space-y-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center bg-destructive/10">
                <Mailbox size={28} className="text-destructive" />
              </div>
              {!collapsed && (
                <div className="text-center">
                  <h3 className="text-lg font-medium mb-2">Failed to Load Account</h3>
                  <p className="text-sm text-muted-foreground">{initializationError}</p>
                  <Button
                    onClick={() => {
                      if (selectedAccountId !== null && selectedAccountId !== '') {
                        void initializeAccount(selectedAccountId, true)
                      }
                    }}
                    className="mt-4"
                    variant="outline"
                  >
                    <RefreshCw size={16} className="mr-2" />
                    Retry
                  </Button>
                </div>
              )}
            </div>
          </div>
          {/* Proxy status widget - fixed at bottom */}
          <ProxyStatusWidget collapsed={collapsed} />
        </div>
      )
    }

    if ((selectedAccountId?.length ?? 0) === 0) {
      return (
        <div className="flex flex-col h-full bg-background text-foreground">
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="flex flex-col items-center space-y-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center bg-muted">
                <Mailbox size={28} className="text-muted-foreground" />
              </div>
              {!collapsed && (
                <div className="text-center">
                  <h3 className="text-lg font-medium mb-2">No Account Selected</h3>
                  <p className="text-sm text-gray-400">Select an account to view your emails</p>
                </div>
              )}
            </div>
          </div>
          {/* Proxy status widget - fixed at bottom */}
          <ProxyStatusWidget collapsed={collapsed} />
        </div>
      )
    }

    return (
      <nav
        className="flex flex-col h-full bg-background text-foreground"
        aria-label="Email folders"
      >
        {/* Folders section */}
        <ScrollArea className={collapsed ? 'p-2 grow' : 'p-3 grow'}>
          {!collapsed && onSearchChange && (
            <div className="mb-3 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => onSearchChange(e.target.value)}
                placeholder="Filter emails..."
                className="flex h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          )}

          {!collapsed && (
            <div className="flex items-center justify-between pb-2 mb-1">
              <button
                type="button"
                className="flex items-center gap-2 cursor-pointer py-2 px-1 focus:outline-none focus:ring-2 focus:ring-ring rounded"
                onClick={() => setShowFolders(!showFolders)}
                aria-expanded={showFolders}
                aria-controls="folders-list"
              >
                <ChevronDown
                  size={16}
                  className={`text-muted-foreground transition-transform duration-200 ${showFolders ? 'transform rotate-0' : 'transform -rotate-90'}`}
                  aria-hidden="true"
                />
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Folders
                </h3>
              </button>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    void handleRefresh()
                  }}
                  title="Refresh folders"
                  aria-label="Refresh folder list"
                  disabled={isRefreshing}
                  className="rounded-full h-8 w-8"
                >
                  <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
                </Button>
              </div>
            </div>
          )}

          {collapsed && (
            <div className="flex flex-col items-center mb-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  void handleRefresh()
                }}
                title="Refresh folders"
                aria-label="Refresh folder list"
                disabled={isRefreshing}
                className="rounded-full h-8 w-8"
              >
                <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
              </Button>
            </div>
          )}

          {(collapsed || showFolders) &&
            (renderedFolders.length === 0 && !isInitializing ? (
              !collapsed && (
                <div className="text-center py-8">
                  <div className="text-muted-foreground text-sm">
                    <p className="mb-2">No folders available</p>
                    <p className="text-xs">Check your connection settings</p>
                  </div>
                </div>
              )
            ) : (
              <ul
                id="folders-list"
                className={collapsed ? 'space-y-1 flex flex-col items-center' : 'space-y-0.5 pl-2'}
              >
                {renderedFolders
                  .filter(
                    mailbox =>
                      mailbox.isRoot &&
                      mailbox.label.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map(mailbox => {
                    const Icon = mailbox.Icon
                    const isSelected = selectedMailbox === mailbox.name

                    return (
                      <li key={mailbox.name}>
                        <button
                          type="button"
                          onClick={() => selectMailbox(mailbox.name)}
                          className={`
                          ${collapsed ? 'w-12 h-12 flex items-center justify-center rounded-full' : 'w-full flex items-center gap-3 px-3 py-2 rounded-full'} transition-all text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring
                          ${
                            isSelected
                              ? 'bg-primary/20 text-primary-foreground'
                              : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                          }
                        `}
                          aria-current={isSelected ? 'page' : undefined}
                          aria-label={`Select ${mailbox.label} folder`}
                          title={collapsed ? mailbox.label : undefined}
                        >
                          <Icon
                            size={18}
                            className={isSelected ? 'text-primary' : 'text-muted-foreground'}
                            aria-hidden="true"
                          />
                          {!collapsed && (
                            <>
                              <span className="truncate">{mailbox.label}</span>
                              {typeof mailbox.count === 'number' && mailbox.count > 0 && (
                                <span className="ml-auto text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full min-w-6 text-center">
                                  {mailbox.count}
                                </span>
                              )}
                            </>
                          )}
                        </button>
                      </li>
                    )
                  })}
              </ul>
            ))}
        </ScrollArea>

        {/* Proxy status widget - fixed at bottom */}
        <ProxyStatusWidget collapsed={collapsed} />
      </nav>
    )
  }
)

export default EmailListPanel
