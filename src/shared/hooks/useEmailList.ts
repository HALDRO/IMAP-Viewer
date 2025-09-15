/**
 * @file Hook for managing email list operations and state
 */
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';

import { useAccountStore } from '../store/accounts/accountStore';
import type { EmailHeader } from '../types/email';

interface MailboxResult {
  emails?: EmailHeader[];
  totalCount?: number;
}

interface EmailFrom {
  text?: string;
}

interface UseEmailListProps {
  searchQuery?: string;
}

interface UseEmailListReturn {
  // State
  isLoading: boolean;
  isFetchingMore: boolean;
  error: string | null;
  hasLoadedOnce: boolean;
  selectedUids: number[];
  selectAll: boolean;
  isToolbarVisible: boolean;
  keyboardSelectedIndex: number;

  // Data
  emailHeaders: EmailHeader[];
  filteredEmails: EmailHeader[];
  hasMoreEmails: boolean;
  totalEmailCount: number;
  
  // Refs
  observer: React.MutableRefObject<IntersectionObserver | null>;
  lastEmailElementRef: React.MutableRefObject<HTMLDivElement | null>;
  
  // Handlers
  loadMoreEmails: () => Promise<void>;
  handleSelectEmail: (_uid: number, _event?: React.MouseEvent) => void;
  handleSelectAll: () => void;
  handleDeleteSelected: () => Promise<void>;
  setKeyboardSelectedIndex: (_index: number) => void;
  setSelectedUids: (_uids: number[] | ((_prev: number[]) => number[])) => void;
  setSelectAll: (_selectAll: boolean) => void;

  // Utils
  formatDate: (_dateString: string) => string;
  hasAttachments: (_email: EmailHeader) => boolean;
  isStarred: (_email: EmailHeader) => boolean;
}

const PAGE_SIZE = 100;

/**
 * Hook for managing email list functionality
 */
export const useEmailList = ({ searchQuery = '' }: UseEmailListProps): UseEmailListReturn => {
  const {
    selectedAccountId,
    selectedMailbox,
    emailHeadersByMailbox,
    setEmailHeadersForMailbox,
    appendEmailHeadersToMailbox,
    prependEmailHeaders,
    hasMoreEmailsByMailbox,
    setHasMoreEmailsForMailbox,
    setEmailCountForMailbox,
    removeEmailHeaders,
  } = useAccountStore();
  
  const mailboxKey = useMemo(() => {
    return (selectedAccountId?.length ?? 0) > 0 && (selectedMailbox?.length ?? 0) > 0
      ? `${selectedAccountId}-${selectedMailbox}`
      : null;
  }, [selectedAccountId, selectedMailbox]);

  const emailHeaders = useMemo(() => {
    const headers = mailboxKey !== null && mailboxKey !== undefined && mailboxKey.length > 0 ? emailHeadersByMailbox[mailboxKey] ?? [] : [];
    // eslint-disable-next-line no-console
    console.log(`🔍 DIAGNOSTIC: emailHeaders useMemo - mailboxKey: ${mailboxKey}, headers count: ${headers.length}, store keys: ${Object.keys(emailHeadersByMailbox).join(', ')}`);
    return headers;
  }, [mailboxKey, emailHeadersByMailbox]);

  const hasMoreEmails = useMemo(() => {
    return mailboxKey !== null && mailboxKey !== undefined && mailboxKey.length > 0 ? hasMoreEmailsByMailbox[mailboxKey] === true : false;
  }, [mailboxKey, hasMoreEmailsByMailbox]);

  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [totalEmailCount, setTotalEmailCount] = useState(0);
  
  const observer = useRef<IntersectionObserver | null>(null);
  const lastEmailElementRef = useRef<HTMLDivElement>(null);

  const [selectedUids, setSelectedUids] = useState<number[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [isToolbarVisible, setIsToolbarVisible] = useState(false);
  const [keyboardSelectedIndex, setKeyboardSelectedIndex] = useState(-1);

  // Use refs to track previous values and prevent unnecessary effect triggers
  const prevSelectedAccountIdRef = useRef<string | null>(null);
  const prevSelectedMailboxRef = useRef<string | null>(null);

  // Effect to handle selecting a mailbox
  useEffect(() => {
    if (selectedAccountId !== null && selectedAccountId !== undefined && selectedAccountId.length > 0 &&
        selectedMailbox !== null && selectedMailbox !== undefined && selectedMailbox.length > 0) {

      // Check if the selection actually changed
      const hasSelectionChanged =
        selectedAccountId !== prevSelectedAccountIdRef.current ||
        selectedMailbox !== prevSelectedMailboxRef.current;

      if (!hasSelectionChanged) {
        return; // Skip if selection hasn't changed
      }

      // Update refs
      prevSelectedAccountIdRef.current = selectedAccountId;
      prevSelectedMailboxRef.current = selectedMailbox;

      // Check if we already have data for this mailbox
      const currentKey = `${selectedAccountId}-${selectedMailbox}`;
      const existingHeaders = emailHeadersByMailbox[currentKey];

      // eslint-disable-next-line no-console
      console.log(`🔍 DIAGNOSTIC: useEffect triggered - mailbox: ${selectedMailbox}, existing headers: ${existingHeaders?.length ?? 0}`);

      // Only load if we don't have data yet
      if (!existingHeaders || existingHeaders.length === 0) {
        const loadMailboxContent = async (): Promise<void> => {
          // eslint-disable-next-line no-console
          console.log(`🔍 DIAGNOSTIC: Loading emails for ${selectedAccountId} - ${selectedMailbox}`);
          setIsLoading(true);
        setError(null);
        try {
          // eslint-disable-next-line no-console
          console.log(`🔍 DIAGNOSTIC: Calling window.ipcApi.selectMailbox with PAGE_SIZE=${PAGE_SIZE}`);
          const result = await window.ipcApi.selectMailbox(selectedAccountId, selectedMailbox, PAGE_SIZE);
          // eslint-disable-next-line no-console
          console.log(`🔍 DIAGNOSTIC: IPC result received:`, result);

          const resultObj = result as MailboxResult;
          const initialEmails = Array.isArray(result) ? result : (resultObj.emails ?? []);
          const totalCount = Array.isArray(result) ? initialEmails.length : (resultObj.totalCount ?? 0);

          // eslint-disable-next-line no-console
          console.log(`🔍 DIAGNOSTIC: Processed result - emails: ${initialEmails.length}, totalCount: ${totalCount}`);

          // Set emails even if empty to show that loading completed
          setEmailHeadersForMailbox(selectedAccountId, selectedMailbox, initialEmails);
          setHasMoreEmailsForMailbox(selectedAccountId, selectedMailbox, initialEmails.length === PAGE_SIZE);
          setEmailCountForMailbox(selectedAccountId, selectedMailbox, totalCount);
          setTotalEmailCount(totalCount);

          // eslint-disable-next-line no-console
          console.log(`🔍 DIAGNOSTIC: Store updated successfully`);

          // Immediate verification of stored data
          const currentMailboxKey = `${selectedAccountId}-${selectedMailbox}`;
          // eslint-disable-next-line no-console
          console.log(`🔍 DIAGNOSTIC: Immediate verification - mailboxKey: ${currentMailboxKey}, emails stored: ${initialEmails.length}`);

          // Clear any previous errors if successful
          setError(null);
        } catch (e: unknown) {
          // eslint-disable-next-line no-console
          console.error(`🔍 DIAGNOSTIC: ERROR loading emails for ${selectedAccountId} - ${selectedMailbox}:`, e);

          // Set empty state to show that loading completed (even with error)
          setEmailHeadersForMailbox(selectedAccountId, selectedMailbox, []);
          setHasMoreEmailsForMailbox(selectedAccountId, selectedMailbox, false);
          setEmailCountForMailbox(selectedAccountId, selectedMailbox, 0);
          setTotalEmailCount(0);

          // eslint-disable-next-line no-console
          console.log(`🔍 DIAGNOSTIC: Set empty state after error`);

          // Set user-friendly error message
          const errorMessage = e instanceof Error ? e.message : "Failed to load emails";
          if (errorMessage.includes('ECONNREFUSED')) {
            setError("Cannot connect to email server. Please check your account settings.");
          } else if (errorMessage.includes('Invalid credentials') || errorMessage.includes('AUTHENTICATIONFAILED')) {
            setError("Authentication failed. Please check your email and password.");
          } else {
            setError(errorMessage);
          }
        } finally {
          // eslint-disable-next-line no-console
          console.log(`Finished loading emails for ${selectedAccountId} - ${selectedMailbox}`);
          setIsLoading(false);
          setHasLoadedOnce(true);
        }
        };
        void loadMailboxContent();
      } else {
        // Data already exists, just update loading state
        setIsLoading(false);
        setHasLoadedOnce(true);
        setError(null);
        // eslint-disable-next-line no-console
        console.log(`🔍 DIAGNOSTIC: Using existing data for ${selectedAccountId} - ${selectedMailbox}, count: ${existingHeaders.length}`);
      }
    } else {
      // Reset refs when no selection
      prevSelectedAccountIdRef.current = null;
      prevSelectedMailboxRef.current = null;

      setIsLoading(false);
      setError(null);
      setHasLoadedOnce(false);
    }
  }, [selectedAccountId, selectedMailbox, setEmailHeadersForMailbox, setHasMoreEmailsForMailbox, setEmailCountForMailbox, emailHeadersByMailbox]);

  // Effect to listen for new mail events
  useEffect(() => {
    const cleanup = window.ipcApi.onNewMail((_, { accountId, mailboxName, newMailCount }) => {
      if (accountId === selectedAccountId && mailboxName === selectedMailbox) {
        void (async (): Promise<void> => {
          try {
            const newEmails = await window.ipcApi.getEmails(accountId, mailboxName, 0, newMailCount);
            if (newEmails.length > 0) {
              prependEmailHeaders(accountId, mailboxName, newEmails);
            }
          } catch (e) {
            // eslint-disable-next-line no-console
            console.error("Failed to fetch new emails:", e);
          }
        })();
      }
    });

    return cleanup;
  }, [selectedAccountId, selectedMailbox, prependEmailHeaders]);

  // Filter emails based on search query
  const filteredEmails = useMemo(() => {
    if (!searchQuery) return emailHeaders;

    const query = searchQuery.toLowerCase();
    return emailHeaders.filter((email: EmailHeader) =>
      email.subject?.toLowerCase().includes(query) ||
      (typeof email.from === 'string'
        ? (email.from as string).toLowerCase().includes(query)
        : (email.from as EmailFrom)?.text?.toLowerCase()?.includes(query))
    );
  }, [emailHeaders, searchQuery]);

  // Infinite scroll loader
  const loadMoreEmails = useCallback(async () => {
    if ((selectedAccountId?.length ?? 0) === 0 || (selectedMailbox?.length ?? 0) === 0 || hasMoreEmails === false || isFetchingMore === true ||
        selectedAccountId === null || selectedAccountId === undefined || selectedMailbox === null || selectedMailbox === undefined) {
      return;
    }

    setIsFetchingMore(true);
    try {
      const currentOffset = emailHeaders.length;
      const newEmails = await window.ipcApi.getEmails(selectedAccountId, selectedMailbox, currentOffset, PAGE_SIZE);

      appendEmailHeadersToMailbox(selectedAccountId, selectedMailbox, newEmails);

      if (newEmails.length < PAGE_SIZE) {
        setHasMoreEmailsForMailbox(selectedAccountId, selectedMailbox, false);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load more emails");
    } finally {
      setIsFetchingMore(false);
    }
  }, [selectedAccountId, selectedMailbox, hasMoreEmails, isFetchingMore, emailHeaders.length, appendEmailHeadersToMailbox, setHasMoreEmailsForMailbox]);

  // Reset selection when changing mailbox or account
  useEffect(() => {
    setSelectedUids([]);
    setSelectAll(false);
    setIsToolbarVisible(false);
    setKeyboardSelectedIndex(-1);
    setError(null);
    setHasLoadedOnce(emailHeaders.length > 0);
  }, [selectedAccountId, selectedMailbox, emailHeaders.length]);

  // Update toolbar visibility when selection changes
  useEffect(() => {
    setIsToolbarVisible(selectedUids.length > 0);
  }, [selectedUids]);

  const handleSelectEmail = useCallback((uid: number, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
    }

    setSelectedUids((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectAll) {
      setSelectedUids([]);
      setSelectAll(false);
    } else {
      setSelectedUids(filteredEmails.map((email) => email.uid));
      setSelectAll(true);
    }
  }, [selectAll, filteredEmails]);

  const handleDeleteSelected = useCallback(async () => {
    if ((selectedAccountId?.length ?? 0) === 0 || selectedUids.length === 0 || (selectedMailbox?.length ?? 0) === 0 ||
        selectedAccountId === null || selectedAccountId === undefined || selectedMailbox === null || selectedMailbox === undefined) return;

    try {
      await window.ipcApi.deleteEmails(selectedAccountId, selectedMailbox, selectedUids);
      removeEmailHeaders(selectedUids);
      setSelectedUids([]);
      setSelectAll(false);
    } catch (e: unknown) {
      // eslint-disable-next-line no-console
      console.error('Failed to delete selected emails:', e);
      setError(e instanceof Error ? e.message : 'Failed to delete selected emails');
    }
  }, [selectedAccountId, selectedUids, selectedMailbox, removeEmailHeaders]);

  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    const isThisYear = date.getFullYear() === now.getFullYear();
    if (isThisYear) {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
    
    return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
  }, []);
  
  const hasAttachments = useCallback((email: EmailHeader): boolean => {
    return (email.flags?.includes('\\HasAttachment') ?? false) ||
           (email.attributes?.hasAttachment === true) ||
           false;
  }, []);

  const isStarred = useCallback((email: EmailHeader): boolean => {
    return email.flags?.includes('\\Flagged') ?? false;
  }, []);

  return {
    isLoading,
    isFetchingMore,
    error,
    hasLoadedOnce,
    selectedUids,
    selectAll,
    isToolbarVisible,
    keyboardSelectedIndex,
    emailHeaders,
    filteredEmails,
    hasMoreEmails,
    totalEmailCount,
    observer,
    lastEmailElementRef,
    loadMoreEmails,
    handleSelectEmail,
    handleSelectAll,
    handleDeleteSelected,
    setKeyboardSelectedIndex,
    setSelectedUids,
    setSelectAll,
    formatDate,
    hasAttachments,
    isStarred,
  };
};
