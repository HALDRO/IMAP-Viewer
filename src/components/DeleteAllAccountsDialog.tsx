/**
 * @file Confirmation dialog for deleting all accounts
 */
import { AlertTriangle } from 'lucide-react';
import React from 'react';

import { Button } from '../shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../shared/ui/dialog';

interface DeleteAllAccountsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  accountCount: number;
}

/**
 * Confirmation dialog for deleting all accounts
 */
export const DeleteAllAccountsDialog: React.FC<DeleteAllAccountsDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  accountCount,
}) => {
  const handleConfirm = (): void => {
    onConfirm();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <DialogTitle>Delete All Accounts</DialogTitle>
              <DialogDescription className="mt-1">
                This action cannot be undone. All account configurations will be permanently removed.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogDescription className="sr-only">
          Confirmation dialog for permanently deleting all {accountCount} email accounts and their configurations.
        </DialogDescription>

        <div className="py-4">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete all{' '}
            <span className="font-semibold text-foreground">
              {accountCount} {accountCount === 1 ? 'account' : 'accounts'}
            </span>
            ? This will permanently remove all account configurations, including:
          </p>
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
            <li>• Email server settings</li>
            <li>• Authentication credentials</li>
            <li>• Proxy configurations</li>
            <li>• All cached data</li>
          </ul>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm}>
            Delete All Accounts
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
