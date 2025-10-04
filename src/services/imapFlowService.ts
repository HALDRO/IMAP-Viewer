import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'

import type { Account } from '../shared/types/account'
import type { MailBoxes } from '../shared/types/electron'
import type { EmailHeader } from '../shared/types/email'
import {
  calculateMessageRange,
  createEmailHeader,
  validateMailbox,
} from '../shared/utils/emailProcessing'
import type {
  FetchMessageObject,
  MailboxObject,
  OAuth2AuthConfig,
} from '../shared/utils/imapErrorHandling'
import { configureProxy, createImapConfig, logImapError } from '../shared/utils/imapErrorHandling'

import { getLogger } from './logger'
import { isReauthenticationRequired } from './msalService'
import { tokenManager } from './tokenManager'

interface ImapMailboxInfo {
  exists: number
}

export interface AccountInitializationResult {
  mailboxes: MailBoxes
  defaultMailbox: string
  initialEmails: EmailHeader[]
  totalEmailCount: number
  mailboxCounts: Record<string, number>
}

export interface ConnectionHooks {
  onStatusChange: (
    status: 'connecting' | 'connected' | 'disconnected',
    details?: { error?: string }
  ) => void
  onLog: (message: string, level?: 'info' | 'error' | 'success') => void
  onTokenExpired: () => void
}

async function getOAuth2Config(
  account: Account,
  proxy: string | undefined,
  hooks: ConnectionHooks
): Promise<OAuth2AuthConfig | null> {
  if (account.authType !== 'oauth2' || !account.clientId || !account.refreshToken) {
    return null
  }

  hooks.onLog(`Starting OAuth2 authentication for ${account.email}`, 'info')
  try {
    const accessToken = await tokenManager.getAccessToken({
      clientId: account.clientId,
      refreshToken: account.refreshToken,
      proxy,
    })
    hooks.onLog(`Access token acquired for ${account.email}`, 'success')
    return {
      type: 'OAuth2',
      user: account.email,
      accessToken,
      authMethod: 'XOAUTH2',
      authString: accessToken,
    }
  } catch (tokenError) {
    const errorMsg = `OAuth2 token acquisition failed: ${tokenError instanceof Error ? tokenError.message : 'Unknown error'}`
    hooks.onLog(errorMsg, 'error')
    if (isReauthenticationRequired(tokenError as Error)) {
      hooks.onTokenExpired()
    }
    throw new Error(errorMsg)
  }
}

export async function connectToAccount(
  account: Account,
  hooks: ConnectionHooks
): Promise<{ imap: ImapFlow; proxyUsed: boolean }> {
  if (account.incoming.protocol !== 'imap') {
    throw new Error(`Account is configured for ${account.incoming.protocol}, not IMAP.`)
  }

  hooks.onStatusChange('connecting')

  const { proxy, proxyUsed } = await configureProxy(account, hooks.onLog)
  const oauthConfig = await getOAuth2Config(account, proxy, hooks)
  const imapConfig = createImapConfig(account, proxy, oauthConfig ?? undefined)

  const imap = new ImapFlow(imapConfig)
  imap.on('error', err => {
    logImapError(err, account.email, account.incoming.host, hooks.onLog)
    hooks.onStatusChange('disconnected', { error: err.message })
  })

  try {
    await imap.connect()
    hooks.onLog(`IMAP connection established successfully for ${account.email}`, 'success')
    hooks.onStatusChange('connected')
    return { imap, proxyUsed }
  } catch (error) {
    hooks.onStatusChange('disconnected', {
      error: error instanceof Error ? error.message : 'Unknown connection error',
    })
    throw error
  }
}

export async function getMailboxes(imap: ImapFlow): Promise<unknown[]> {
  const logger = getLogger()
  logger.debug('Fetching mailboxes from IMAP connection')
  const list = await imap.list()
  logger.debug(`Successfully fetched ${list.length} mailboxes`)
  return list
}

export async function fetchEmails(
  imap: ImapFlow,
  mailboxName: string,
  offset: number,
  limit: number
): Promise<EmailHeader[]> {
  const lock = await imap.getMailboxLock(mailboxName)
  try {
    validateMailbox(imap)
    const totalMessages = (imap.mailbox as unknown as ImapMailboxInfo).exists ?? 0
    const { start, end } = calculateMessageRange(totalMessages, offset, limit)
    if (start > end) return []

    const headers: EmailHeader[] = []
    for await (const message of imap.fetch(`${start}:${end}`, { envelope: true, flags: true })) {
      if (message.envelope && message.flags) {
        headers.push(createEmailHeader(message as FetchMessageObject))
      }
    }
    return headers.reverse()
  } finally {
    lock.release()
  }
}

export async function fetchEmailBody(
  imap: ImapFlow,
  mailboxName: string,
  uid: number,
  _logCallback: (message: string, level?: 'info' | 'error' | 'success') => void = () => {}
): Promise<unknown> {
  const lock = await imap.getMailboxLock(mailboxName)
  try {
    const metadataPromise = imap.fetchOne(
      String(uid),
      { envelope: true, flags: true },
      { uid: true }
    )
    const { content } = await imap.download(String(uid), undefined, { uid: true })
    if (!content) throw new Error(`Could not download content for message UID ${uid}`)

    const [parsed, messageMeta] = await Promise.all([simpleParser(content), metadataPromise])
    if (!messageMeta) throw new Error(`Could not fetch metadata for message UID ${uid}`)

    const finalDate = parsed.date ?? messageMeta.envelope?.date
    return {
      ...parsed,
      date: finalDate ? finalDate.toISOString() : new Date().toISOString(),
      flags: Array.from(messageMeta.flags ?? []),
      uid: messageMeta.uid,
    }
  } finally {
    lock.release()
  }
}

async function performImapAction(
  imap: ImapFlow,
  mailboxName: string,
  uid: number | number[],
  action: 'delete' | 'seen' | 'unseen'
): Promise<void> {
  const lock = await imap.getMailboxLock(mailboxName, { readOnly: false })
  try {
    const uidString = Array.isArray(uid) ? uid.join(',') : String(uid)
    if (action === 'delete') {
      await imap.messageDelete(uidString, { uid: true })
    } else if (action === 'seen') {
      await imap.messageFlagsAdd(uidString, ['\\Seen'], { uid: true })
    } else if (action === 'unseen') {
      await imap.messageFlagsRemove(uidString, ['\\Seen'], { uid: true })
    }
  } finally {
    lock.release()
  }
}

export const deleteEmail = (imap: ImapFlow, mailboxName: string, uid: number) =>
  performImapAction(imap, mailboxName, uid, 'delete')
export const markAsSeen = (imap: ImapFlow, mailboxName: string, uid: number) =>
  performImapAction(imap, mailboxName, uid, 'seen')
export const markAsUnseen = (imap: ImapFlow, mailboxName: string, uid: number) =>
  performImapAction(imap, mailboxName, uid, 'unseen')
export const deleteEmails = (imap: ImapFlow, mailboxName: string, uids: number[]) =>
  performImapAction(imap, mailboxName, uids, 'delete')

function findDefaultMailbox(mailboxes: MailBoxes): string {
  if (!mailboxes || Object.keys(mailboxes).length === 0) return 'INBOX'
  const allMailboxNames = Object.keys(mailboxes)
  const allMailVariations = ['[Gmail]/All Mail', '[Google Mail]/All Mail', 'All Mail']
  for (const variation of allMailVariations) {
    const found = allMailboxNames.find(
      name => name.toLowerCase().includes(variation.toLowerCase()) || name === variation
    )
    if (found) return found
  }
  const inbox = allMailboxNames.find(name => name.toUpperCase() === 'INBOX')
  if (inbox) return inbox
  return allMailboxNames[0] || 'INBOX'
}

function convertMailboxesToTree(mailboxList: unknown[]): MailBoxes {
  const mailboxesTree: MailBoxes = {}
  for (const mailbox of mailboxList) {
    const mb = mailbox as { path: string; delimiter: string; flags?: string[] }
    const pathParts = mb.path.split(mb.delimiter)
    let currentLevel = mailboxesTree
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i]
      if (!currentLevel[part]) {
        currentLevel[part] = { attribs: [], children: {}, delimiter: mb.delimiter }
      }
      if (i === pathParts.length - 1) {
        currentLevel[part].attribs = Array.from(mb.flags ?? [])
        if (!currentLevel[part].children) currentLevel[part].children = {}
      }
      if (currentLevel[part].children) {
        currentLevel = currentLevel[part].children as MailBoxes
      }
    }
  }
  return mailboxesTree
}

export async function initializeAccountData(
  imap: ImapFlow,
  initialEmailLimit = 50
): Promise<AccountInitializationResult> {
  const logger = getLogger()
  logger.debug('Initializing account data from IMAP connection')

  if (!imap.usable) {
    throw new Error('IMAP connection is not usable')
  }

  const rawMailboxes = await imap.list()
  const mailboxes = convertMailboxesToTree(rawMailboxes)
  const defaultMailbox = findDefaultMailbox(mailboxes)

  const initialEmails: EmailHeader[] = []
  let totalEmailCount = 0

  try {
    const lock = await imap.getMailboxLock(defaultMailbox)
    try {
      validateMailbox(imap)
      totalEmailCount = (imap.mailbox as unknown as ImapMailboxInfo).exists ?? 0

      // Load specified number of emails for initialization
      const effectiveLimit = initialEmailLimit

      if (totalEmailCount > 0) {
        const { start, end } = calculateMessageRange(totalEmailCount, 0, effectiveLimit)
        if (start <= end) {
          const fetchStart = Date.now()

          for await (const message of imap.fetch(`${start}:${end}`, {
            envelope: true,
            flags: true,
          })) {
            if (message.envelope && message.flags) {
              initialEmails.push(createEmailHeader(message as FetchMessageObject))
            }

            // Break if fetch takes too long
            if (Date.now() - fetchStart > 2000) {
              break
            }
          }

          initialEmails.reverse()
        }
      }
    } finally {
      lock.release()
    }
  } catch (error) {
    logger.warn(
      { defaultMailbox, error: error instanceof Error ? error.message : String(error) },
      `Could not load initial emails from ${defaultMailbox}`
    )
  }

  const mailboxCounts: Record<string, number> = { [defaultMailbox]: totalEmailCount }

  return { mailboxes, defaultMailbox, initialEmails, totalEmailCount, mailboxCounts }
}
