/**
 * @file Panel that contains the list of mailboxes.
 */
import {
  ChevronDown,
  RefreshCw, Loader2, Mailbox, Inbox, Archive, Send, Trash2, Folder
} from 'lucide-react';
import React, { useState, useMemo } from 'react';

import { useAccountInitializer } from '../shared/hooks/useAccountInitializer';
import { useAccountStore } from '../shared/store/accounts/accountStore';
import { Button } from '../shared/ui/button';
import { CustomScrollbar } from '../shared/ui/custom-scrollbar';
import type { MailBoxes } from '../shared/types/electron';

interface EmailListPanelProps {
  searchQuery?: string;
}

/**
 * Component for displaying and managing email folders
 */
const EmailListPanel: React.FC<EmailListPanelProps> = React.memo(({ searchQuery = '' }) => {
  const {
    selectedAccountId,
    selectedMailbox,
    selectMailbox,
    emailCountByMailbox,
    emailHeadersByMailbox,
    clearEmailHeadersForMailbox,
  } = useAccountStore();

  const {
    isInitializing,
    initializationError,
    mailboxes,
    initializeAccount,
  } = useAccountInitializer();

  // Local state for UI
  const [showFolders, setShowFolders] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Helper function to get icon for mailbox
  const getMailboxIcon = (mailboxName: string, attribs: string[] = []) => {
    const name = mailboxName.toLowerCase();
    const attributes = attribs.map(attr => attr.toLowerCase());

    if (attributes.includes('\\inbox') || name === 'inbox') return Inbox;
    if (attributes.includes('\\sent') || name.includes('sent')) return Send;
    if (attributes.includes('\\trash') || name.includes('trash') || name.includes('deleted')) return Trash2;
    if (attributes.includes('\\archive') || name.includes('archive')) return Archive;
    return Folder;
  };

  // Convert mailboxes to flat list for rendering
  const renderedFolders = useMemo(() => {
    if (!mailboxes) return [];

    const flattenMailboxes = (boxes: MailBoxes, prefix = ''): Array<{
      name: string;
      label: string;
      icon: typeof Folder;
      attribs: string[];
      count?: number;
    }> => {
      const result: Array<{
        name: string;
        label: string;
        icon: typeof Folder;
        attribs: string[];
        count?: number;
      }> = [];

      Object.entries(boxes).forEach(([name, box]) => {
        const boxWithAttribs = box as { delimiter?: string; attribs: string[]; children?: MailBoxes };
        const fullName = prefix ? `${prefix}${boxWithAttribs.delimiter}${name}` : name;
        const Icon = getMailboxIcon(name, boxWithAttribs.attribs);

        // Get email count from store
        const countKey = selectedAccountId ? `${selectedAccountId}-${fullName}` : null;
        const count = countKey ? emailCountByMailbox[countKey] : undefined;

        result.push({
          name: fullName,
          label: name,
          icon: Icon,
          attribs: boxWithAttribs.attribs || [],
          count,
        });

        if (boxWithAttribs.children && Object.keys(boxWithAttribs.children).length > 0) {
          result.push(...flattenMailboxes(boxWithAttribs.children, fullName));
        }
      });

      return result;
    };

    return flattenMailboxes(mailboxes);
  }, [mailboxes, emailCountByMailbox, selectedAccountId]);

  // Handle refresh - refreshes both folders and all emails
  const handleRefresh = async () => {
    if (!selectedAccountId || isRefreshing) return;

    setIsRefreshing(true);
    try {
      // Clear all cached emails for this account
      Object.keys(emailHeadersByMailbox).forEach(key => {
        if (key.startsWith(`${selectedAccountId}-`)) {
          const mailboxName = key.substring(`${selectedAccountId}-`.length);
          clearEmailHeadersForMailbox(selectedAccountId, mailboxName);
        }
      });

      // Refresh account (folders and mailboxes)
      await initializeAccount(selectedAccountId, true);

      // Force reload of currently selected mailbox if any
      if (selectedMailbox) {
        // Trigger a re-selection to force email reload
        const currentMailbox = selectedMailbox;
        selectMailbox(''); // Clear selection temporarily
        setTimeout(() => {
          selectMailbox(currentMailbox); // Re-select to trigger reload
        }, 100);
      }
    } finally {
      setIsRefreshing(false);
    }
  };



  if (isInitializing) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-6 bg-background text-foreground">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-16 h-16 rounded-full flex items-center justify-center bg-muted">
            <Loader2 size={28} className="text-primary animate-spin" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-medium mb-2">Initializing Account</h3>
            <p className="text-sm text-muted-foreground">Loading folders and emails...</p>
          </div>
        </div>
      </div>
    );
  }

  if (initializationError) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-6 bg-background text-foreground">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-16 h-16 rounded-full flex items-center justify-center bg-destructive/10">
            <Mailbox size={28} className="text-destructive" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-medium mb-2">Failed to Load Account</h3>
            <p className="text-sm text-muted-foreground">{initializationError}</p>
            <Button
              onClick={() => selectedAccountId && initializeAccount(selectedAccountId, true)}
              className="mt-4"
              variant="outline"
            >
              <RefreshCw size={16} className="mr-2" />
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if ((selectedAccountId?.length ?? 0) === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-6 bg-background text-foreground">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-16 h-16 rounded-full flex items-center justify-center bg-muted">
            <Mailbox size={28} className="text-muted-foreground" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-medium mb-2">No Account Selected</h3>
            <p className="text-sm text-gray-400">Select an account to view your emails</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <nav className="flex flex-col h-full bg-background text-foreground" aria-label="Email folders">
      {/* Folders section */}
      <CustomScrollbar className="p-3 flex-grow">
        <div className="flex items-center justify-between pb-2 mb-1">
          <button
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
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Folders</h3>
          </button>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { void handleRefresh(); }}
              title="Refresh folders"
              aria-label="Refresh folder list"
              disabled={isRefreshing}
              className="rounded-full h-8 w-8"
            >
              <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
            </Button>
          </div>
        </div>

        {showFolders && (
          <>
            {renderedFolders.length === 0 && !isInitializing ? (
              <div className="text-center py-8">
                <div className="text-muted-foreground text-sm">
                  <p className="mb-2">No folders available</p>
                  <p className="text-xs">Check your connection settings</p>
                </div>
              </div>
            ) : (
              <ul id="folders-list" className="space-y-0.5 pl-2" role="list">
                {renderedFolders
                  .filter(mailbox => mailbox.label.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((mailbox) => {
                  const Icon = mailbox.icon;
                  const isSelected = selectedMailbox === mailbox.name;

                  return (
                    <li key={mailbox.name} role="none">
                      <button
                        onClick={() => selectMailbox(mailbox.name)}
                        className={`
                          w-full flex items-center gap-3 px-3 py-2 rounded-full transition-all text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring
                          ${isSelected
                            ? 'bg-primary/20 text-primary-foreground'
                            : 'hover:bg-muted text-muted-foreground hover:text-foreground'}
                        `}
                        aria-current={isSelected ? 'page' : undefined}
                        aria-label={`Select ${mailbox.label} folder`}
                      >
                        <Icon size={18} className={isSelected ? 'text-primary' : 'text-muted-foreground'} aria-hidden="true" />
                        <span className="truncate">{mailbox.label}</span>
                        {typeof mailbox.count === 'number' && mailbox.count > 0 && (
                          <span className="ml-auto text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full min-w-[1.5rem] text-center">
                            {mailbox.count}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </CustomScrollbar>
    </nav>
  );
});

export default EmailListPanel;