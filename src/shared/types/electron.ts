/**
 * @file Electron type definitions for IPC communication
 */

import type { Buffer } from 'node:buffer'

import type {
  Account,
  GlobalProxyConfig,
  ProxyConfig,
  ProxyTestResult,
  TestConfig,
} from './account'
import type { EmailHeader } from './email'

export type ProxyStatus = 'disabled' | 'enabled' | 'connecting' | 'connected' | 'error'

export interface MailBoxes {
  [key: string]: {
    attribs?: string[]
    children?: MailBoxes
    delimiter: string
  }
}

export interface IIpcAPI {
  // Account management
  discoverEmailConfig: (_domain: string, _force?: boolean) => Promise<unknown>
  getAccounts: () => Promise<Account[]>
  addAccount: (_accountData: Omit<Account, 'id'>) => Promise<Account>
  updateAccount: (
    _accountId: string,
    _accountData: Partial<Omit<Account, 'id'>>
  ) => Promise<Account>
  deleteAccount: (_accountId: string) => Promise<{ success: boolean }>
  deleteAllAccounts: () => Promise<{ success: boolean }>

  // Event listeners
  on: <T = unknown>(_event: string, _callback: (_data: T) => void) => void
  rendererReady: () => void

  // Shell operations
  openExternal: (_url: string) => Promise<void>

  // Browser operations (BrowserView-based, replaces deprecated <webview>)
  clearBrowserData: () => Promise<{ success: boolean; error?: string }>
  browser: {
    navigate: (_url: string) => Promise<{ success: boolean; error?: string }>
    goBack: () => Promise<{ success: boolean; error?: string }>
    goForward: () => Promise<{ success: boolean; error?: string }>
    reload: () => Promise<{ success: boolean; error?: string }>
    stop: () => Promise<{ success: boolean; error?: string }>
    setBounds: (_bounds: { x: number; y: number; width: number; height: number }) => Promise<{
      success: boolean
      error?: string
    }>
    getUrl: () => Promise<{ success: boolean; url: string | null; error?: string }>
    getNavigationState: () => Promise<{
      success: boolean
      canGoBack: boolean
      canGoForward: boolean
      error?: string
    }>
    show: (_bounds?: { x: number; y: number; width: number; height: number }) => Promise<{
      success: boolean
      error?: string
    }>
    hide: () => Promise<{ success: boolean; error?: string }>
    updateProxy: () => Promise<{
      success: boolean
      proxyEnabled: boolean
      proxy?: string
      error?: string
    }>
    // Event listeners for BrowserView events
    onDidStartLoading: (_callback: () => void) => () => void
    onDidStopLoading: (_callback: () => void) => () => void
    onDidNavigate: (
      _callback: (_data: { url: string; canGoBack: boolean; canGoForward: boolean }) => void
    ) => () => void
    onDidNavigateInPage: (
      _callback: (_data: { url: string; canGoBack: boolean; canGoForward: boolean }) => void
    ) => () => void
    onDidFailLoad: (
      _callback: (_data: {
        errorCode: number
        errorDescription: string
        validatedURL: string
      }) => void
    ) => () => void
    onDidFinishLoad: (_callback: () => void) => () => void
    onWillRedirect: (_callback: (_data: { url: string }) => void) => () => void
  }

  // Import functionality
  importFromFileContent: (
    _content: string
  ) => Promise<{ addedCount: number; skippedCount: number; error?: string }>
  importFromFileInstant: () => Promise<{ addedCount: number; skippedCount: number; error?: string }>

  // Inbox watching
  watchInbox: (_accountId: string) => Promise<void>

  // Mailbox operations
  getMailboxes: (_accountId: string) => Promise<MailBoxes>
  selectMailbox: (_accountId: string, _mailboxName: string, _pageSize: number) => Promise<unknown>
  initializeAccount: (
    _accountId: string,
    _initialEmailLimit?: number
  ) => Promise<{
    mailboxes: MailBoxes
    defaultMailbox: string
    initialEmails: EmailHeader[]
    totalEmailCount: number
  }>

  // Email operations
  getEmails: (
    _accountId: string,
    _mailboxName: string,
    _offset: number,
    _limit: number
  ) => Promise<EmailHeader[]>
  getEmailBody: (_accountId: string, _mailboxName: string, _uid: number) => Promise<unknown>
  downloadAttachment: (
    _accountId: string,
    _mailboxName: string,
    _emailUid: number,
    _attachmentIndex: number
  ) => Promise<{ filename: string; contentType: string; content: Buffer; size: number }>
  deleteEmail: (_accountId: string, _mailboxName: string, _uid: number) => Promise<void>
  deleteEmails: (_accountId: string, _mailboxName: string, _uids: number[]) => Promise<void>
  markAsSeen: (_accountId: string, _emailUid: number, _mailbox: string) => Promise<void>
  markAsUnseen: (_accountId: string, _emailUid: number, _mailbox: string) => Promise<void>

  // Event handlers
  onNewMail: (
    _callback: (
      _event: unknown,
      _data: { accountId: string; mailboxName: string; newMailCount: number }
    ) => void
  ) => () => void
  onLog: (
    callback: (
      _event: unknown,
      _log: { level: 'info' | 'success' | 'error'; message: string }
    ) => void
  ) => () => void
  logMessage: (level: 'info' | 'warn' | 'error', message: string, context?: object) => void
  notifyMinimizeToTrayChanged: (_enabled: boolean) => void

  // Proxy management
  proxy: {
    getGlobal: () => Promise<GlobalProxyConfig | null>
    setGlobal: (_config: GlobalProxyConfig | null) => void
    onStatusUpdate: (
      _callback: (
        _event: unknown,
        _status: { status: ProxyStatus; ip?: string; error?: string }
      ) => void
    ) => void
    test: (
      proxyConfig: ProxyConfig,
      testConfig: TestConfig,
      sessionId?: string
    ) => Promise<ProxyTestResult>
    startTestSession: (sessionId: string) => Promise<void>
    stopTestSession: (sessionId: string) => Promise<void>
  }

  // Proxy list management
  getProxyList: () => Promise<ProxyConfig[]>
  saveProxyList: (_proxies: ProxyConfig[]) => Promise<void>
  testProxy: (_config: ProxyConfig) => Promise<{ success: boolean; ip?: string; error?: string }>
  fetchExternal: (_url: string) => Promise<string>

  // User config management
  getUserConfig: () => Promise<Record<string, unknown> | null>
  saveUserConfig: (_config: Record<string, unknown>) => Promise<void>

  // File operations
  openDataFolder: () => Promise<{ success: boolean; error?: string }>
  openAccountsFile: () => Promise<{ success: boolean; error?: string }>
  openConfigFile: () => Promise<{ success: boolean; error?: string }>
  getDataDir: () => Promise<string>

  // Clipboard operations
  detectCredentialsFromClipboard: () => Promise<ClipboardParseResult>
  parseCredentialsString: (_text: string) => Promise<CredentialsParseResult>
  copyAccountCredentials: (_email: string, _password: string) => Promise<boolean>

  // IMAP operations (legacy)
  imap: {
    getMailboxes: (_accountId: string) => Promise<unknown>
    getEmails: (
      _accountId: string,
      _mailboxName: string,
      _offset: number,
      _limit: number
    ) => Promise<EmailHeader[]>
    getEmailBody: (_accountId: string, _emailUid: number, _mailbox: string) => Promise<unknown>
    deleteEmail: (_accountId: string, _emailUid: number, _mailbox: string) => Promise<void>
    markAsSeen: (_accountId: string, _emailUid: number, _mailbox: string) => Promise<void>
    markAsUnseen: (_accountId: string, _emailUid: number, _mailbox: string) => Promise<void>
    deleteEmails: (_accountId: string, _emailUids: number[], _mailbox: string) => Promise<void>
  }
}

export interface CredentialsParseResult {
  success: boolean
  credentials?: {
    email: string
    password: string
    isOAuth2?: boolean
    refreshToken?: string
    clientId?: string
  }
  error?: string
}

export interface ClipboardParseResult {
  success: boolean
  credentials?: {
    email: string
    password: string
    isOAuth2?: boolean
    refreshToken?: string
    clientId?: string
  }
  error?: string
}

// Global type definition for window.ipcApi
declare global {
  interface Window {
    ipcApi: IIpcAPI
  }
}
