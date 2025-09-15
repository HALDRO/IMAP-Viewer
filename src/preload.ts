// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';

import type { Account } from './shared/types/account';
import type { DiscoveredConfig } from './shared/types/protocol';

/**
 * @file Preload script for the renderer process.
 * Exposes a safe, type-strong API to the renderer for interacting with the main process.
 */

export const ipcApi = {
  discoverEmailConfig: (domain: string, force?: boolean): Promise<DiscoveredConfig | null> => ipcRenderer.invoke('discover:email-config', domain, force),
  getAccounts: (): Promise<Account[]> => ipcRenderer.invoke('accounts:get'),
  addAccount: (account: Omit<Account, 'id'>): Promise<Account> => ipcRenderer.invoke('accounts:add', account),
  updateAccount: (accountId: string, accountData: Partial<Omit<Account, 'id'>>): Promise<Account> => ipcRenderer.invoke('accounts:update', accountId, accountData),
  deleteAccount: (accountId: string): Promise<{ success: boolean }> => ipcRenderer.invoke('accounts:delete', accountId),
  deleteAllAccounts: (): Promise<{ success: boolean }> => ipcRenderer.invoke('accounts:delete-all'),
  importFromFile: (): Promise<unknown> => ipcRenderer.invoke('accounts:import-from-file'),
  importFromFileInstant: (): Promise<unknown> => ipcRenderer.invoke('accounts:import-from-file-instant'),
  importFromFileContent: (content: string): Promise<unknown> => ipcRenderer.invoke('accounts:import-from-file-content', content),

  // Domain management
  getDomains: (): Promise<Record<string, DiscoveredConfig>> => ipcRenderer.invoke('domains:get'),
  saveDomain: (domain: string, config: DiscoveredConfig): Promise<{ success: boolean }> => ipcRenderer.invoke('domains:save', domain, config),
  
  // IMAP operations
  watchInbox: (accountId: string): Promise<unknown> => ipcRenderer.invoke('imap:watch-inbox', accountId),
  selectMailbox: (accountId: string, mailboxName: string, limit: number): Promise<unknown> => ipcRenderer.invoke('imap:select-mailbox', accountId, mailboxName, limit),
  getMailboxes: (accountId: string): Promise<unknown> => ipcRenderer.invoke('imap:getMailboxes', accountId),
  initializeAccount: (accountId: string, initialEmailLimit?: number): Promise<unknown> => ipcRenderer.invoke('imap:initialize-account', accountId, initialEmailLimit),
  getEmails: (accountId: string, mailboxName: string, offset: number, limit: number): Promise<unknown> => ipcRenderer.invoke('imap:getEmails', accountId, mailboxName, offset, limit),
  getEmailBody: (accountId: string, mailbox: string, emailUid: number): Promise<unknown> => ipcRenderer.invoke('imap:getEmailBody', accountId, mailbox, emailUid),
  deleteEmail: (accountId: string, mailbox: string, emailUid: number): Promise<unknown> => ipcRenderer.invoke('imap:deleteEmail', accountId, mailbox, emailUid),
  markAsSeen: (accountId: string, mailbox: string, emailUid: number): Promise<unknown> => ipcRenderer.invoke('imap:markAsSeen', accountId, mailbox, emailUid),
  markAsUnseen: (accountId: string, mailbox: string, emailUid: number): Promise<unknown> => ipcRenderer.invoke('imap:markAsUnseen', accountId, mailbox, emailUid),
  deleteEmails: (accountId: string, mailbox: string, uids: number[]): Promise<unknown> => ipcRenderer.invoke('imap:deleteEmails', accountId, mailbox, uids),

  // Global proxy management
  proxy: {
    getGlobal: (): Promise<unknown> => ipcRenderer.invoke('proxy:get-global'),
    setGlobal: (config: unknown): Promise<unknown> => ipcRenderer.invoke('proxy:set-global', config),
    onStatusUpdate: (callback: (_event: unknown, _status: unknown) => void): (() => void) => {
      ipcRenderer.on('proxy:status-update', callback);
      return (): void => { ipcRenderer.removeListener('proxy:status-update', callback); };
    },
  },
  
  // Proxy list management
  getProxyList: (): Promise<unknown> => ipcRenderer.invoke('proxy:get-list'),
  saveProxyList: (proxies: unknown[]): Promise<unknown> => ipcRenderer.invoke('proxy:save-list', proxies),
  testProxy: (proxy: unknown): Promise<unknown> => ipcRenderer.invoke('proxy:test', proxy),

  // User configuration management
  getUserConfig: (): Promise<unknown> => ipcRenderer.invoke('config:get-user'),
  saveUserConfig: (config: unknown): Promise<unknown> => ipcRenderer.invoke('config:save-user', config),
  resetAllConfig: (): Promise<unknown> => ipcRenderer.invoke('config:reset-all'),

  // File operations
  openDataFolder: (): Promise<unknown> => ipcRenderer.invoke('files:open-data-folder'),
  openAccountsFile: (): Promise<unknown> => ipcRenderer.invoke('files:open-accounts-file'),
  openConfigFile: (): Promise<unknown> => ipcRenderer.invoke('files:open-config-file'),
  getDataDir: (): Promise<unknown> => ipcRenderer.invoke('files:get-data-dir'),

  // Listener for logs from the main process
  onLog: (callback: (_event: unknown, _log: { level: 'info' | 'success' | 'error'; message: string }) => void): (() => void) => {
    ipcRenderer.on('log:add', callback);
    // Return a cleanup function to remove the listener
    return (): void => { ipcRenderer.removeListener('log:add', callback); };
  },

  // Clipboard operations
  detectCredentialsFromClipboard: (): Promise<unknown> => ipcRenderer.invoke('clipboard:detect-credentials'),
  parseCredentialsString: (text: string): Promise<unknown> => ipcRenderer.invoke('clipboard:parse-credentials', text),
  copyAccountCredentials: (email: string, password: string): Promise<unknown> => ipcRenderer.invoke('clipboard:copy-credentials', email, password),

  logMessage: (level: 'info' | 'warn' | 'error', message: string, context?: object): void => {
    ipcRenderer.send('log:renderer', { level, message, context });
  },

  onNewMail: (callback: (_event: unknown, _data: { accountId: string; mailboxName: string; newMailCount: number }) => void): (() => void) => {
    const handler = (_event: unknown, data: unknown): void => callback(_event, data as { accountId: string; mailboxName: string; newMailCount: number });
    ipcRenderer.on('mail:new', handler);
    return (): void => { ipcRenderer.removeListener('mail:new', handler); };
  },

  // Notify main process that the renderer is ready
  rendererReady: (): Promise<unknown> => ipcRenderer.invoke('renderer:ready'),

  // Listeners for events from the main process
  on: (channel: string, callback: (..._args: unknown[]) => void): void => {
    ipcRenderer.on(channel, (_event, ...args) => callback(...args));
  },
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('ipcApi', ipcApi);
