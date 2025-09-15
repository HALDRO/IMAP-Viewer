import DOMPurify from 'dompurify';
import {
  Trash2, Archive, Reply, Forward, Star, Download,
  MoreVertical, RefreshCw, AlertCircle, CheckCheck, ArrowLeft, Clock, FileText, Code
} from 'lucide-react';
import React, { useState } from 'react';

import { useEmailViewer } from '../shared/hooks/useEmailViewer';
import { useAccountStore } from '../shared/store/accounts/accountStore';
import { logger as appLogger } from '../shared/utils/logger';
import { Button } from '../shared/ui/button';
import { CustomScrollbar } from '../shared/ui/custom-scrollbar';
import EmailAttachments from './EmailAttachments';

import '../shared/styles/email-content.css';

// Safe HTML content component - uses DOMPurify to sanitize content before rendering
const SafeHtmlContent: React.FC<{ content: string }> = ({ content }): React.JSX.Element => {
  const sanitizedContent = DOMPurify.sanitize(content);
  // eslint-disable-next-line react/no-danger -- Content is sanitized with DOMPurify
  return <div dangerouslySetInnerHTML={{ __html: sanitizedContent }} />;
};

/**
 * Component for viewing the full content of an email
 * Provides actions for managing the email and displays the content safely
 */
const EmailViewer = (): React.JSX.Element => {
  const {
    selectedAccountId,
    selectedMailbox,
    accounts,
    selectedEmailId,
    currentEmail,
    selectEmail,
  } = useAccountStore();
  
  const currentAccount = accounts.find(a => a.id === selectedAccountId);

  const {
    isLoading,
    error,
    emailContent,
    isStarred,
    handleDelete,
    handleStar,
    formatDate,
  } = useEmailViewer();

  // State for view mode - default to HTML to show images and formatting
  const [viewMode, setViewMode] = useState<'html' | 'text'>('html');

  // Get content based on view mode
  const getEmailContent = (): string => {
    if (!emailContent) return '<div style="color: white; padding: 20px;"><p>No email content available</p></div>';

    if (viewMode === 'html') {
      // Try HTML first
      if (typeof emailContent.html === 'string' && emailContent.html.length > 0) {
        return DOMPurify.sanitize(emailContent.html, {
          KEEP_CONTENT: true,
          ALLOW_UNKNOWN_PROTOCOLS: true
        });
      }
      // Fallback to textAsHtml for HTML mode
      if (typeof emailContent.textAsHtml === 'string' && emailContent.textAsHtml.length > 0) {
        return emailContent.textAsHtml;
      }
    } else {
      // Text mode - prefer textAsHtml
      if (typeof emailContent.textAsHtml === 'string' && emailContent.textAsHtml.length > 0) {
        return emailContent.textAsHtml;
      }
      // Fallback to plain text with enhanced formatting
      if (typeof emailContent.text === 'string' && emailContent.text.length > 0) {
        const sanitizedText = DOMPurify.sanitize(emailContent.text);

        // Enhanced URL regex to catch more URL patterns
        const urlRegex = /((?:https?:\/\/|www\.)[^\s<>"']+[^\s<>"'.,;:!?])/gi;
        let processedText = sanitizedText.replace(urlRegex, (match) => {
          const url = match.startsWith('www.') ? `https://${match}` : match;
          return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #60a5fa; text-decoration: underline; font-weight: 500; transition: color 0.2s;" onmouseover="this.style.color='#93c5fd'" onmouseout="this.style.color='#60a5fa'">${match}</a>`;
        });

        // Enhanced email regex
        const emailRegex = /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g;
        processedText = processedText.replace(emailRegex, '<a href="mailto:$1" style="color: #60a5fa; text-decoration: underline; font-weight: 500; transition: color 0.2s;" onmouseover="this.style.color=\'#93c5fd\'" onmouseout="this.style.color=\'#60a5fa\'">$1</a>');

        // Convert phone numbers to clickable links
        const phoneRegex = /\b(\+?[\d\s\-\(\)]{10,})\b/g;
        processedText = processedText.replace(phoneRegex, '<a href="tel:$1" style="color: #60a5fa; text-decoration: underline; font-weight: 500;">$1</a>');

        // Highlight important text patterns
        processedText = processedText.replace(/\*\*([^*]+)\*\*/g, '<strong style="color: #fbbf24; font-weight: 600;">$1</strong>');
        processedText = processedText.replace(/\*([^*]+)\*/g, '<em style="color: #a78bfa; font-style: italic;">$1</em>');

        return `<div style="white-space: pre-wrap; word-wrap: break-word; font-family: inherit; line-height: 1.8; color: white; padding: 1rem; background: rgba(17, 24, 39, 0.3); border-radius: 8px; border: 1px solid rgba(75, 85, 99, 0.2);">${processedText}</div>`;
      }
    }

    return '<div style="color: white; padding: 20px;"><p>No content available for this mode</p></div>';
  };
  
  // Empty state when no email is selected
  if (selectedEmailId === null || selectedEmailId === undefined) {
    return (
      <div className="flex items-center justify-center h-full bg-[#121212] text-white">
        <div className="text-center max-w-xs mx-auto p-8">
          <div className="mx-auto mb-6 w-16 h-16 rounded-full flex items-center justify-center bg-gray-800/40 backdrop-blur-lg">
            <Clock size={32} className="text-gray-400" />
          </div>
          <h3 className="text-xl font-medium mb-3">No Email Selected</h3>
          <p className="text-sm text-gray-400">Select an email from the list to view its content</p>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-[#121212] text-white p-6">
        <div className="flex-shrink-0 animate-pulse">
          <div className="h-8 bg-gray-800/60 rounded-lg w-3/4 mb-4" />
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-12 h-12 rounded-full bg-gray-800/60" />
            <div className="space-y-2 flex-grow">
              <div className="h-4 bg-gray-800/60 rounded-full w-48" />
              <div className="h-3 bg-gray-800/60 rounded-full w-32" />
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-3 mb-6 bg-blue-900/20 text-blue-400 py-2.5 px-4 rounded-lg">
          <RefreshCw size={18} className="animate-spin" />
          <span className="text-sm">Loading message content...</span>
        </div>
        
        <div className="flex-grow animate-pulse space-y-4">
          <div className="h-4 bg-gray-800/60 rounded-full w-full" />
          <div className="h-4 bg-gray-800/60 rounded-full w-5/6" />
          <div className="h-4 bg-gray-800/60 rounded-full w-4/6" />
          <div className="h-20 bg-gray-800/40 rounded-lg w-full mt-6" />
        </div>
      </div>
    );
  }

  // Error state
  if ((error?.length ?? 0) > 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#121212] text-white p-6">
        <div className="bg-red-900/20 p-8 rounded-xl border border-red-800/30 max-w-md text-center backdrop-blur-lg">
          <div className="mx-auto mb-6 w-16 h-16 rounded-full flex items-center justify-center bg-red-900/30">
            <AlertCircle size={32} className="text-red-400" />
          </div>
          <h3 className="text-xl font-medium mb-3 text-red-300">Failed to Load Email</h3>
          <p className="text-sm text-red-300/80 mb-6">{error}</p>
          <button 
            onClick={() => selectEmail(selectedEmailId)}
            className="px-5 py-2.5 bg-red-900/30 hover:bg-red-900/50 text-red-200 rounded-full text-sm transition-colors flex items-center justify-center mx-auto gap-2"
          >
            <RefreshCw size={16} />
            Retry Loading
          </button>
        </div>
      </div>
    );
  }

  // Main email content view
  return (
    <div className="flex flex-col h-full bg-[#121212] text-white">
      {/* Email actions bar */}
      <div className="flex-shrink-0 flex items-center justify-between p-2.5 border-b border-gray-800/40 bg-gray-900/20 backdrop-blur-md">
        <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar px-2">
          <button
            onClick={() => selectEmail(null)}
            className="flex items-center justify-center p-2 rounded-full hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="Back to list"
            aria-label="Back to email list"
          >
            <ArrowLeft size={20} aria-hidden="true" />
          </button>

          <Button variant="outline" aria-label="Reply to email" className="rounded-full">
            <Reply size={16} />
            Reply
          </Button>
          <Button variant="outline" aria-label="Forward email" className="rounded-full">
            <Forward size={16} />
            Forward
          </Button>
          <Button variant="outline" aria-label="Archive email" className="rounded-full">
            <Archive size={16} />
            Archive
          </Button>
          <Button variant="destructive" onClick={() => { void handleDelete(); }} aria-label="Delete email" className="rounded-full">
            <Trash2 size={16} />
            Delete
          </Button>
        </div>
        
        <div className="flex items-center gap-2 pr-2">
          <button
            onClick={() => {
              appLogger.info('Mark as unread clicked (not implemented yet).');
            }}
            className="flex items-center justify-center p-2 rounded-full hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="Mark as unread"
            aria-label="Mark email as unread"
          >
            <CheckCheck size={18} className="text-blue-400" aria-hidden="true" />
          </button>

          <button
            onClick={() => { void handleStar(); }}
            className={`flex items-center justify-center p-2 rounded-full hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500 ${isStarred ? 'text-yellow-400' : 'text-gray-400 hover:text-yellow-400'}`}
            title={isStarred ? "Unstar" : "Star"}
            aria-label={isStarred ? "Remove star from email" : "Add star to email"}
            aria-pressed={isStarred}
          >
            <Star size={18} className={isStarred ? "fill-yellow-400" : ""} aria-hidden="true" />
          </button>

          <button
            onClick={() => {
              appLogger.info('Download clicked (not implemented yet).');
            }}
            className="flex items-center justify-center p-2 rounded-full hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="Download"
            aria-label="Download email"
          >
            <Download size={18} aria-hidden="true" />
          </button>

          <button
            onClick={() => {
              appLogger.info('More options clicked (not implemented yet).');
            }}
            className="flex items-center justify-center p-2 rounded-full hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="More options"
            aria-label="More email options"
            aria-haspopup="menu"
          >
            <MoreVertical size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Email header */}
      <div className="flex-shrink-0 px-4 py-3 bg-gray-900/5 border-b border-gray-800/20">
        <header className="space-y-3">
          {/* Subject line with controls */}
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold flex-grow min-w-0">
              <span className="line-clamp-1">{currentEmail?.subject ?? '(No Subject)'}</span>
            </h1>

            {/* Elegant segmented control for view modes */}
            <div className="flex items-center bg-gray-800/40 rounded-lg p-0.5 border border-gray-700/50">
              <button
                onClick={() => setViewMode('html')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-200 ${
                  viewMode === 'html'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
                title="Rich HTML view with images and formatting"
              >
                <Code size={12} />
                HTML
              </button>
              <button
                onClick={() => setViewMode('text')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-200 ${
                  viewMode === 'text'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
                title="Clean text view"
              >
                <FileText size={12} />
                Text
              </button>
            </div>

            <button
              onClick={() => { void handleStar(); }}
              className={`p-1.5 rounded-lg transition-colors ${isStarred ? 'text-yellow-400 hover:text-yellow-300' : 'text-gray-400 hover:text-yellow-400'}`}
              aria-label={isStarred ? "Remove star from email" : "Add star to email"}
              aria-pressed={isStarred}
            >
              <Star size={16} className={isStarred ? "fill-current" : ""} />
            </button>
          </div>

          {/* Sender info */}
          {currentEmail && (
            <div className="flex items-center gap-3">
              <div
                className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-medium text-sm text-white"
                aria-hidden="true"
              >
                {typeof currentEmail.from === 'object' && currentEmail.from?.text?.charAt(0).toUpperCase()}
                {typeof currentEmail.from === 'string' && (currentEmail.from as string).charAt(0).toUpperCase()}
              </div>
              <div className="flex-grow min-w-0">
                <div className="font-medium text-sm truncate">
                  {
                    typeof currentEmail.from === 'object'
                      ? currentEmail.from.text.split('<')[0].trim().replace(/^"|"$/g, '') || currentEmail.from.text
                      : currentEmail.from
                  }
                </div>
                <div className="text-xs text-gray-400 truncate">
                  {
                    typeof currentEmail.from === 'object' && (currentEmail.from.text?.length ?? 0) > 0 && currentEmail.from.text.includes('<')
                      ? `${currentEmail.from.text.match(/<(.+?)>/)?.[1] ?? ''}`
                      : ''
                  }
                </div>
              </div>
              <div className="flex-shrink-0 text-xs text-gray-400">
                <time dateTime={currentEmail.date}>{formatDate(currentEmail.date)}</time>
              </div>
            </div>
          )}
        </header>
      </div>

      {/* Email body */}
      <CustomScrollbar className="flex-grow">
        <div
          className="email-content max-w-none text-white h-full"
          role="document"
          aria-label="Email content"
          style={{
            // Base email content styles - use full available space
            lineHeight: '1.6',
            fontSize: '14px',
            fontFamily: 'inherit',
            color: 'white',
            minHeight: '100%',
            padding: '0',
            margin: '0',
          } as React.CSSProperties}
        >
          <SafeHtmlContent content={getEmailContent()} />

          {/* Show attachments if available */}
          {emailContent && typeof emailContent === 'object' && 'attachments' in emailContent &&
           Array.isArray(emailContent.attachments) && emailContent.attachments.length > 0 && (
            <EmailAttachments
              attachments={emailContent.attachments}
              accountId={currentAccount?.id || ''}
              mailboxName={selectedMailbox || ''}
              emailUid={currentEmail?.uid || 0}
            />
          )}
        </div>
      </CustomScrollbar>
    </div>
  );
};

export default EmailViewer;