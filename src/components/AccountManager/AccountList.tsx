/**
 * @file Unified account list component with stable hover effects and anti-sticking protection
 * @description Component with fully unified interface and reliable hover state management:
 * - In collapsed mode: main container with justify-center centers the entire account element,
 *   visual elements (avatars/indexes) are additionally centered within their containers,
 *   hover panel OUTSIDE sidebar (left), rounded on left, straight side on right (to sidebar line).
 *   Creates precise invisible bridge from right edge of account to hover panel, excluding LogIn button area
 * - In expanded mode: main container with grow takes full width, hover panel pressed against right screen wall,
 *   rounded on left, straight side on right (to screen wall)
 *
 * Hover panel remains visible while mouse is in any part of hover area (account + bridge + panel).
 * Precise bridge in collapsed mode: from accountRight to sidebarLeft, prevents conflicts with LogIn button.
 *
 * Protection against hover panel sticking:
 * - 100ms timeout on mouseLeave for smooth transition between elements
 * - Automatic state clearing on container scroll
 * - Forced hiding on component unmount
 * - Timeout cancellation on mouse re-entry
 *
 * Uses double hover state (isHovered + isHoveringButtons) + precision bridge element + hoverTimeoutRef.
 * In both modes uses rounded-l-full border-l border-t border-b for consistency.
 * Double centering: main container + inner containers for perfect positioning in collapsed.
 * Preserves ALL visual elements (avatars, statuses, indicators, paddings), hides only text.
 * Hover panel height equals account element height. Positioning through right-based calculations
 * with getBoundingClientRect() for precise alignment. Uses unified AccountListItem,
 * ScrollArea, supports compact/normal view and context menus.
 */
import { Copy, Edit, LogIn, Trash2 } from 'lucide-react'
import React, { useRef, useEffect, useCallback, useState } from 'react'
import { createPortal } from 'react-dom'

import { type MainSettings, useMainSettingsStore } from '../../shared/store/mainSettingsStore'
import type { Account } from '../../shared/types/account'
import { Avatar, AvatarFallback } from '../../shared/ui'
import { Button } from '../../shared/ui/button'
import { ScrollArea } from '../../shared/ui/scroll-area'
import { cn } from '../../shared/utils/utils'

interface AccountListProps {
  accounts: Account[]
  selectedAccountId: string | null
  recentlyDeletedId: string | null
  onSelectAccount: (accountId: string) => void
  onContextMenu: (e: React.MouseEvent, accountId: string) => void
  onEdit: (account: Account) => void
  onDelete: (accountId: string) => void
  onUndo?: (accountId: string) => void
  onCopyCredentials: (account: Account) => void
  onConnectAccount?: (accountId: string) => void
  collapsed?: boolean
  onSaveScrollPosition?: (position: number) => void
  scrollPositionToRestore?: number
}

// Memoized component for individual account element
const AccountListItem = React.memo<{
  account: Account
  index: number
  isSelected: boolean
  recentlyDeletedId: string | null
  onSelectAccount: (accountId: string) => void
  onContextMenu: (e: React.MouseEvent, accountId: string) => void
  onEdit: (account: Account) => void
  onDelete: (accountId: string) => void
  onCopyCredentials: (account: Account) => void
  onConnectAccount?: (accountId: string) => void
  onSaveScrollPosition?: (position: number) => void
  scrollContainerRef: React.RefObject<HTMLDivElement>
  settings: MainSettings
  collapsed?: boolean
}>(
  ({
    account,
    index,
    isSelected,
    recentlyDeletedId,
    onSelectAccount,
    onContextMenu,
    onEdit,
    onDelete,
    onCopyCredentials,
    onConnectAccount,
    onSaveScrollPosition,
    scrollContainerRef,
    settings,
    collapsed = false,
  }) => {
    const [isHovered, setIsHovered] = useState(false)
    const [isHoveringButtons, setIsHoveringButtons] = useState(false)
    const [buttonPosition, setButtonPosition] = useState<{
      top: number
      height: number
      isCollapsed: boolean
      sidebarLeft?: number
      sidebarRight?: number
      accountRight?: number
    } | null>(null)
    const itemRef = useRef<HTMLDivElement>(null)
    const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    // Cleanup function for forced hover panel hiding
    const forceHideHover = useCallback(() => {
      setIsHovered(false)
      setIsHoveringButtons(false)
      setButtonPosition(null)
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
        hoverTimeoutRef.current = null
      }
    }, [])

    // Clear timeout on component unmount
    useEffect(() => {
      return () => {
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current)
        }
      }
    }, [])

    // Hide hover panel on container scroll
    useEffect(() => {
      const scrollContainer = scrollContainerRef.current
      if (!scrollContainer) return

      const handleScroll = () => {
        if (isHovered || isHoveringButtons) {
          forceHideHover()
        }
      }

      scrollContainer.addEventListener('scroll', handleScroll, { passive: true })
      return () => {
        scrollContainer.removeEventListener('scroll', handleScroll)
      }
    }, [isHovered, isHoveringButtons, forceHideHover, scrollContainerRef])

    const handleSelectAccount = useCallback(() => {
      onSelectAccount(account.id)
    }, [account.id, onSelectAccount])

    const handleEdit = useCallback(() => {
      if (onSaveScrollPosition && scrollContainerRef.current) {
        onSaveScrollPosition(scrollContainerRef.current.scrollTop)
      }
      onEdit(account)
    }, [account, onEdit, onSaveScrollPosition, scrollContainerRef])

    const handleContextMenu = useCallback(
      (e: React.MouseEvent) => {
        onContextMenu(e, account.id)
      },
      [account.id, onContextMenu]
    )

    const handleDelete = useCallback(() => {
      onDelete(account.id)
    }, [account.id, onDelete])

    const handleCopyCredentials = useCallback(() => {
      onCopyCredentials(account)
    }, [account, onCopyCredentials])

    const handleConnect = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation()
        if (onConnectAccount && account?.id) {
          try {
            onConnectAccount(account.id)
          } catch (error) {
            console.error(`Failed to connect account ${account.id}:`, error)
          }
        }
      },
      [account.id, onConnectAccount]
    )

    const handleMouseEnter = useCallback(() => {
      if (recentlyDeletedId === account.id) return

      // Cancel any scheduled hiding
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
        hoverTimeoutRef.current = null
      }

      setIsHovered(true)
      if (itemRef.current) {
        const rect = itemRef.current.getBoundingClientRect()
        const sidebarElement = itemRef.current.closest('[data-panel-id="account-panel"]')
        const sidebarRect = sidebarElement?.getBoundingClientRect()

        if (collapsed) {
          // In collapsed mode: hover panel OUTSIDE sidebar (left), aligned with sidebar left edge
          setButtonPosition({
            top: rect.top,
            sidebarLeft: sidebarRect ? sidebarRect.left : rect.left,
            accountRight: rect.right, // Right edge of account for bridge
            height: rect.height,
            isCollapsed: true,
          })
        } else {
          // In expanded mode: hover panel OUTSIDE sidebar (right), aligned with sidebar right edge
          setButtonPosition({
            top: rect.top,
            sidebarRight: sidebarRect ? window.innerWidth - sidebarRect.right : 0,
            height: rect.height,
            isCollapsed: false,
          })
        }
      }
    }, [account.id, recentlyDeletedId, collapsed])

    const handleMouseLeave = useCallback(() => {
      // Launch timeout for hiding hover panel with small delay
      // This gives mouse time to reach bridge or hover panel
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }

      hoverTimeoutRef.current = setTimeout(() => {
        if (!isHoveringButtons) {
          setIsHovered(false)
          setButtonPosition(null)
        }
      }, 100) // 100ms delay for smooth transition between elements
    }, [isHoveringButtons])

    const handleButtonsMouseEnter = useCallback(() => {
      // Cancel hiding if mouse reached hover panel
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
        hoverTimeoutRef.current = null
      }
      setIsHoveringButtons(true)
    }, [])

    const handleButtonsMouseLeave = useCallback(() => {
      setIsHoveringButtons(false)
      // Immediately hide hover panel when mouse leaves it
      setIsHovered(false)
      setButtonPosition(null)

      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
        hoverTimeoutRef.current = null
      }
    }, [])

    const displayLabel = account.displayName ?? account.email
    const isDefaultName = /^Account \d+ \w+$/.test(account.displayName ?? '')
    const avatarName = isDefaultName ? account.email : (account.displayName ?? '')

    const actionButtonsPortal =
      (isHovered || isHoveringButtons) &&
      buttonPosition &&
      createPortal(
        <>
          {/* Invisible bridge for collapsed mode - from right edge of account to hover panel */}
          {buttonPosition.isCollapsed &&
            typeof buttonPosition.accountRight === 'number' &&
            typeof buttonPosition.sidebarLeft === 'number' && (
              <div
                className="fixed z-40 pointer-events-auto"
                style={{
                  top: buttonPosition.top,
                  left: buttonPosition.accountRight,
                  right: `calc(100vw - ${buttonPosition.sidebarLeft}px)`,
                  height: buttonPosition.height,
                }}
                onMouseEnter={handleButtonsMouseEnter}
                onMouseLeave={handleButtonsMouseLeave}
              />
            )}

          <div
            className="fixed z-50 flex items-center opacity-100 transition-opacity duration-200 pointer-events-auto"
            style={{
              top: buttonPosition.top,
              right: buttonPosition.isCollapsed
                ? `calc(100vw - ${buttonPosition.sidebarLeft}px)` // Collapsed: left of sidebar
                : `${buttonPosition.sidebarRight}px`, // Expanded: right of sidebar
              height: buttonPosition.height,
            }}
            onClick={e => e.stopPropagation()}
            onDoubleClick={e => e.stopPropagation()}
            onMouseEnter={handleButtonsMouseEnter}
            onMouseLeave={handleButtonsMouseLeave}
            onKeyDown={e => {
              if (e.key === 'Escape') {
                handleButtonsMouseLeave()
              }
            }}
          >
            <div className="flex items-center gap-2 bg-card/95 backdrop-blur-sm px-4 h-full border-border shadow-lg rounded-l-full border-l border-t border-b pointer-events-auto">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-full hover:bg-accent/50 pointer-events-auto"
                onClick={handleCopyCredentials}
                title="Copy credentials"
              >
                <Copy size={14} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-full hover:bg-accent/50 pointer-events-auto"
                onClick={handleEdit}
                title="Edit account"
              >
                <Edit size={14} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-full text-destructive hover:text-destructive hover:bg-destructive/10 pointer-events-auto"
                onClick={handleDelete}
                title="Delete account"
              >
                <Trash2 size={14} />
              </Button>
            </div>
          </div>
        </>,
        document.body
      )

    return (
      <>
        <div
          ref={itemRef}
          className={`
          relative rounded-lg transition-all duration-75 overflow-visible group pointer-events-auto
          ${isSelected ? 'bg-blue-900/30' : 'hover:bg-white/5'}
        `}
          onDoubleClick={handleEdit}
          onContextMenu={handleContextMenu}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div
            className={cn(
              'flex items-center',
              settings.compactAccountView === true ? 'p-1.5' : 'p-2'
            )}
          >
            <button
              type="button"
              className={cn(
                'flex items-center gap-3 min-w-0 text-left cursor-pointer pointer-events-auto',
                collapsed ? 'justify-center w-full' : 'grow'
              )}
              onClick={handleSelectAccount}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleSelectAccount()
                }
              }}
              title={account.email}
            >
              {settings.compactAccountView === true ? (
                <div
                  className={cn(
                    'flex items-center gap-2 min-w-0',
                    collapsed ? 'justify-center' : 'flex-1'
                  )}
                >
                  <span
                    className={cn(
                      'text-xs font-mono w-5 h-5 rounded-full flex items-center justify-center shrink-0',
                      account.connectionStatus === 'connected'
                        ? 'bg-green-500/20 text-green-400'
                        : account.connectionStatus === 'connecting'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-red-500/20 text-red-400'
                    )}
                    title={`Account ${index + 1} - ${account.connectionStatus ?? 'disconnected'}`}
                  >
                    {index + 1}
                  </span>
                  {/* In collapsed mode hide textual information */}
                  {!collapsed && <span className="text-sm truncate">{displayLabel}</span>}
                </div>
              ) : (
                <div
                  className={cn('flex items-center gap-3', collapsed ? 'justify-center' : 'w-full')}
                >
                  <div className="relative group/avatar">
                    <Avatar className={cn('w-10 h-10', isSelected && 'ring-2 ring-primary')}>
                      <AvatarFallback
                        className={cn(
                          'font-medium text-sm',
                          isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                        )}
                      >
                        {avatarName.length > 0
                          ? avatarName
                              .split(' ')
                              .map(part => part[0])
                              .slice(0, 2)
                              .join('')
                              .toUpperCase()
                          : (account.email[0]?.toUpperCase() ?? '?')}
                      </AvatarFallback>
                    </Avatar>

                    {/* Index number */}
                    <div className="absolute -top-1 -left-1 rounded-full border-2 border-background bg-muted text-muted-foreground text-xs font-bold flex items-center justify-center w-5 h-5">
                      {index + 1}
                    </div>

                    {/* Status indicator */}
                    {account.connectionStatus !== undefined && (
                      <div
                        className={cn(
                          'absolute -bottom-1 -right-1 rounded-full border-2 border-background w-3 h-3',
                          account.connectionStatus === 'connected' && 'bg-green-500',
                          account.connectionStatus === 'connecting' && 'bg-yellow-500',
                          account.connectionStatus === 'disconnected' && 'bg-red-500'
                        )}
                      />
                    )}
                  </div>

                  {/* In collapsed mode hide textual information */}
                  {!collapsed && (
                    <div className="grow min-w-0 overflow-hidden">
                      <p
                        className={`truncate text-sm ${isSelected ? 'text-blue-200 font-medium' : 'text-gray-200'}`}
                      >
                        {displayLabel}
                      </p>
                      <p className="truncate text-xs text-gray-400">{account.email}</p>
                    </div>
                  )}
                </div>
              )}
            </button>
          </div>

          {/* Login hover button - positioned over the avatar */}
          {onConnectAccount && !settings.compactAccountView && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleConnect}
              className={cn(
                'absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-6 bg-black/50 backdrop-blur-sm border border-border shadow-lg hover:bg-accent/50 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10 rounded-full pointer-events-auto',
                // Different positioning for collapsed vs expanded mode
                collapsed ? 'left-1/2' : 'left-[1.75rem]'
              )}
              title="Connect to account"
            >
              <LogIn size={12} />
            </Button>
          )}
        </div>
        {actionButtonsPortal}
      </>
    )
  }
)

export const AccountList: React.FC<AccountListProps> = React.memo(
  ({
    accounts,
    selectedAccountId,
    recentlyDeletedId,
    onSelectAccount,
    onContextMenu,
    onEdit,
    onDelete,
    onUndo: _onUndo,
    onCopyCredentials,
    onConnectAccount,
    collapsed = false,
    onSaveScrollPosition,
    scrollPositionToRestore,
  }): React.JSX.Element => {
    const settings = useMainSettingsStore(state => state.settings)
    const scrollContainerRef = useRef<HTMLDivElement>(null)

    // Handle scroll position restoration
    useEffect(() => {
      if (typeof scrollPositionToRestore === 'number' && scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollPositionToRestore
      }
    }, [scrollPositionToRestore])

    if (accounts.length === 0) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <p className="text-sm">No accounts configured</p>
            {!collapsed && <p className="text-xs mt-1">Add an account to get started</p>}
          </div>
        </div>
      )
    }

    // Collapsed sidebar view - use same scrollable container as in expanded mode
    if (collapsed) {
      return (
        <ScrollArea
          ref={scrollContainerRef}
          data-scroll-container="account-list"
          className="flex-1 overflow-x-visible overflow-y-auto"
        >
          <div
            className={cn(
              settings.compactAccountView === true ? 'space-y-0' : 'space-y-1',
              'overflow-visible'
            )}
          >
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
                collapsed
              />
            ))}
          </div>
        </ScrollArea>
      )
    }

    return (
      <ScrollArea ref={scrollContainerRef} data-scroll-container="account-list" className="flex-1">
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
              collapsed={false}
            />
          ))}
        </div>
      </ScrollArea>
    )
  }
)
