import type { IpcMain, IpcMainInvokeEvent, WebContents } from 'electron'
import type { ImapFlow } from 'imapflow'
import type { Logger } from 'pino'

import { getAccounts } from '../services/accountService'
import { imapFlowConnectionManager } from '../services/connectionManager'
import {
  type ConnectionHooks,
  connectToAccount,
  deleteEmail as deleteEmailIMAP,
  deleteEmails as deleteEmailsIMAP,
  fetchEmailBody,
  fetchEmails,
  getMailboxes as fetchMailboxes,
  initializeAccountData,
  markAsSeen as markAsSeenIMAP,
  markAsUnseen as markAsUnseenIMAP,
} from '../services/imapFlowService'
import { useAccountStore } from '../shared/store/accounts'
import type { Account } from '../shared/types/account'
import type { MailBoxes } from '../shared/types/electron'
import type { EmailHeader } from '../shared/types/email'
import { createEmailHeader } from '../shared/utils/emailProcessing'

// Interface for IMAP mailbox object
interface ImapMailbox {
  path: string
  delimiter: string
  flags?: string[]
  specialUse?: string
}

interface MailboxWatcher {
  release: () => Promise<void>
  listener: (_newCount: number) => void
}

// Note: Using 'any' for IMAP types due to complex external library interfaces

// Map to keep track of the active mailbox watcher for each account
const mailboxWatchers = new Map<string, MailboxWatcher>()

// Global semaphore to prevent duplicate account initializations
const accountInitializationLocks = new Map<string, Promise<unknown>>()

/**
 * Helper to find the real path of the INBOX folder.
 * @param imap - The connected IMAP instance.
 * @returns The path of the INBOX folder.
 */
async function findInboxPath(imap: ImapFlow): Promise<string> {
  // Quick check - first try standard INBOX
  try {
    await imap.getMailboxLock('INBOX')
    return 'INBOX'
  } catch {
    // If INBOX not found, do full search
    const mailboxes = await imap.list()
    const inbox = mailboxes.find(
      (m: { flags?: Set<string>; path?: string }) => m.flags?.has('\\Inbox') === true
    )
    return inbox?.path ?? 'INBOX'
  }
}

// Adapter that connects service layer with IPC and Zustand
class IpcNotifier implements ConnectionHooks {
  constructor(
    private accountId: string,
    private webContents: WebContents,
    private logger: Logger
  ) {
    // Bind methods to preserve 'this' context when passed as callbacks
    this.onLog = this.onLog.bind(this)
    this.onStatusChange = this.onStatusChange.bind(this)
    this.onTokenExpired = this.onTokenExpired.bind(this)
  }

  onStatusChange(
    status: 'connecting' | 'connected' | 'disconnected',
    details?: { error?: string }
  ): void {
    useAccountStore.getState().setAccountConnectionStatus(this.accountId, status)
    this.webContents.send('account:connection-status', {
      accountId: this.accountId,
      status,
      error: details?.error,
    })
  }

  onLog(message: string, level: 'info' | 'error' | 'success' = 'info'): void {
    if (!this.logger) {
      console.error('[IpcNotifier] Logger is undefined, cannot log:', message)
      return
    }
    const pinoLevel = level === 'success' ? 'info' : level
    this.logger[pinoLevel](message)
  }

  onTokenExpired(): void {
    useAccountStore.getState().markTokenExpired(this.accountId)
  }
}

const getOrCreateConnection = async (
  accountId: string,
  logger: Logger,
  webContents: WebContents
): Promise<ImapFlow | null> => {
  const existingConnection = imapFlowConnectionManager.get(accountId)
  if (existingConnection?.usable) {
    return existingConnection
  }

  if (imapFlowConnectionManager.hasPendingConnection(accountId)) {
    logger.info(`Connection already pending for ${accountId}, waiting...`)
    return imapFlowConnectionManager.getOrWaitForConnection(accountId)
  }

  let accounts: Account[]

  try {
    accounts = await getAccounts()
  } catch (error) {
    const errorMessage = `Failed to load accounts from storage: ${error instanceof Error ? error.message : String(error)}`
    logger.error(errorMessage)
    throw new Error(errorMessage)
  }

  const account = accounts.find((acc: Account) => acc.id === accountId)
  if (!account) {
    logger.error(`Account not found for id: ${accountId}`)
    throw new Error(`Account not found for id: ${accountId}`)
  }

  const notifier = new IpcNotifier(accountId, webContents, logger)

  const connectionPromise = connectToAccount(account, notifier)
  imapFlowConnectionManager.setPendingConnection(
    accountId,
    connectionPromise.then(result => result.imap)
  )

  const { imap: newImap } = await connectionPromise

  if (!newImap?.usable) {
    throw new Error('Created connection is not usable')
  }

  imapFlowConnectionManager.set(accountId, newImap)
  return newImap
}

/**
 * Helper function to fetch initial emails
 */
async function fetchInitialEmails(
  imap: ImapFlow,
  mailboxName: string,
  limit: number,
  logger: Logger
): Promise<EmailHeader[]> {
  const initialEmails: EmailHeader[] = []

  if (
    typeof imap.mailbox !== 'object' ||
    imap.mailbox === null ||
    typeof imap.mailbox.exists !== 'number' ||
    imap.mailbox.exists <= 0
  ) {
    return initialEmails
  }

  const totalMessages = imap.mailbox.exists
  logger.info(`Found ${totalMessages} messages in ${mailboxName}`)

  if (totalMessages > 0) {
    const start = Math.max(1, totalMessages - limit + 1)
    const end = totalMessages

    for await (const message of imap.fetch(`${start}:${end}`, { envelope: true, flags: true })) {
      if (message.envelope && message.flags) {
        initialEmails.push(createEmailHeader(message))
      }
    }
  }

  return initialEmails
}

/**
 * Register IMAP connection and mailbox handlers
 */
function registerImapConnectionHandlers(
  ipcMain: IpcMain,
  webContents: WebContents,
  logger: Logger
): void {
  // This handler starts a background watch on an account's INBOX.
  ipcMain.handle('imap:watch-inbox', async (_event, accountId: string) => {
    try {
      // Don't create a new watcher if one already exists for this account.
      if (mailboxWatchers.has(accountId)) {
        logger.info(
          `Watcher already exists for account ${accountId}, skipping duplicate watch request`
        )
        return
      }

      logger.info(`Starting IMAP connection for account ${accountId}...`)
      const connectionStart = Date.now()

      const imap = await getOrCreateConnection(accountId, logger, webContents)

      const connectionTime = Date.now() - connectionStart
      logger.info(`IMAP connection established in ${connectionTime}ms for account ${accountId}`)

      if (!imap) {
        throw new Error('IMAP connection is null')
      }

      const inboxPath = await findInboxPath(imap)
      const lock = await imap.getMailboxLock(inboxPath)

      let messageCount =
        typeof imap.mailbox === 'object' &&
        imap.mailbox !== null &&
        typeof imap.mailbox.exists === 'number'
          ? imap.mailbox.exists
          : 0

      const listener = async (newCount: number): Promise<void> => {
        if (newCount > messageCount) {
          const newMailCount = newCount - messageCount
          logger.info(`[NEW MAIL] Account ${accountId} has ${newMailCount} new email(s) in INBOX!`)
          webContents.send('mail:new', { accountId, mailboxName: inboxPath, newMailCount })
        }
        messageCount = newCount
      }

      // @ts-expect-error - ImapFlow types don't include 'exists' event, but it's valid
      imap.on('exists', listener)

      mailboxWatchers.set(accountId, {
        release: async () => {
          await lock.release()
        },
        listener,
      })

      const totalTime = Date.now() - connectionStart
      logger.info(`Started watching INBOX for account ${accountId} (total time: ${totalTime}ms)`)
    } catch (error) {
      logger.error(`Failed to start watching INBOX for ${accountId}: ${(error as Error).message}`)
      // Don't throw error to avoid blocking UI
    }
  })

  // This single handler now manages selecting a mailbox, fetching initial emails, and watching for new ones.
  ipcMain.handle(
    'imap:select-mailbox',
    async (_event, accountId: string, mailboxName: string, limit: number) => {
      try {
        logger.info(
          `DEBUG: Selecting mailbox ${mailboxName} for account ${accountId} with limit ${limit}`
        )
        const imap = await getOrCreateConnection(accountId, logger, webContents)

        if (!imap) {
          throw new Error('IMAP connection is null')
        }

        // We only need a short-term lock for fetching, no more IDLE here.
        const lock = await imap.getMailboxLock(mailboxName)
        logger.info(`DEBUG: Acquired mailbox lock for ${mailboxName}`)

        try {
          const initialEmails = await fetchInitialEmails(imap, mailboxName, limit, logger)
          logger.info(`DEBUG: Fetched ${initialEmails.length} emails before reversing`)
          initialEmails.reverse() // Show newest first
          const totalCount =
            typeof imap.mailbox === 'object' &&
            imap.mailbox !== null &&
            typeof imap.mailbox.exists === 'number'
              ? imap.mailbox.exists
              : 0
          logger.info(
            `DEBUG: Successfully fetched ${initialEmails.length} emails from ${mailboxName} (${totalCount} total)`
          )
          logger.info(
            `DEBUG: Returning result: { emails: ${initialEmails.length} items, totalCount: ${totalCount} }`
          )
          return { emails: initialEmails, totalCount }
        } finally {
          // Release the lock immediately after fetching.
          lock.release()
          logger.info(`DEBUG: Released mailbox lock for ${mailboxName}`)
        }
      } catch (error) {
        const errorMessage = `Failed to select mailbox ${mailboxName}: ${(error as Error).message}`
        logger.error(`DEBUG: ERROR in select-mailbox: ${errorMessage}`)
        // Return empty result instead of throwing to prevent UI crashes
        return { emails: [], totalCount: 0 }
      }
    }
  )
}

/**
 * Register IMAP mailbox and email fetching handlers
 */
function registerImapMailboxHandlers(
  ipcMain: IpcMain,
  webContents: WebContents,
  logger: Logger
): void {
  ipcMain.handle('imap:getMailboxes', async (_event: IpcMainInvokeEvent, accountId: string) => {
    try {
      logger.info(`DEBUG: Getting mailboxes for account ${accountId}`)
      const imap = await getOrCreateConnection(accountId, logger, webContents)

      if (!imap) {
        throw new Error('IMAP connection is null')
      }

      // Verify connection is still usable right before using it
      if (!imap.usable) {
        throw new Error('Connection not available')
      }

      logger.info('DEBUG: Fetching mailboxes...')
      const mailboxes = (await fetchMailboxes(imap)) as ImapMailbox[]
      logger.info(`DEBUG: Found ${mailboxes.length} mailboxes`)

      // Transform mailboxes format for compatibility with existing code
      const mailboxesTree: MailBoxes = {}

      for (const mailbox of mailboxes) {
        const pathParts = mailbox.path.split(mailbox.delimiter)
        let currentLevel = mailboxesTree

        for (let i = 0; i < pathParts.length; i++) {
          const part = pathParts[i]

          if (!(part in currentLevel)) {
            currentLevel[part] = {
              attribs: [],
              children: {},
              delimiter: mailbox.delimiter,
            } as MailBoxes[string]
          }

          if (i === pathParts.length - 1) {
            currentLevel[part].attribs = Array.from(mailbox.flags ?? [])
            if (currentLevel[part].children === undefined) {
              currentLevel[part].children = {}
            }
          }

          if (currentLevel[part].children !== null && currentLevel[part].children !== undefined) {
            currentLevel = currentLevel[part].children as MailBoxes
          }
        }
      }

      logger.info('DEBUG: Mailboxes fetched successfully.')
      logger.info(
        `DEBUG: Returning mailboxes tree with ${Object.keys(mailboxesTree).length} top-level folders`
      )
      return mailboxesTree
    } catch (error) {
      const errorMessage = `Failed to fetch mailboxes: ${(error as Error).message}`
      logger.error(`DEBUG: ERROR in getMailboxes: ${errorMessage}`)
      // Throw error instead of returning empty object to let UI handle it properly
      throw new Error(errorMessage)
    }
  })

  ipcMain.handle(
    'imap:getEmails',
    async (
      _event: IpcMainInvokeEvent,
      accountId: string,
      mailboxName: string,
      offset: number,
      limit: number
    ) => {
      const imap = imapFlowConnectionManager.get(accountId)
      if (!imap) {
        console.error(`No active connection found for account ${accountId}`)
        return []
      }

      try {
        const emails = await fetchEmails(imap, mailboxName, offset, limit)
        return emails
      } catch (error) {
        console.error(`Failed to fetch emails for ${accountId} from ${mailboxName}:`, error)
        return [] // Return empty array on error
      }
    }
  )

  // New handler for coordinated account initialization
  ipcMain.handle(
    'imap:initialize-account',
    async (_event: IpcMainInvokeEvent, accountId: string, initialEmailLimit = 50) => {
      // Check if initialization is already in progress for this account
      if (accountInitializationLocks.has(accountId)) {
        try {
          return await accountInitializationLocks.get(accountId)
        } catch (_error) {
          accountInitializationLocks.delete(accountId)
        }
      }

      // Create new initialization promise
      const initializationPromise = (async () => {
        try {
          // Always clean up existing connection for fresh reconnection during reauth
          const existingConnection = imapFlowConnectionManager.get(accountId)
          if (existingConnection) {
            await imapFlowConnectionManager.end(accountId)
          }

          // Create fresh connection
          const imap = await getOrCreateConnection(accountId, logger, webContents)

          if (!imap?.usable) {
            throw new Error('Failed to create usable connection for initialization')
          }

          const result = await initializeAccountData(imap, initialEmailLimit)
          return result
        } catch (error) {
          const errorMessage = `Failed to initialize account ${accountId}: ${error instanceof Error ? error.message : String(error)}`
          logger.error(errorMessage)

          // Clean up failed connection
          await imapFlowConnectionManager.end(accountId)

          throw new Error(errorMessage)
        } finally {
          // Always cleanup the lock when done
          accountInitializationLocks.delete(accountId)
        }
      })()

      // Store the promise to prevent duplicate initializations
      accountInitializationLocks.set(accountId, initializationPromise)

      return initializationPromise
    }
  )
}

/**
 * Register IMAP email operation handlers
 */
function registerImapEmailHandlers(ipcMain: IpcMain, logger: Logger): void {
  ipcMain.handle(
    'imap:getEmailBody',
    async (
      _event: IpcMainInvokeEvent,
      accountId: string,
      mailboxName: string,
      emailUid: number
    ) => {
      const imap = imapFlowConnectionManager.get(accountId)
      if (!imap) {
        logger.error({ accountId }, `No active connection found for account ${accountId}`)
        return null
      }

      try {
        const logFn = (message: string, level: 'info' | 'success' | 'error' = 'info'): void => {
          const pinoLevel = level === 'success' ? 'info' : level
          logger[pinoLevel](message)
        }
        const email = await fetchEmailBody(imap, mailboxName, emailUid, logFn)
        return email
      } catch (error) {
        console.error(`Failed to fetch email body for UID ${emailUid}:`, error)
        throw error
      }
    }
  )

  // Add attachment download handler
  ipcMain.handle(
    'imap:downloadAttachment',
    async (
      _event: IpcMainInvokeEvent,
      accountId: string,
      mailboxName: string,
      emailUid: number,
      attachmentIndex: number
    ) => {
      const imap = imapFlowConnectionManager.get(accountId)
      if (!imap) {
        console.error(`No active connection found for account ${accountId}`)
        return null
      }

      try {
        const logFn = (message: string, level: 'info' | 'success' | 'error' = 'info'): void => {
          const pinoLevel = level === 'success' ? 'info' : level
          logger[pinoLevel](message)
        }
        const email = await fetchEmailBody(imap, mailboxName, emailUid, logFn)

        if (
          email &&
          typeof email === 'object' &&
          'attachments' in email &&
          Array.isArray(email.attachments)
        ) {
          const attachment = email.attachments[attachmentIndex]
          if (attachment?.content) {
            return {
              filename: attachment.filename || `attachment_${attachmentIndex}`,
              contentType: attachment.contentType,
              content: attachment.content,
              size: attachment.size,
            }
          }
        }

        throw new Error('Attachment not found')
      } catch (error) {
        console.error(`Failed to download attachment for UID ${emailUid}:`, error)
        throw error
      }
    }
  )

  ipcMain.handle(
    'imap:deleteEmail',
    async (
      _event: IpcMainInvokeEvent,
      accountId: string,
      mailboxName: string,
      emailUid: number
    ) => {
      const imap = imapFlowConnectionManager.get(accountId)
      if (!imap) {
        console.error(`No active connection found for account ${accountId}`)
        return
      }

      try {
        await deleteEmailIMAP(imap, mailboxName, emailUid)
      } catch (error) {
        console.error(`Failed to delete email UID ${emailUid}:`, error)
        throw error
      }
    }
  )

  ipcMain.handle(
    'imap:markAsSeen',
    async (
      _event: IpcMainInvokeEvent,
      accountId: string,
      mailboxName: string,
      emailUid: number
    ) => {
      const imap = imapFlowConnectionManager.get(accountId)
      if (!imap) return
      try {
        await markAsSeenIMAP(imap, mailboxName, emailUid)
      } catch (error) {
        console.error(`Failed to mark email UID ${emailUid} as seen:`, error)
        throw error
      }
    }
  )

  ipcMain.handle(
    'imap:markAsUnseen',
    async (
      _event: IpcMainInvokeEvent,
      accountId: string,
      mailboxName: string,
      emailUid: number
    ) => {
      const imap = imapFlowConnectionManager.get(accountId)
      if (!imap) return
      try {
        await markAsUnseenIMAP(imap, mailboxName, emailUid)
      } catch (error) {
        console.error(`Failed to mark email UID ${emailUid} as unseen:`, error)
        throw error
      }
    }
  )

  ipcMain.handle(
    'imap:deleteEmails',
    async (
      _event: IpcMainInvokeEvent,
      accountId: string,
      mailboxName: string,
      emailUids: number[]
    ) => {
      const imap = imapFlowConnectionManager.get(accountId)
      if (!imap) {
        console.error(`No active connection found for account ${accountId}`)
        return { success: false, error: 'No active connection' }
      }
      try {
        await deleteEmailsIMAP(imap, mailboxName, emailUids)
        return { success: true }
      } catch (error) {
        console.error(`Failed to delete emails with UIDs ${emailUids}:`, error)
        return { success: false, error: (error as Error).message }
      }
    }
  )
}

/**
 * Main function to register all IMAP handlers
 */
export const registerImapFlowHandlers = (
  ipcMain: IpcMain,
  webContents: WebContents,
  logger: Logger
): void => {
  registerImapConnectionHandlers(ipcMain, webContents, logger)
  registerImapMailboxHandlers(ipcMain, webContents, logger)
  registerImapEmailHandlers(ipcMain, logger)
}
