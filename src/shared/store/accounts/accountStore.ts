/**
 * @file Focused Zustand store for account CRUD operations
 */
import { create } from 'zustand';

import type { Account, ProxyConfig } from '../../types/account';
import type { MailBoxes } from '../../types/electron';
import type { EmailHeader } from '../../types/email';

// Extended Email type for email body content
export interface Email extends EmailHeader {
  html?: string | false;
  text?: string;
  textAsHtml?: string;
  to?: {
    text: string;
  };
}

export interface AccountState {
  accounts: Account[];
  selectedAccountId: string | null;
  globalProxy: ProxyConfig | null;

  // OAuth2 token status tracking
  expiredTokenAccounts: Set<string>;

  // Simple coordination flag to prevent race conditions
  isAccountSwitching: boolean;

  // Compatibility fields for old store structure
  mailboxesByAccountId: Record<string, MailBoxes | null>;
  selectedMailbox: string | null;
  selectedEmailId: number | null;
  currentEmail: Email | null;
  emailHeadersByMailbox: Record<string, EmailHeader[]>;
  emailCountByMailbox: Record<string, number>;
  hasMoreEmailsByMailbox: Record<string, boolean>;

  // Last selected mailbox for each account to restore state when switching
  lastSelectedMailboxByAccount: Record<string, string | null>;

  // Account CRUD operations
  setAccounts: (accounts: Account[]) => void;
  addAccount: (account: Account) => void;
  addAccountToStore: (account: Account) => void; // Compatibility alias
  updateAccount: (accountId: string, updates: Partial<Account>) => void;
  updateAccountInStore: (accountId: string, updates: Partial<Account>) => void; // Compatibility alias
  deleteAccount: (accountId: string) => void;
  deleteAccountInStore: (accountId: string) => void; // Compatibility alias
  deleteAllAccounts: () => void;

  // Account selection
  selectAccount: (accountId: string | null) => void;
  finishAccountSwitch: () => void;

  // Proxy configuration
  setGlobalProxy: (proxy: ProxyConfig | null) => void;

  // OAuth2 token management
  markTokenExpired: (accountId: string) => void;
  clearExpiredToken: (accountId: string) => void;
  isTokenExpired: (accountId: string) => boolean;
  setGlobalProxyConfig: (proxy: ProxyConfig | null) => void; // Compatibility alias
  setAccountProxy: (accountId: string, proxy: ProxyConfig | null) => void;
  setAccountProxyConfig: (accountId: string, proxy: ProxyConfig | null) => void; // Compatibility alias

  // Compatibility methods for mailbox management
  setMailboxesForAccount: (accountId: string, mailboxes: MailBoxes | null) => void;
  selectMailbox: (mailboxName: string | null) => void;

  // Email selection
  selectEmail: (emailId: number | null) => void;
  setCurrentEmail: (email: Email | null) => void;

  // Compatibility methods for email management
  clearEmailHeadersForMailbox: (accountId: string, mailboxName: string) => void;
  setEmailHeadersForMailbox: (accountId: string, mailboxName: string, headers: EmailHeader[]) => void;
  appendEmailHeadersToMailbox: (accountId: string, mailboxName: string, headers: EmailHeader[]) => void;
  prependEmailHeaders: (accountId: string, mailboxName: string, headers: EmailHeader[]) => void;
  removeEmailHeaders: (uids: number[]) => void;
  setHasMoreEmailsForMailbox: (accountId: string, mailboxName: string, hasMore: boolean) => void;
  setEmailCountForMailbox: (accountId: string, mailboxName: string, count: number) => void;

  // Connection status management
  setAccountConnectionStatus: (accountId: string, status: 'connected' | 'connecting' | 'disconnected') => void;

  // Mailbox state restoration
  restoreLastSelectedMailbox: (accountId: string) => void;
}

export const useAccountStore = create<AccountState>((set) => ({
  accounts: [],
  selectedAccountId: null,
  globalProxy: null,
  expiredTokenAccounts: new Set<string>(),
  isAccountSwitching: false,

  // Compatibility fields
  mailboxesByAccountId: {},
  selectedMailbox: null,
  selectedEmailId: null,
  currentEmail: null,
  emailHeadersByMailbox: {},
  emailCountByMailbox: {},
  hasMoreEmailsByMailbox: {},
  lastSelectedMailboxByAccount: {},

  setAccounts: (accounts: Account[]): void => set({ accounts }),

  addAccount: (account: Account): void => set((state) => ({
    accounts: [...state.accounts, { ...account, connectionStatus: 'disconnected' as const }],
  })),

  updateAccount: (accountId: string, updates: Partial<Account>): void => set((state) => ({
    accounts: state.accounts.map(acc =>
      acc.id === accountId ? { ...acc, ...updates } : acc
    ),
  })),

  deleteAccount: (accountId: string): void => set((state) => ({
    accounts: state.accounts.filter((acc) => acc.id !== accountId),
    selectedAccountId: state.selectedAccountId === accountId ? null : state.selectedAccountId,
  })),

  deleteAllAccounts: (): void => set(() => ({
    accounts: [],
    selectedAccountId: null,
    selectedMailbox: null,
    selectedEmailId: null,
    currentEmail: null,
    mailboxesByAccountId: {},
    emailHeadersByMailbox: {},
    emailCountByMailbox: {},
    hasMoreEmailsByMailbox: {},
    lastSelectedMailboxByAccount: {},
    expiredTokenAccounts: new Set<string>(),
  })),

  selectAccount: (accountId: string | null): void => set((state) => {
    // Debug logging only in debug mode
    const debugMode = JSON.parse(localStorage.getItem('main-settings-storage') || '{}')?.state?.settings?.debugMode;
    if (debugMode) {
      // Send debug log through the logger system
      window.ipcApi.logMessage('info', `🔍 DIAGNOSTIC: selectAccount called with: ${accountId}, current: ${state.selectedAccountId}`);
    }

    // If selecting the same account, do nothing to preserve current state
    if (accountId === state.selectedAccountId) {
      if (debugMode) {
        window.ipcApi.logMessage('info', `🔍 DIAGNOSTIC: Same account selected, preserving current state`);
      }
      return {};
    }

    // Set switching flag to coordinate with other operations
    const updates: Partial<AccountState> = {
      selectedAccountId: accountId,
      selectedEmailId: null,
      currentEmail: null,
      isAccountSwitching: accountId !== state.selectedAccountId,
    };

    // Save the currently selected mailbox for the current account
    if (state.selectedAccountId && state.selectedMailbox) {
      updates.lastSelectedMailboxByAccount = {
        ...state.lastSelectedMailboxByAccount,
        [state.selectedAccountId]: state.selectedMailbox,
      };
    }

    // If switching to a new account, try to restore last selected mailbox or select default
    if (accountId && accountId !== state.selectedAccountId) {
      const lastMailbox = state.lastSelectedMailboxByAccount[accountId];
      const accountMailboxes = state.mailboxesByAccountId[accountId];

      if (debugMode) {
        window.ipcApi.logMessage('info', `🔍 DIAGNOSTIC: Account switch - lastMailbox: ${lastMailbox}, mailboxes available: ${accountMailboxes ? Object.keys(accountMailboxes).length : 0}`);
      }

      if (lastMailbox && accountMailboxes?.[lastMailbox]) {
        // Restore last selected mailbox
        updates.selectedMailbox = lastMailbox;
        if (debugMode) {
          window.ipcApi.logMessage('info', `🔍 DIAGNOSTIC: Restored last mailbox: ${lastMailbox}`);
        }
      } else if (accountMailboxes) {
        // Select default mailbox (INBOX first, then first available)
        const defaultMailbox = accountMailboxes['INBOX'] ? 'INBOX' : Object.keys(accountMailboxes)[0];
        updates.selectedMailbox = defaultMailbox || null;
        if (debugMode) {
          window.ipcApi.logMessage('info', `🔍 DIAGNOSTIC: Selected default mailbox: ${defaultMailbox}`);
        }
      } else {
        // No mailboxes loaded yet, clear selection
        updates.selectedMailbox = null;
        if (debugMode) {
          window.ipcApi.logMessage('info', `🔍 DIAGNOSTIC: No mailboxes available yet, will be loaded by useAccountInitializer`);
        }
      }
    } else {
      // Clearing account selection
      updates.selectedMailbox = null;
      if (debugMode) {
        window.ipcApi.logMessage('info', `🔍 DIAGNOSTIC: Clearing account selection`);
      }
    }

    return updates;
  }),

  setGlobalProxy: (proxy: ProxyConfig | null): void => set({
    globalProxy: proxy,
  }),

  setAccountProxy: (accountId: string, proxy: ProxyConfig | null): void => set((state) => ({
    accounts: state.accounts.map(acc =>
      acc.id === accountId ? { ...acc, proxy } : acc
    ),
  })),

  // Compatibility aliases for old method names
  addAccountToStore: (account: Account): void => set((state) => ({
    accounts: [...state.accounts, { ...account, connectionStatus: 'disconnected' as const }],
  })),

  updateAccountInStore: (accountId: string, updates: Partial<Account>): void => set((state) => ({
    accounts: state.accounts.map(acc =>
      acc.id === accountId ? { ...acc, ...updates } : acc
    ),
  })),

  deleteAccountInStore: (accountId: string): void => set((state) => ({
    accounts: state.accounts.filter((acc) => acc.id !== accountId),
    selectedAccountId: state.selectedAccountId === accountId ? null : state.selectedAccountId,
  })),

  setGlobalProxyConfig: (proxy: ProxyConfig | null): void => set({
    globalProxy: proxy,
  }),

  setAccountProxyConfig: (accountId: string, proxy: ProxyConfig | null): void => set((state) => ({
    accounts: state.accounts.map(acc =>
      acc.id === accountId ? { ...acc, proxy } : acc
    ),
  })),

  // Compatibility methods for mailbox management
  setMailboxesForAccount: (accountId: string, mailboxes: MailBoxes | null): void => set((state) => ({
    mailboxesByAccountId: {
      ...state.mailboxesByAccountId,
      [accountId]: mailboxes,
    },
  })),

  // Restore last selected mailbox for account
  restoreLastSelectedMailbox: (accountId: string): void => set((state) => {
    const lastMailbox = state.lastSelectedMailboxByAccount[accountId];
    if (lastMailbox && state.mailboxesByAccountId[accountId]?.[lastMailbox]) {
      return { selectedMailbox: lastMailbox };
    }
    return {};
  }),

  selectMailbox: (mailboxName: string | null): void => set({
    selectedMailbox: mailboxName,
  }),

  // Email selection
  selectEmail: (emailId: number | null): void => set({
    selectedEmailId: emailId,
  }),

  setCurrentEmail: (email: Email | null): void => set({
    currentEmail: email,
  }),

  // Compatibility methods for email management
  clearEmailHeadersForMailbox: (accountId: string, mailboxName: string): void => {
    const key = `${accountId}-${mailboxName}`;
    set((state) => {
      const newEmailHeaders = { ...state.emailHeadersByMailbox };
      delete newEmailHeaders[key];
      const newHasMore = { ...state.hasMoreEmailsByMailbox };
      delete newHasMore[key];
      return {
        emailHeadersByMailbox: newEmailHeaders,
        hasMoreEmailsByMailbox: newHasMore,
      };
    });
  },

  setEmailHeadersForMailbox: (accountId: string, mailboxName: string, headers: EmailHeader[]): void => {
    const key = `${accountId}-${mailboxName}`;
    // eslint-disable-next-line no-console
    console.log(`🔍 DIAGNOSTIC: setEmailHeadersForMailbox called - key: ${key}, headers count: ${headers.length}`);
    set((state) => {
      const newState = {
        emailHeadersByMailbox: {
          ...state.emailHeadersByMailbox,
          [key]: headers,
        },
      };
      // eslint-disable-next-line no-console
      console.log(`🔍 DIAGNOSTIC: Store state updated - new headers count for ${key}: ${newState.emailHeadersByMailbox[key]?.length ?? 0}`);
      return newState;
    });
  },

  appendEmailHeadersToMailbox: (accountId: string, mailboxName: string, headers: EmailHeader[]): void => {
    const key = `${accountId}-${mailboxName}`;
    set((state) => {
      const existingHeaders = state.emailHeadersByMailbox[key] ?? [];
      const existingUids = new Set(existingHeaders.map(h => h.uid));
      const uniqueNewHeaders = headers.filter(h => !existingUids.has(h.uid));
      return {
        emailHeadersByMailbox: {
          ...state.emailHeadersByMailbox,
          [key]: [...existingHeaders, ...uniqueNewHeaders],
        },
      };
    });
  },

  prependEmailHeaders: (accountId: string, mailboxName: string, headers: EmailHeader[]): void => {
    const key = `${accountId}-${mailboxName}`;
    set((state) => {
      const existingHeaders = state.emailHeadersByMailbox[key] ?? [];
      const existingUids = new Set(existingHeaders.map(h => h.uid));
      const uniqueNewHeaders = headers.filter(h => !existingUids.has(h.uid));
      return {
        emailHeadersByMailbox: {
          ...state.emailHeadersByMailbox,
          [key]: [...uniqueNewHeaders, ...existingHeaders],
        },
      };
    });
  },

  removeEmailHeaders: (uids: number[]): void => {
    set((state) => {
      const updatedEmailHeaders = { ...state.emailHeadersByMailbox };
      Object.keys(updatedEmailHeaders).forEach(key => {
        updatedEmailHeaders[key] = updatedEmailHeaders[key].filter(header => !uids.includes(header.uid));
      });
      return {
        emailHeadersByMailbox: updatedEmailHeaders,
      };
    });
  },

  setHasMoreEmailsForMailbox: (accountId: string, mailboxName: string, hasMore: boolean): void => {
    const key = `${accountId}-${mailboxName}`;
    set((state) => ({
      hasMoreEmailsByMailbox: {
        ...state.hasMoreEmailsByMailbox,
        [key]: hasMore,
      },
    }));
  },

  setEmailCountForMailbox: (accountId: string, mailboxName: string, count: number): void => {
    const key = `${accountId}-${mailboxName}`;
    set((state) => ({
      emailCountByMailbox: {
        ...state.emailCountByMailbox,
        [key]: count,
      },
    }));
  },

  // Connection status management
  setAccountConnectionStatus: (accountId: string, status: 'connected' | 'connecting' | 'disconnected'): void => set((state) => ({
    accounts: state.accounts.map(acc =>
      acc.id === accountId ? { ...acc, connectionStatus: status } : acc
    ),
  })),

  // OAuth2 token management
  markTokenExpired: (accountId: string): void => set((state) => ({
    expiredTokenAccounts: new Set([...state.expiredTokenAccounts, accountId]),
  })),

  clearExpiredToken: (accountId: string): void => set((state) => {
    const newExpiredTokens = new Set(state.expiredTokenAccounts);
    newExpiredTokens.delete(accountId);
    return { expiredTokenAccounts: newExpiredTokens };
  }),

  isTokenExpired: (accountId: string): boolean => {
    const state = useAccountStore.getState();
    return state.expiredTokenAccounts.has(accountId);
  },

  finishAccountSwitch: (): void => set(() => ({
    isAccountSwitching: false,
  })),
}));
