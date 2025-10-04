import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
/**
 * @file Context menu component for account actions using ShadCN DropdownMenu
 * @description Portal-based dropdown menu positioned at cursor location on right-click
 */
import { Copy, Edit, Trash2 } from 'lucide-react'
import type React from 'react'
import { useEffect, useRef } from 'react'

import type { Account } from '../../shared/types/account'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../../shared/ui/dropdown-menu'

interface ContextMenuProps {
  contextMenu: {
    x: number
    y: number
    accountId: string
  } | null
  accounts: Account[]
  onEdit: (account: Account) => void
  onCopyCredentials: (account: Account) => Promise<void>
  onDelete: (accountId: string) => Promise<void>
  onClose: () => void
  onSaveScrollPosition?: (position: number) => void
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  contextMenu,
  accounts,
  onEdit,
  onCopyCredentials,
  onDelete,
  onClose,
  onSaveScrollPosition,
}) => {
  const virtualRef = useRef<HTMLDivElement>(null)

  // Update virtual element position when context menu position changes
  useEffect(() => {
    if (contextMenu && virtualRef.current) {
      virtualRef.current.style.position = 'fixed'
      virtualRef.current.style.left = `${contextMenu.x}px`
      virtualRef.current.style.top = `${contextMenu.y}px`
      virtualRef.current.style.width = '0px'
      virtualRef.current.style.height = '0px'
    }
  }, [contextMenu])

  if (!contextMenu) return null

  const account = accounts.find(acc => acc.id === contextMenu.accountId)
  if (!account) return null

  const handleEdit = () => {
    // Save scroll position before editing
    if (onSaveScrollPosition) {
      const scrollContainer = document.querySelector(
        '[data-scroll-container="account-list"]'
      ) as HTMLElement
      if (scrollContainer !== null) {
        onSaveScrollPosition(scrollContainer.scrollTop)
      }
    }
    onEdit(account)
    onClose()
  }

  const handleCopy = () => {
    void onCopyCredentials(account)
    onClose()
  }

  const handleDelete = () => {
    void onDelete(contextMenu.accountId)
    onClose()
  }

  return (
    <>
      {/* Virtual anchor element for positioning */}
      <div ref={virtualRef} style={{ position: 'fixed', pointerEvents: 'none' }} />

      {/* ShadCN DropdownMenu */}
      <DropdownMenuPrimitive.Root open={true} onOpenChange={open => !open && onClose()}>
        <DropdownMenuPrimitive.Portal>
          <DropdownMenuContent
            className="min-w-32"
            style={{
              position: 'fixed',
              left: contextMenu.x,
              top: contextMenu.y,
            }}
            onEscapeKeyDown={onClose}
            onInteractOutside={onClose}
          >
            <DropdownMenuItem onClick={handleEdit}>
              <Edit size={14} className="mr-2" />
              Edit Account
            </DropdownMenuItem>

            <DropdownMenuItem onClick={handleCopy}>
              <Copy size={14} className="mr-2" />
              Copy Credentials
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={handleDelete} className="text-destructive">
              <Trash2 size={14} className="mr-2" />
              Delete Account
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuPrimitive.Portal>
      </DropdownMenuPrimitive.Root>
    </>
  )
}
