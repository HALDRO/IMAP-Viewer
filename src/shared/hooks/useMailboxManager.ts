/**
 * @file Hook for managing mailbox functionality
 */
import {
  Inbox, Trash, Archive, Bookmark, Send,
  AlertCircle, Folder
} from 'lucide-react';
import { useState, useEffect, useCallback, useMemo } from 'react';

import { useAccountStore } from '../store/accounts/accountStore';
import type { MailBoxes } from '../types/electron';

interface MailboxAttributes {
  attribs?: string[] | Record<string, unknown>;
  delimiter: string;
  children?: MailBoxes;
}

// UI representation of a folder
interface IFolder {
  name: string; // The actual name used for IMAP commands
  label: string; // The display name in the UI
  icon: React.ElementType;
  count?: number; // Number of emails in this folder
}

// Mapping from IMAP folder attributes to UI elements
const folderAttributeMap: Record<string, { icon: React.ElementType; label: string }> = {
  '\\Inbox': { icon: Inbox, label: 'Inbox' },
  '\\Sent': { icon: Send, label: 'Sent' },
  '\\Junk': { icon: AlertCircle, label: 'Spam' },
  '\\Trash': { icon: Trash, label: 'Trash' },
  '\\Drafts': { icon: Bookmark, label: 'Drafts' },
  '\\Archive': { icon: Archive, label: 'Archive' },
  '\\All': { icon: Archive, label: 'All Mail' },
};

/**
 * Finds the best default mailbox to open
 * Priority: All Mail > INBOX > first available mailbox
 */
function findDefaultMailbox(mailboxes: MailBoxes): string {
  const allMailboxNames: string[] = [];

  // Recursively collect all mailbox names
  function collectNames(boxes: MailBoxes, prefix = ''): void {
    Object.keys(boxes).forEach(name => {
      const box = boxes[name];
      const fullName = prefix ? `${prefix}${(box as { delimiter?: string }).delimiter ?? '/'}${name}` : name;

      // Only add selectable mailboxes (not containers)
      const boxWithAttribs = box as MailboxAttributes;
      const rawAttribs = boxWithAttribs.attribs;
      const attribs: string[] = Array.isArray(rawAttribs) ? rawAttribs : (rawAttribs !== null && rawAttribs !== undefined ? Object.keys(rawAttribs) : []);

      if (!attribs.includes('\\Noselect')) {
        allMailboxNames.push(fullName);
      }

      if (box.children !== undefined) {
        collectNames(box.children, fullName);
      }
    });
  }

  collectNames(mailboxes);

  // Look for "All Mail" variations (Gmail, Outlook, etc.)
  const allMailVariations = [
    '[Gmail]/All Mail',
    '[Google Mail]/All Mail',
    'All Mail',
    'All',
    'Archive',
    'Все письма', // Russian
    'Tous les messages', // French
    'Alle Nachrichten', // German
  ];

  for (const variation of allMailVariations) {
    const found = allMailboxNames.find(name =>
      name.toLowerCase().includes(variation.toLowerCase()) ||
      name === variation
    );
    if (found !== null && found !== undefined && found.length > 0) {
      // eslint-disable-next-line no-console
      console.log(`Found All Mail folder: ${found}`);
      return found;
    }
  }

  // Look for INBOX
  const inbox = allMailboxNames.find(name =>
    name.toUpperCase() === 'INBOX' ||
    name.toLowerCase() === 'inbox'
  );
  if (inbox !== null && inbox !== undefined && inbox.length > 0) {
    // eslint-disable-next-line no-console
    console.log(`Using INBOX: ${inbox}`);
    return inbox;
  }

  // Fallback to first available mailbox
  const fallback = allMailboxNames[0] || 'INBOX';
  // eslint-disable-next-line no-console
  console.log(`Using fallback mailbox: ${fallback}`);
  return fallback;
}

interface UseMailboxManagerReturn {
  // State
  isLoading: boolean;
  isRefreshing: boolean;
  showFolders: boolean;
  setShowFolders: (_show: boolean) => void;
  
  // Data
  mailboxes: MailBoxes | null;
  renderedFolders: IFolder[];
  
  // Actions
  handleRefresh: () => Promise<void>;
}

/**
 * Hook for managing mailbox functionality
 */
export const useMailboxManager = (): UseMailboxManagerReturn => {
  const {
    selectedAccountId,
    mailboxesByAccountId,
    setMailboxesForAccount,
    selectedMailbox,
    selectMailbox,
    clearEmailHeadersForMailbox,
    emailCountByMailbox,
  } = useAccountStore();

  const mailboxes = selectedAccountId !== null && selectedAccountId !== undefined && selectedAccountId.length > 0 ? mailboxesByAccountId[selectedAccountId] : null;

  const [showFolders, setShowFolders] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load mailboxes when account changes - only ensure default mailbox selection
  useEffect(() => {
    if (selectedAccountId === null || selectedAccountId === undefined || selectedAccountId.length === 0) {
      return;
    }

    const cachedMailboxes = mailboxesByAccountId[selectedAccountId];
    if (cachedMailboxes !== null && cachedMailboxes !== undefined) {
      // Mailboxes are already in cache, ensure default mailbox is selected if none is selected
      if (selectedMailbox === null || selectedMailbox === undefined || selectedMailbox.length === 0) {
        const defaultMailbox = findDefaultMailbox(cachedMailboxes);
        selectMailbox(defaultMailbox);
      }
    }
    // NOTE: We don't fetch mailboxes here anymore - useAccountInitializer handles that
  }, [selectedAccountId, mailboxesByAccountId, selectMailbox, selectedMailbox]);

  // Process mailboxes into rendered folders
  const renderedFolders = useMemo((): IFolder[] => {
    if (mailboxes === null || mailboxes === undefined) return [];

    const processed = new Map<string, IFolder>();

    // Use a recursive function to process all mailboxes including children
    function processBoxes(boxes: MailBoxes, prefix = ''): void {
        Object.keys(boxes).forEach(name => {
            const box = boxes[name];
            const fullName = prefix ? `${prefix}${(box as { delimiter?: string }).delimiter ?? '/'}${name}` : name;

            // Skip if already processed
            if (processed.has(fullName)) return;

            const boxWithAttribs = box as MailboxAttributes;
            const rawAttribs = boxWithAttribs.attribs;
            const attribs: string[] = Array.isArray(rawAttribs) ? rawAttribs : (rawAttribs !== null && rawAttribs !== undefined ? Object.keys(rawAttribs) : []);

            let folderData: IFolder | null = null;

            // Check for special use attributes
            const specialAttr = attribs.find(attr => folderAttributeMap[attr]);
            if (specialAttr !== null && specialAttr !== undefined && specialAttr.length > 0) {
                folderData = { name: fullName, ...folderAttributeMap[specialAttr] };
            } else if (name.toUpperCase() === 'INBOX') {
                folderData = { name: fullName, ...folderAttributeMap['\\Inbox'] };
            } else {
                // Generic folder for anything else that is not a container of other folders
                if (!attribs.includes('\\Noselect')) {
                   folderData = { name: fullName, label: name, icon: Folder };
                }
            }

            if (folderData) {
                // Add email count if available
                const countKey = selectedAccountId !== null && selectedAccountId !== undefined && selectedAccountId.length > 0 ? `${selectedAccountId}-${fullName}` : null;
                const count = countKey !== null && countKey !== undefined && countKey.length > 0 ? emailCountByMailbox[countKey] : undefined;
                folderData.count = count;
                processed.set(folderData.name, folderData);
            }

            if (box.children !== undefined) {
                processBoxes(box.children, fullName);
            }
        });
    }

    processBoxes(mailboxes);

    const folderList = Array.from(processed.values());

    // Sort to have special folders first and in a specific order
    const specialOrder = ['Inbox', 'Sent', 'Drafts', 'Spam', 'Trash', 'Archive'];
    folderList.sort((a, b) => {
        const aIndex = specialOrder.indexOf(a.label);
        const bIndex = specialOrder.indexOf(b.label);

        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        return a.label.localeCompare(b.label); // Sort other folders alphabetically
    });

    return folderList;
  }, [mailboxes, emailCountByMailbox, selectedAccountId]);

  const handleRefresh = useCallback(async () => {
    if ((selectedAccountId?.length ?? 0) === 0 || isRefreshing === true ||
        selectedAccountId === null || selectedAccountId === undefined) return;

    setIsRefreshing(true);
    try {
      // Use the unified initialize-account handler for coordinated refresh
      const result = await window.ipcApi.initializeAccount(selectedAccountId, 50);
      setMailboxesForAccount(selectedAccountId, result.mailboxes);

      // If a mailbox is selected, clear its emails to trigger a refresh
      if (selectedMailbox !== null && selectedMailbox !== undefined && selectedMailbox.length > 0) {
        clearEmailHeadersForMailbox(selectedAccountId, selectedMailbox);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error refreshing mailboxes:', error);
      // Could add toast notification here if needed
    } finally {
      setIsRefreshing(false);
    }
  }, [selectedAccountId, isRefreshing, setMailboxesForAccount, selectedMailbox, clearEmailHeadersForMailbox]);

  return {
    isLoading,
    isRefreshing,
    showFolders,
    setShowFolders,
    mailboxes,
    renderedFolders,
    handleRefresh,
  };
};
