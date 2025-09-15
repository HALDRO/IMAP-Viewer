/**
 * @file Component for notifying users about expired OAuth2 tokens
 */
import React from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';

import { useAccountStore } from '../shared/store/accounts/accountStore';
import { Button } from '../shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../shared/ui/card';

interface ExpiredTokenNotificationProps {
  accountId: string;
  accountEmail: string;
  onReauthenticate: (accountId: string) => void;
  onDismiss: (accountId: string) => void;
}

/**
 * Notification component for expired OAuth2 tokens
 */
export const ExpiredTokenNotification: React.FC<ExpiredTokenNotificationProps> = ({
  accountId,
  accountEmail,
  onReauthenticate,
  onDismiss,
}) => {
  const { clearExpiredToken } = useAccountStore();

  const handleReauthenticate = () => {
    onReauthenticate(accountId);
    clearExpiredToken(accountId);
  };

  const handleDismiss = () => {
    onDismiss(accountId);
    clearExpiredToken(accountId);
  };

  return (
    <Card className="border-destructive bg-destructive/5 mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <CardTitle className="text-sm font-medium text-destructive">
              Authentication Required
            </CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDismiss}
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription className="text-sm">
          The authentication token for <strong>{accountEmail}</strong> has expired.
          Please re-authenticate to continue accessing your emails.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex gap-2">
          <Button
            onClick={handleReauthenticate}
            size="sm"
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Re-authenticate
          </Button>
          <Button
            onClick={handleDismiss}
            variant="outline"
            size="sm"
          >
            Dismiss
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * Container component that shows notifications for all expired tokens
 */
export const ExpiredTokenNotifications: React.FC<{
  onReauthenticate: (accountId: string) => void;
}> = ({ onReauthenticate }) => {
  const { accounts, expiredTokenAccounts, clearExpiredToken } = useAccountStore();

  const expiredAccounts = accounts.filter(account => 
    expiredTokenAccounts.has(account.id)
  );

  if (expiredAccounts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {expiredAccounts.map(account => (
        <ExpiredTokenNotification
          key={account.id}
          accountId={account.id}
          accountEmail={account.email}
          onReauthenticate={onReauthenticate}
          onDismiss={clearExpiredToken}
        />
      ))}
    </div>
  );
};
