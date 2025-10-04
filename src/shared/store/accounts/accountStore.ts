/**
 * @file Centralized account state management with enhanced connection status tracking
 * @description Zustand store managing email accounts, authentication, and IMAP connections.
 * Features robust reconnection logic, automatic connection status updates, and complete
 * state cleanup for fresh initialization. Handles OAuth2 token expiration and coordinates
 * mailbox/email data across components. Connection status properly synchronized between
 * regular account selection and forced re-authentication through avatar button.
 */
import { create } from 'zustand'

import type { Account, ProxyConfig } from '../../types/account'
import type { MailBoxes } from '../../types/electron'
import type { EmailHeader } from '../../types/email'

// Extended Email type for email body content
export interface Email extends EmailHeader {
  html?: string | false
  text?: string
  textAsHtml?: string
  to?: {
    text: string
  }
}

export interface AccountState {
  accounts: Account[]
  selectedAccountId: string | null
  globalProxy: ProxyConfig | null

  // OAuth2 token status tracking
  expiredTokenAccounts: Set<string>

  // Simple coordination flag to prevent race conditions
  isAccountSwitching: boolean

  // Compatibility fields for old store structure
  mailboxesByAccountId: Record<string, MailBoxes | null>
  selectedMailbox: string | null
  selectedEmailId: number | null
  currentEmail: Email | null
  emailHeadersByMailbox: Record<string, EmailHeader[]>
  emailCountByMailbox: Record<string, number>
  hasMoreEmailsByMailbox: Record<string, boolean>
  currentPageByMailbox: Record<string, number>

  // Last selected mailbox for each account to restore state when switching
  lastSelectedMailboxByAccount: Record<string, string | null>

  // Last selected email for each account to restore state when switching
  lastSelectedEmailByAccount: Record<string, number | null>

  // Account CRUD operations
  setAccounts: (accounts: Account[]) => void
  addAccount: (account: Account) => void
  updateAccount: (accountId: string, updates: Partial<Account>) => void
  deleteAccount: (accountId: string) => void
  deleteAllAccounts: () => void

  // Account selection
  selectAccount: (accountId: string | null, force?: boolean) => void
  reconnectAccount: (accountId: string) => void
  finishAccountSwitch: () => void

  // Proxy configuration
  setGlobalProxy: (proxy: ProxyConfig | null) => void
  setAccountProxy: (accountId: string, proxy: ProxyConfig | null) => void

  // OAuth2 token management
  markTokenExpired: (accountId: string) => void
  clearExpiredToken: (accountId: string) => void
  isTokenExpired: (accountId: string) => boolean

  // Compatibility methods for mailbox management
  setMailboxesForAccount: (accountId: string, mailboxes: MailBoxes | null) => void
  selectMailbox: (mailboxName: string | null) => void

  // Email selection
  selectEmail: (emailId: number | null) => void
  setCurrentEmail: (email: Email | null) => void

  // Compatibility methods for email management
  clearEmailHeadersForMailbox: (accountId: string, mailboxName: string) => void
  setEmailHeadersForMailbox: (
    accountId: string,
    mailboxName: string,
    headers: EmailHeader[]
  ) => void
  appendEmailHeadersToMailbox: (
    accountId: string,
    mailboxName: string,
    headers: EmailHeader[]
  ) => void
  prependEmailHeaders: (accountId: string, mailboxName: string, headers: EmailHeader[]) => void
  removeEmailHeaders: (uids: number[]) => void
  setHasMoreEmailsForMailbox: (accountId: string, mailboxName: string, hasMore: boolean) => void
  setEmailCountForMailbox: (accountId: string, mailboxName: string, count: number) => void
  setCurrentPageForMailbox: (accountId: string, mailboxName: string, page: number) => void

  // Connection status management
  setAccountConnectionStatus: (
    accountId: string,
    status: 'connected' | 'connecting' | 'disconnected'
  ) => void

  // Mailbox state restoration
  restoreLastSelectedMailbox: (accountId: string) => void
}

export const useAccountStore = create<AccountState>(set => ({
  // --- STATE ---
  accounts: [],
  selectedAccountId: null,
  globalProxy: null,
  expiredTokenAccounts: new Set<string>(),
  isAccountSwitching: false,
  mailboxesByAccountId: {},
  selectedMailbox: null,
  selectedEmailId: null,
  currentEmail: null,
  emailHeadersByMailbox: {},
  emailCountByMailbox: {},
  hasMoreEmailsByMailbox: {},
  currentPageByMailbox: {},
  lastSelectedMailboxByAccount: {},
  lastSelectedEmailByAccount: {},

  // --- ACTIONS ---

  // Account Slice
  setAccounts: (accounts: Account[]): void => set({ accounts }),
  addAccount: (account: Account): void =>
    set(state => ({
      accounts: [...state.accounts, { ...account, connectionStatus: 'disconnected' as const }],
    })),
  updateAccount: (accountId: string, updates: Partial<Account>): void =>
    set(state => ({
      accounts: state.accounts.map(acc => (acc.id === accountId ? { ...acc, ...updates } : acc)),
    })),
  deleteAccount: (accountId: string): void =>
    set(state => ({
      accounts: state.accounts.filter(acc => acc.id !== accountId),
      selectedAccountId: state.selectedAccountId === accountId ? null : state.selectedAccountId,
    })),
  deleteAllAccounts: (): void =>
    set(() => ({
      accounts: [],
      selectedAccountId: null,
      selectedMailbox: null,
      selectedEmailId: null,
      currentEmail: null,
      mailboxesByAccountId: {},
      emailHeadersByMailbox: {},
      emailCountByMailbox: {},
      hasMoreEmailsByMailbox: {},
      currentPageByMailbox: {},
      lastSelectedMailboxByAccount: {},
      lastSelectedEmailByAccount: {},
      expiredTokenAccounts: new Set<string>(),
    })),
  setAccountConnectionStatus: (
    accountId: string,
    status: 'connected' | 'connecting' | 'disconnected'
  ): void =>
    set(state => ({
      accounts: state.accounts.map(acc =>
        acc.id === accountId ? { ...acc, connectionStatus: status } : acc
      ),
    })),

  // Session/UI Slice
  selectAccount: (accountId: string | null, force = false): void =>
    set(state => {
      if (accountId === state.selectedAccountId && !force) return {}

      // Only trigger switch logic if account actually changes
      const isActuallySwitching = accountId !== state.selectedAccountId

      const updates: Partial<AccountState> = {
        selectedAccountId: accountId,
        selectedEmailId: null,
        currentEmail: null,
        isAccountSwitching: isActuallySwitching,
      }

      // Save current account's state before switching
      if (state.selectedAccountId) {
        updates.lastSelectedMailboxByAccount = {
          ...state.lastSelectedMailboxByAccount,
          [state.selectedAccountId]: state.selectedMailbox,
        }
        updates.lastSelectedEmailByAccount = {
          ...state.lastSelectedEmailByAccount,
          [state.selectedAccountId]: state.selectedEmailId,
        }
      }

      if (accountId) {
        // Restore last selected mailbox and email for this account
        const lastMailbox = state.lastSelectedMailboxByAccount[accountId]
        const lastEmail = state.lastSelectedEmailByAccount[accountId]

        updates.selectedMailbox = lastMailbox || 'INBOX'
        updates.selectedEmailId = lastEmail ?? null

        // Set connection status to 'connecting' when starting to switch to account
        // This ensures the UI shows the connecting state immediately
        const accountIndex = state.accounts.findIndex(acc => acc.id === accountId)
        if (accountIndex !== -1) {
          const updatedAccounts = [...state.accounts]
          updatedAccounts[accountIndex] = {
            ...updatedAccounts[accountIndex],
            connectionStatus: 'connecting',
          }
          updates.accounts = updatedAccounts
        }
      } else {
        updates.selectedMailbox = null
      }
      return updates
    }),
  reconnectAccount: (accountId: string): void => {
    const state = useAccountStore.getState()

    // Validate that the account exists
    const account = state.accounts.find(acc => acc.id === accountId)
    if (!account) {
      console.error(`Cannot reconnect: Account with id ${accountId} not found in store`)
      return
    }

    // Clear all account-related state for a clean reconnection
    const cleanState: Partial<AccountState> = {
      selectedMailbox: null,
      selectedEmailId: null,
      currentEmail: null,
      // Clear mailbox and email data for this account
      mailboxesByAccountId: {
        ...state.mailboxesByAccountId,
        [accountId]: null,
      },
      // Clear email headers for all mailboxes of this account
      emailHeadersByMailbox: Object.fromEntries(
        Object.entries(state.emailHeadersByMailbox).filter(
          ([key]) => !key.startsWith(`${accountId}-`)
        )
      ),
      // Clear email counts for all mailboxes of this account
      emailCountByMailbox: Object.fromEntries(
        Object.entries(state.emailCountByMailbox).filter(
          ([key]) => !key.startsWith(`${accountId}-`)
        )
      ),
      // Clear hasMore flags for all mailboxes of this account
      hasMoreEmailsByMailbox: Object.fromEntries(
        Object.entries(state.hasMoreEmailsByMailbox).filter(
          ([key]) => !key.startsWith(`${accountId}-`)
        )
      ),
      // Clear current pages for all mailboxes of this account
      currentPageByMailbox: Object.fromEntries(
        Object.entries(state.currentPageByMailbox).filter(
          ([key]) => !key.startsWith(`${accountId}-`)
        )
      ),
      // Clear last selected mailbox for this account
      lastSelectedMailboxByAccount: {
        ...state.lastSelectedMailboxByAccount,
        [accountId]: null,
      },
      // Clear expired token if any
      expiredTokenAccounts: new Set([...state.expiredTokenAccounts].filter(id => id !== accountId)),
    }

    useAccountStore.setState(cleanState)

    // Now select the account with force=true for full reinitialization
    state.selectAccount(accountId, true)
  },
  finishAccountSwitch: (): void => set({ isAccountSwitching: false }),
  selectMailbox: (mailboxName: string | null): void => set({ selectedMailbox: mailboxName }),
  selectEmail: (emailId: number | null): void => set({ selectedEmailId: emailId }),
  setCurrentEmail: (email: Email | null): void => set({ currentEmail: email }),

  // Mailbox Slice
  setMailboxesForAccount: (accountId: string, mailboxes: MailBoxes | null): void =>
    set(state => ({
      mailboxesByAccountId: { ...state.mailboxesByAccountId, [accountId]: mailboxes },
    })),
  restoreLastSelectedMailbox: (accountId: string): void =>
    set(state => {
      const lastMailbox = state.lastSelectedMailboxByAccount[accountId]
      if (lastMailbox && state.mailboxesByAccountId[accountId]?.[lastMailbox]) {
        return { selectedMailbox: lastMailbox }
      }
      return {}
    }),

  // Email Slice
  setEmailHeadersForMailbox: (
    accountId: string,
    mailboxName: string,
    headers: EmailHeader[]
  ): void => {
    const key = `${accountId}-${mailboxName}`
    set(state => ({
      emailHeadersByMailbox: { ...state.emailHeadersByMailbox, [key]: headers },
    }))
  },
  appendEmailHeadersToMailbox: (
    accountId: string,
    mailboxName: string,
    headers: EmailHeader[]
  ): void => {
    const key = `${accountId}-${mailboxName}`
    set(state => {
      const existingHeaders = state.emailHeadersByMailbox[key] ?? []
      const existingUids = new Set(existingHeaders.map(h => h.uid))
      const uniqueNewHeaders = headers.filter(h => !existingUids.has(h.uid))
      return {
        emailHeadersByMailbox: {
          ...state.emailHeadersByMailbox,
          [key]: [...existingHeaders, ...uniqueNewHeaders],
        },
      }
    })
  },
  prependEmailHeaders: (accountId: string, mailboxName: string, headers: EmailHeader[]): void => {
    const key = `${accountId}-${mailboxName}`
    set(state => {
      const existingHeaders = state.emailHeadersByMailbox[key] ?? []
      const existingUids = new Set(existingHeaders.map(h => h.uid))
      const uniqueNewHeaders = headers.filter(h => !existingUids.has(h.uid))
      return {
        emailHeadersByMailbox: {
          ...state.emailHeadersByMailbox,
          [key]: [...uniqueNewHeaders, ...existingHeaders],
        },
      }
    })
  },
  removeEmailHeaders: (uids: number[]): void => {
    set(state => {
      const updatedEmailHeaders = { ...state.emailHeadersByMailbox }
      for (const key of Object.keys(updatedEmailHeaders)) {
        updatedEmailHeaders[key] = updatedEmailHeaders[key].filter(
          header => !uids.includes(header.uid)
        )
      }
      return { emailHeadersByMailbox: updatedEmailHeaders }
    })
  },
  clearEmailHeadersForMailbox: (accountId: string, mailboxName: string): void => {
    const key = `${accountId}-${mailboxName}`
    set(state => {
      const newEmailHeaders = { ...state.emailHeadersByMailbox }
      delete newEmailHeaders[key]
      return { emailHeadersByMailbox: newEmailHeaders }
    })
  },
  setHasMoreEmailsForMailbox: (accountId: string, mailboxName: string, hasMore: boolean): void => {
    const key = `${accountId}-${mailboxName}`
    set(state => ({
      hasMoreEmailsByMailbox: { ...state.hasMoreEmailsByMailbox, [key]: hasMore },
    }))
  },
  setEmailCountForMailbox: (accountId: string, mailboxName: string, count: number): void => {
    const key = `${accountId}-${mailboxName}`
    set(state => ({
      emailCountByMailbox: { ...state.emailCountByMailbox, [key]: count },
    }))
  },
  setCurrentPageForMailbox: (accountId: string, mailboxName: string, page: number): void => {
    const key = `${accountId}-${mailboxName}`
    set(state => ({
      currentPageByMailbox: { ...state.currentPageByMailbox, [key]: page },
    }))
  },

  // Proxy Slice
  setGlobalProxy: (proxy: ProxyConfig | null): void => set({ globalProxy: proxy }),
  setAccountProxy: (accountId: string, proxy: ProxyConfig | null): void =>
    set(state => ({
      accounts: state.accounts.map(acc => (acc.id === accountId ? { ...acc, proxy } : acc)),
    })),

  // OAuth2 Slice
  markTokenExpired: (accountId: string): void =>
    set(state => ({
      expiredTokenAccounts: new Set(state.expiredTokenAccounts).add(accountId),
    })),
  clearExpiredToken: (accountId: string): void =>
    set(state => {
      const newExpiredTokens = new Set(state.expiredTokenAccounts)
      newExpiredTokens.delete(accountId)
      return { expiredTokenAccounts: newExpiredTokens }
    }),
  isTokenExpired: (accountId: string): boolean => {
    return useAccountStore.getState().expiredTokenAccounts.has(accountId)
  },
}))
