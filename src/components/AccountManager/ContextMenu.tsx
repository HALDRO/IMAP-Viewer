/**
 * @file Context menu component for account actions
 */
import { Copy, Edit, Trash2 } from 'lucide-react';
import React from 'react';

import type { Account } from '../../shared/types/account';

interface ContextMenuProps {
  contextMenu: {
    x: number;
    y: number;
    accountId: string;
  } | null;
  accounts: Account[];
  onEdit: (account: Account) => void;
  onCopyCredentials: (account: Account) => Promise<void>;
  onDelete: (accountId: string) => Promise<void>;
  onClose: () => void;
  onSaveScrollPosition?: (position: number) => void;
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
  if (!contextMenu) return null;

  const account = accounts.find(acc => acc.id === contextMenu.accountId);
  if (!account) return null;

  return (
    <div
      className="fixed z-50 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[120px]"
      style={{
        left: contextMenu.x,
        top: contextMenu.y,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center gap-2"
        onClick={() => {
          // Save scroll position before editing
          if (onSaveScrollPosition) {
            const scrollContainer = document.querySelector('[data-scroll-container="account-list"]') as HTMLElement;
            if (scrollContainer) {
              onSaveScrollPosition(scrollContainer.scrollTop);
            }
          }
          onEdit(account);
          onClose();
        }}
      >
        <Edit size={14} />
        Edit Account
      </button>
      <button
        className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center gap-2"
        onClick={() => {
          void onCopyCredentials(account);
          onClose();
        }}
      >
        <Copy size={14} />
        Copy Credentials
      </button>
      <div className="border-t border-border my-1" />
      <button
        className="w-full px-3 py-2 text-left text-sm hover:bg-destructive/10 text-destructive flex items-center gap-2"
        onClick={() => {
          void onDelete(contextMenu.accountId);
          onClose();
        }}
      >
        <Trash2 size={14} />
        Delete Account
      </button>
    </div>
  );
};
