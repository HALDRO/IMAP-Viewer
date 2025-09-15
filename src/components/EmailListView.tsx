/**
 * @file Renders the list of emails with infinite scroll, search filtering, and modern design.
 */
import {
  Star, Paperclip, CheckCircle2, Trash2, MailX, Inbox
} from 'lucide-react';
import React from 'react';

import { useEmailList } from '../shared/hooks/useEmailList';
import { useKeyboardNavigation } from '../shared/hooks/useKeyboardNavigation';
import RelativeTime from './RelativeTime';
import { useAccountStore } from '../shared/store/accounts/accountStore';
import type { EmailHeader } from '../shared/types/email';
import { Button } from '../shared/ui/button';
import { CustomScrollbar } from '../shared/ui';

import EmailListSkeleton from './EmailListSkeleton';

interface EmailListViewProps {
  searchQuery?: string;
  showHeader?: boolean;
}

/**
 * Component to render a list of emails with selection, infinite scroll,
 * and bulk actions functionality
 */
const EmailListView: React.FC<EmailListViewProps> = ({ searchQuery = '' }) => {
  const {
    selectedAccountId,
    selectEmail,
    selectedEmailId,
  } = useAccountStore();

  const {
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
    lastEmailElementRef,
    handleSelectEmail,
    handleSelectAll,
    handleDeleteSelected,
    setKeyboardSelectedIndex,
    formatDate,
    hasAttachments,
    isStarred,
  } = useEmailList({ searchQuery });









  // Keyboard navigation
  useKeyboardNavigation({
    onArrowUp: () => {
      if (filteredEmails.length === 0) return;
      const newIndex = keyboardSelectedIndex > 0 ? keyboardSelectedIndex - 1 : filteredEmails.length - 1;
      setKeyboardSelectedIndex(newIndex);
    },
    onArrowDown: () => {
      if (filteredEmails.length === 0) return;
      const newIndex = keyboardSelectedIndex < filteredEmails.length - 1 ? keyboardSelectedIndex + 1 : 0;
      setKeyboardSelectedIndex(newIndex);
    },
    onEnter: () => {
      if (keyboardSelectedIndex >= 0 && keyboardSelectedIndex < filteredEmails.length) {
        selectEmail(filteredEmails[keyboardSelectedIndex].uid);
      }
    },
    onSpace: () => {
      if (keyboardSelectedIndex >= 0 && keyboardSelectedIndex < filteredEmails.length) {
        handleSelectEmail(filteredEmails[keyboardSelectedIndex].uid);
      }
    },
    onDelete: () => {
      if (selectedUids.length > 0) {
        void handleDeleteSelected();
      }
    },
    enabled: filteredEmails.length > 0
  });

  // Show message only when no account is selected
  if ((selectedAccountId?.length ?? 0) === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center bg-[#121212] text-white">
        <div className="bg-blue-900/20 p-6 rounded-xl border border-blue-800/30 max-w-sm backdrop-blur-lg">
          <div className="mx-auto mb-6 w-16 h-16 rounded-full flex items-center justify-center bg-blue-900/30">
            <Inbox size={28} className="text-blue-400" />
          </div>
          <h3 className="text-xl font-medium mb-3 text-blue-300">Select Account & Mailbox</h3>
          <p className="text-sm text-blue-300/80">
            Choose an account from the right panel to view emails.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) return <EmailListSkeleton />;

  if ((error?.length ?? 0) > 0 && emailHeaders.length === 0) return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center bg-[#121212] text-white">
      <div className="bg-red-900/20 p-6 rounded-xl border border-red-800/30 max-w-md backdrop-blur-lg">
        <div className="mx-auto mb-6 w-16 h-16 rounded-full flex items-center justify-center bg-red-900/30">
          <MailX size={28} className="text-red-400" />
        </div>
        <h3 className="text-xl font-medium mb-3 text-red-300">Connection Error</h3>
        <p className="text-sm text-red-300/80 mb-4">{error}</p>
        {error?.includes('Authentication failed') && (
          <div className="text-xs text-yellow-300/80 bg-yellow-900/20 p-3 rounded-lg border border-yellow-800/30">
            <p className="font-medium mb-1">Gmail users:</p>
            <p>Use App Password instead of regular password. Enable 2FA and generate an App Password in your Google Account settings.</p>
          </div>
        )}
        {error?.includes('Cannot connect') && (
          <div className="text-xs text-blue-300/80 bg-blue-900/20 p-3 rounded-lg border border-blue-800/30">
            <p className="font-medium mb-1">Connection issue:</p>
            <p>Check your internet connection and verify the IMAP server settings in account configuration.</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-[#121212] text-white">
      {/* Selection toolbar */}
      {isToolbarVisible && (
        <div
          className="flex items-center gap-3 px-4 py-2 sticky top-0 z-1 bg-gray-900/50 backdrop-blur-lg border-b border-gray-800/30 transition-all duration-300 ease-in-out"
          role="toolbar"
          aria-label="Email selection actions"
        >
        <div className="flex items-center h-6">
          <input
            type="checkbox"
            checked={selectAll}
            onChange={handleSelectAll}
            aria-label="Select all emails"
            className="w-4 h-4 rounded bg-transparent border border-gray-500 accent-blue-500 cursor-pointer focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <Button
          variant="destructive"
          onClick={() => { void handleDeleteSelected(); }}
          aria-label={`Delete ${selectedUids.length} selected emails`}
          className="rounded-full"
        >
          <Trash2 size={16} />
          Delete
        </Button>

        <span className="text-xs text-blue-400 ml-auto" aria-live="polite">
          {selectedUids.length} selected
        </span>
        </div>
      )}



      {filteredEmails.length === 0 && !isLoading && hasLoadedOnce && (
        <div className="flex flex-col items-center justify-center flex-grow p-6 text-center">
          <div className="max-w-xs">
            <div className="mx-auto mb-6 w-16 h-16 rounded-full flex items-center justify-center bg-gray-800/40">
              <CheckCircle2 size={28} className="text-gray-400" />
            </div>
            <h3 className="text-xl font-medium mb-3">No emails found</h3>
            <p className="text-sm text-gray-400">
              {searchQuery ? 'Try a different search query' : 'This folder is empty'}
            </p>
          </div>
        </div>
      )}
      
      <CustomScrollbar className="divide-y divide-gray-800/20 flex-grow" role="list" aria-label="Email list">
        {filteredEmails.map((email: EmailHeader, index: number) => {
          const isSelected = selectedUids.includes(email.uid);
          const isCurrent = selectedEmailId === email.uid;
          const isKeyboardSelected = keyboardSelectedIndex === index;
          const emailHasAttachments = hasAttachments(email);
          const emailIsStarred = isStarred(email);

          return (
            <div
              key={email.uid}
              ref={index === filteredEmails.length - 1 ? lastEmailElementRef : null}
              onClick={() => selectEmail(email.uid)}
              className={`px-4 py-2 cursor-pointer transition-all hover:bg-gray-800/30 flex items-center gap-3 border-b border-gray-800/20 ${
                isCurrent
                  ? 'bg-blue-900/30'
                  : 'bg-transparent'
              } ${isSelected ? 'bg-gray-800/40' : ''} ${isKeyboardSelected ? 'ring-2 ring-yellow-500' : ''}`}
              role="listitem"
              aria-selected={isCurrent}
              tabIndex={isKeyboardSelected ? 0 : -1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  selectEmail(email.uid);
                }
              }}
            >
              {/* Checkbox */}
              <div
                className="flex items-center justify-center w-5 h-5"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => handleSelectEmail(email.uid, e as unknown as React.MouseEvent)}
                  className="w-4 h-4 rounded bg-transparent border border-gray-500 accent-blue-500 cursor-pointer focus:ring-2 focus:ring-blue-500"
                  aria-label={`Select email from ${typeof email.from === 'string' ? email.from : email.from.text}`}
                />
              </div>

              {/* Star */}
              <div className="flex items-center justify-center w-5 h-5">
                {emailIsStarred && <Star size={16} className="text-yellow-400 fill-current" />}
              </div>

              {/* Main content area */}
              <div className="flex-1 min-w-0 pr-3">
                {/* First line: Sender with icon */}
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-blue-400 text-sm">👤</span>
                  <span className={`text-sm font-medium truncate ${!email.seen ? 'text-white' : 'text-gray-300'}`}>
                    {typeof email.from === 'string' ? email.from : email.from.text}
                  </span>
                </div>

                {/* Second line: Subject with icon */}
                <div className="flex items-center gap-2">
                  <span className="text-green-400 text-sm">📧</span>
                  <span className={`text-sm truncate ${!email.seen ? 'text-gray-200' : 'text-gray-400'}`}>
                    {email.subject || '(no subject)'}
                  </span>
                </div>
              </div>

              {/* Attachments and time */}
              <div className="flex items-center gap-2 flex-shrink-0 w-20">
                {emailHasAttachments && <Paperclip size={16} className="text-gray-400" />}

                <div className="flex flex-col items-end text-xs">
                  <span className={`${!email.seen ? 'text-gray-300' : 'text-gray-500'}`}>
                    {formatDate(email.date)}
                  </span>
                  <RelativeTime
                    dateString={email.date}
                    className={`text-xs mt-0.5 ${!email.seen ? 'text-blue-300' : 'text-gray-400'}`}
                    maxRelativeTime={24 * 60 * 60 * 1000} // Show relative time for 24 hours
                    showOnlyRelative={true}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </CustomScrollbar>

      {/* Loading indicator for infinite scroll */}
      {hasMoreEmails && !searchQuery && <div ref={lastEmailElementRef} className="h-1" />}
      {isFetchingMore && <EmailListSkeleton count={3} />}
    </div>
  );
};

export default EmailListView;