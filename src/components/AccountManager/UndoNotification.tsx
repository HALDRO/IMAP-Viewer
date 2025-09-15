/**
 * @file Undo notification component for deleted accounts
 */
import { AlertCircle, Undo2, X } from 'lucide-react';
import React from 'react';

import { Button } from '../../shared/ui/button';

interface DeletedAccountEntry {
  account: {
    id: string;
    displayName?: string;
    email: string;
  };
}

interface UndoNotificationProps {
  deletedAccounts: DeletedAccountEntry[];
  onUndo: (accountId: string) => Promise<void>;
  onDismiss: (accountId: string) => void;
}

export const UndoNotification: React.FC<UndoNotificationProps> = ({
  deletedAccounts,
  onUndo,
  onDismiss,
}) => {
  if (deletedAccounts.length === 0) return null;

  const lastDeleted = deletedAccounts[deletedAccounts.length - 1];
  const count = deletedAccounts.length;

  return (
    <div className="p-2">
      <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-center gap-3">
        <AlertCircle size={16} className="text-destructive flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-destructive truncate">
            {count === 1 ? 'Account deleted' : `${count} accounts deleted`}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {lastDeleted.account.displayName ?? lastDeleted.account.email}
            {count > 1 && ` and ${count - 1} more`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            onClick={() => void onUndo(lastDeleted.account.id)}
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs hover:bg-destructive/20"
          >
            <Undo2 size={12} className="mr-1" />
            Undo last
          </Button>
          <Button
            onClick={() => {
              // Dismiss all notifications
              deletedAccounts.forEach(entry => onDismiss(entry.account.id));
            }}
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 hover:bg-destructive/20"
          >
            <X size={12} />
          </Button>
        </div>
      </div>
    </div>
  );
};
