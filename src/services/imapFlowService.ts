import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

// Proxy agents - imported but not yet implemented
// import { HttpsProxyAgent } from 'https-proxy-agent';
// import { SocksProxyAgent } from 'socks-proxy-agent';

import type { Account } from '../shared/types/account';
import type { EmailHeader } from '../shared/types/email';
import type { MailBoxes } from '../shared/types/electron';
import { tokenManager } from './tokenManager';
import { MsalService } from './msalService';


import { validateMailbox, calculateMessageRange, createEmailHeader } from '../shared/utils/emailProcessing';
import { logImapError, createImapConfig, configureProxy } from '../shared/utils/imapErrorHandling';
import { getLogger } from './logger';

// Import account store for token expiration tracking
let accountStore: any = null;
try {
  // Dynamic import to avoid circular dependencies
  accountStore = require('../shared/store/accounts/accountStore').useAccountStore;
} catch (e) {
  // Store not available in this context
}

// Interface for IMAP mailbox object
interface ImapMailboxInfo {
  exists: number;
  recent: number;
  flags: Set<string>;
  permanentFlags: Set<string>;
  uidValidity: number;
  uidNext: number;
}



// Interface for account initialization result
export interface AccountInitializationResult {
  mailboxes: MailBoxes;
  defaultMailbox: string;
  initialEmails: EmailHeader[];
  totalEmailCount: number;
  mailboxCounts: Record<string, number>;
}

/**
 * @file Service for handling IMAP connections and operations using ImapFlow.
 */

/**
 * Connects to an IMAP server using the provided account details.
 * @param {Account} account - The account to connect with.
 * @param {(message: string, level?: 'info' | 'error' | 'success') => void} logCallback - Optional callback for logging.
 * @returns {Promise<ImapFlow>} A promise that resolves with the connected ImapFlow instance.
 */
export async function connectToAccount(
  account: Account,
  logCallback: (message: string, level?: 'info' | 'error' | 'success') => void = () => {}
): Promise<{ imap: ImapFlow; proxyUsed: boolean }> {
  return new Promise(async (resolve, reject) => {
    // We can only connect if the configured protocol is IMAP.
    if (account.incoming.protocol !== 'imap') {
      return reject(new Error(`Account is configured for ${account.incoming.protocol}, not IMAP.`));
    }

    try {
      logCallback(`Starting connection process for ${account.email}`, 'info');
      logCallback(`Account authType: ${account.authType || 'undefined'}`, 'info');
      logCallback(`Account clientId: ${account.clientId || 'undefined'}`, 'info');
      logCallback(`Account refreshToken: ${account.refreshToken ? `${account.refreshToken.length} chars` : 'undefined'}`, 'info');

      // Proxy configuration
      const { proxy, proxyUsed } = await configureProxy(account, logCallback);

      let imapConfig;

      // Handle OAuth2 authentication for Microsoft accounts
      if (account.authType === 'oauth2' && account.clientId && account.refreshToken) {
        logCallback(`Starting OAuth2 authentication for ${account.email}`, 'info');
        logCallback(`Client ID: ${account.clientId}`, 'info');
        logCallback(`Refresh token length: ${account.refreshToken.length} characters`, 'info');

        try {
          const accessToken = await tokenManager.getAccessToken({
            clientId: account.clientId,
            refreshToken: account.refreshToken,
            proxy: proxy
          });

          logCallback(`Access token acquired, length: ${accessToken.length} characters`, 'info');

          // ImapFlow expects just the access token, not the full XOAUTH2 string
          logCallback(`Using access token directly for ImapFlow OAuth2 authentication`, 'info');

          imapConfig = createImapConfig(account, proxy, {
            authMethod: 'XOAUTH2',
            authString: accessToken,  // Pass only the access token
          });

          logCallback('OAuth2 configuration created successfully', 'success');
        } catch (tokenError) {
          const errorMsg = `OAuth2 token acquisition failed: ${tokenError instanceof Error ? tokenError.message : 'Unknown error'}`;
          logCallback(errorMsg, 'error');
          logCallback(`Token error details: ${JSON.stringify(tokenError)}`, 'error');

          // Check if token is expired and mark it in the store
          if (MsalService.isReauthenticationRequired(tokenError as Error)) {
            if (accountStore) {
              try {
                const store = accountStore.getState();
                store.markTokenExpired(account.id);
                getLogger().info({ accountId: account.id, email: account.email }, 'Marked OAuth2 token as expired in store');
              } catch (storeError) {
                getLogger().warn({ error: storeError }, 'Failed to mark token as expired in store');
              }
            }
            return reject(new Error(`${errorMsg}. Please remove and re-add this account with fresh credentials.`));
          }

          return reject(new Error(errorMsg));
        }
      } else {
        // Standard basic authentication
        imapConfig = createImapConfig(account, proxy);
      }

      logCallback(`Creating IMAP connection with config: host=${account.incoming.host}, port=${account.incoming.port}, secure=${account.incoming.useTls}`, 'info');
      if (account.authType === 'oauth2') {
        logCallback(`Using OAuth2 authentication method: XOAUTH2`, 'info');
      } else {
        logCallback(`Using basic authentication for ${account.email}`, 'info');
      }

      const imap = new ImapFlow(imapConfig);

      // Настройка обработчиков событий
      imap.on('error', (err) => {
        logCallback(`IMAP connection error: ${err.message}`, 'error');
        logImapError(err, account.email, account.incoming.host, logCallback);
        reject(err);
      });

      // Подключаемся
      logCallback(`Attempting to connect to ${account.incoming.host}:${account.incoming.port} for ${account.email}...`, 'info');

      await imap.connect();
      logCallback(`IMAP connection established successfully for ${account.email}`, 'success');
      resolve({ imap, proxyUsed });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown connection error';
      logCallback(`Connection failed: ${errorMsg}`, 'error');
      reject(error);
    }
  });
}

/**
 * Fetches the list of mailboxes from a connected IMAP instance.
 * @param {ImapFlow} imap - The connected IMAP instance.
 * @returns {Promise<Array>} A promise that resolves with the mailboxes.
 */
export async function getMailboxes(imap: ImapFlow): Promise<unknown[]> {
  // Let ImapFlow handle connection state - removing usable check to prevent race conditions
  const logger = getLogger();
  logger.debug('Fetching mailboxes from IMAP connection');

  const list = await imap.list();
  logger.debug(`Successfully fetched ${list.length} mailboxes`);
  return list;
}

/**
 * Fetches a paginated list of email headers from a mailbox.
 * @param {ImapFlow} imap - The connected IMAP instance.
 * @param {string} mailboxName - The name of the mailbox to fetch from.
 * @param {number} offset - The number of emails to skip from the newest.
 * @param {number} limit - The maximum number of emails to fetch.
 * @returns {Promise<EmailHeader[]>} A promise that resolves with an array of email headers.
 */
export async function fetchEmails(imap: ImapFlow, mailboxName: string, offset: number, limit: number): Promise<EmailHeader[]> {
  // Открываем почтовый ящик
  const lock = await imap.getMailboxLock(mailboxName);
  try {
    validateMailbox(imap);

    const totalMessages = (imap.mailbox as unknown as ImapMailboxInfo).exists ?? 0;
    const { start, end } = calculateMessageRange(totalMessages, offset, limit);

    if (start > end) {
      return [];
    }

    const headers: EmailHeader[] = [];
    for await (const message of imap.fetch(`${start}:${end}`, { envelope: true, flags: true })) {
      if (message.envelope && message.flags) {
        // Адаптируем FetchMessageObject к ожидаемому типу
        const adaptedMessage = {
          uid: message.uid,
          envelope: {
            from: message.envelope.from,
            subject: message.envelope.subject,
            date: message.envelope.date
          },
          flags: message.flags
        };
        headers.push(createEmailHeader(adaptedMessage));
      }
    }

    return headers.reverse(); // Реверс для показа новых первыми
  } finally {
    lock.release();
  }
}

/**
 * Fetches the full body of a specific email.
 * @param {ImapFlow} imap - The connected IMAP instance.
 * @param {string} mailboxName - The name of the mailbox.
 * @param {number} uid - The UID of the email to fetch.
 * @returns {Promise<any>} A promise that resolves with the parsed email body.
 */
export async function fetchEmailBody(
  imap: ImapFlow,
  mailboxName: string,
  uid: number,
  logCallback: (message: string, level?: 'info' | 'error' | 'success') => void = () => {}
): Promise<unknown> {
  const lock = await imap.getMailboxLock(mailboxName);
  try {
    logCallback(`UID ${uid}: Fetching metadata...`);
    const metadataPromise = imap.fetchOne(String(uid), { envelope: true, flags: true }, { uid: true });

    logCallback(`UID ${uid}: Downloading content...`);
    const { content } = await imap.download(String(uid), undefined, { uid: true });
    
    if (content === null || content === undefined) {
      throw new Error(`Could not download content for message UID ${uid}`);
    }

    logCallback(`UID ${uid}: Parsing content and waiting for metadata...`);
    const [parsed, messageMeta] = await Promise.all([
      simpleParser(content),
      metadataPromise
    ]);

    if (messageMeta === null || messageMeta === undefined) {
      throw new Error(`Could not fetch metadata for message UID ${uid}`);
    }

    logCallback(`UID ${uid}: Assembling final email object...`);
    const finalDate = parsed.date ?? messageMeta.envelope?.date;

    return {
      ...parsed,
      date: finalDate ? finalDate.toISOString() : new Date().toISOString(),
      flags: Array.from(messageMeta.flags ?? []),
      uid: messageMeta.uid,
    };
  } finally {
    lock.release();
  }
}

/**
 * Marks a specific email for deletion.
 * @param {ImapFlow} imap - The connected IMAP instance.
 * @param {string} mailboxName - The name of the mailbox.
 * @param {number} uid - The UID of the email to delete.
 * @returns {Promise<void>} A promise that resolves when the email is marked as deleted.
 */
export async function deleteEmail(imap: ImapFlow, mailboxName: string, uid: number): Promise<void> {
  const lock = await imap.getMailboxLock(mailboxName, { readonly: false });
  try {
    await imap.messageDelete(String(uid), { uid: true });
  } finally {
    lock.release();
  }
}

/**
 * Marks an email as read (seen).
 * @param {ImapFlow} imap - The connected IMAP instance.
 * @param {string} mailboxName - The name of the mailbox.
 * @param {number} uid - The UID of the email.
 * @returns {Promise<void>}
 */
export async function markAsSeen(imap: ImapFlow, mailboxName: string, uid: number): Promise<void> {
  const lock = await imap.getMailboxLock(mailboxName, { readonly: false });
  try {
    await imap.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true });
  } finally {
    lock.release();
  }
}

/**
 * Marks an email as unread (unseen).
 * @param {ImapFlow} imap - The connected IMAP instance.
 * @param {string} mailboxName - The name of the mailbox.
 * @param {number} uid - The UID of the email.
 * @returns {Promise<void>}
 */
export async function markAsUnseen(imap: ImapFlow, mailboxName: string, uid: number): Promise<void> {
  const lock = await imap.getMailboxLock(mailboxName, { readonly: false });
  try {
    await imap.messageFlagsRemove(String(uid), ['\\Seen'], { uid: true });
  } finally {
    lock.release();
  }
}

/**
 * Marks multiple emails for deletion.
 * @param {ImapFlow} imap - The connected IMAP instance.
 * @param {string} mailboxName - The name of the mailbox.
 * @param {number[]} uids - Array of UIDs to delete.
 * @returns {Promise<void>}
 */
export async function deleteEmails(imap: ImapFlow, mailboxName: string, uids: number[]): Promise<void> {
  if (uids.length === 0) return;

  const lock = await imap.getMailboxLock(mailboxName, { readonly: false });
  try {
    // ImapFlow принимает строку или массив строк для UID
    const uidString = uids.map(uid => String(uid)).join(',');
    await imap.messageDelete(uidString, { uid: true });
  } finally {
    lock.release();
  }
}

/**
 * Finds the default mailbox to use for initial email loading.
 * Prioritizes "All Mail" folders, then INBOX, then first available.
 * @param {MailBoxes} mailboxes - The mailboxes object.
 * @returns {string} The name of the default mailbox.
 */
function findDefaultMailbox(mailboxes: MailBoxes): string {
  if (!mailboxes || Object.keys(mailboxes).length === 0) {
    return 'INBOX';
  }

  const allMailboxNames = Object.keys(mailboxes);

  // Look for "All Mail" variations first (Gmail, etc.)
  const allMailVariations = [
    '[Gmail]/All Mail',
    '[Google Mail]/All Mail',
    'All Mail',
    'Все письма',
    '[Gmail]/Вся почта',
    '[Google Mail]/Вся почта'
  ];

  for (const variation of allMailVariations) {
    const found = allMailboxNames.find((name: string) =>
      name.toLowerCase().includes(variation.toLowerCase()) ||
      name === variation
    );
    if (found !== null && found !== undefined && found.length > 0) {
      return found;
    }
  }

  // Look for INBOX
  const inbox = allMailboxNames.find((name: string) =>
    name.toUpperCase() === 'INBOX' ||
    name.toLowerCase() === 'inbox'
  );
  if (inbox !== null && inbox !== undefined && inbox.length > 0) {
    return inbox;
  }

  // Fallback to first available mailbox
  return allMailboxNames[0] || 'INBOX';
}

/**
 * Converts ImapFlow mailbox list to MailBoxes tree structure.
 * @param {any[]} mailboxList - Raw mailbox list from ImapFlow.
 * @returns {MailBoxes} Converted mailboxes tree.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function convertMailboxesToTree(mailboxList: any[]): MailBoxes {
  const mailboxesTree: MailBoxes = {};

  for (const mailbox of mailboxList) {
    const pathParts = mailbox.path.split(mailbox.delimiter);
    let currentLevel = mailboxesTree;

    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];

      if (!(part in currentLevel)) {
        currentLevel[part] = {
          attribs: [],
          children: {},
          delimiter: mailbox.delimiter,
        } as MailBoxes[string];
      }

      if (i === pathParts.length - 1) {
        // Convert Set to Array for flags
        const flags = mailbox.flags ? Array.from(mailbox.flags) as string[] : [];
        currentLevel[part].attribs = flags;
        if (currentLevel[part].children === undefined) {
          currentLevel[part].children = {};
        }
      }

      if (currentLevel[part].children !== null && currentLevel[part].children !== undefined) {
        currentLevel = currentLevel[part].children;
      }
    }
  }

  return mailboxesTree;
}

/**
 * Initializes account data by fetching mailboxes and initial emails in one coordinated operation.
 * This prevents race conditions and ensures the user sees consistent data immediately.
 * @param {ImapFlow} imap - The connected IMAP instance.
 * @param {number} initialEmailLimit - Number of initial emails to fetch (default: 50).
 * @returns {Promise<AccountInitializationResult>} Complete account data.
 */
export async function initializeAccountData(
  imap: ImapFlow,
  initialEmailLimit: number = 50
): Promise<AccountInitializationResult> {
  // Let ImapFlow handle connection state - removing usable check to prevent race conditions
  const logger = getLogger();
  logger.debug('Initializing account data from IMAP connection');

  // Step 1: Get all mailboxes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawMailboxes = await imap.list() as any[];
  const mailboxes = convertMailboxesToTree(rawMailboxes);

  // Step 2: Find the default mailbox to load
  const defaultMailbox = findDefaultMailbox(mailboxes);

  // Step 3: Load initial emails from the default mailbox
  let initialEmails: EmailHeader[] = [];
  let totalEmailCount = 0;

  try {
    const lock = await imap.getMailboxLock(defaultMailbox);
    try {
      validateMailbox(imap);

      totalEmailCount = (imap.mailbox as unknown as ImapMailboxInfo).exists ?? 0;

      if (totalEmailCount > 0) {
        const { start, end } = calculateMessageRange(totalEmailCount, 0, initialEmailLimit);

        if (start <= end) {
          const headers: EmailHeader[] = [];
          for await (const message of imap.fetch(`${start}:${end}`, { envelope: true, flags: true })) {
            if (message.envelope && message.flags) {
              const adaptedMessage = {
                uid: message.uid,
                envelope: {
                  from: message.envelope.from,
                  subject: message.envelope.subject,
                  date: message.envelope.date
                },
                flags: message.flags
              };
              headers.push(createEmailHeader(adaptedMessage));
            }
          }
          initialEmails = headers.reverse(); // Show newest first
        }
      }
    } finally {
      lock.release();
    }
  } catch (error) {
    // If we can't load emails from default mailbox, continue with empty array
    const logger = getLogger();
    logger.warn({ defaultMailbox, error: error instanceof Error ? error.message : String(error) }, `Could not load initial emails from ${defaultMailbox}`);
    initialEmails = [];
    totalEmailCount = 0;

    // Don't throw error here - we still want to return mailboxes even if emails fail
  }

  // Step 4: Get email counts for key mailboxes only (to avoid performance issues)
  const mailboxCounts: Record<string, number> = {};

  // Set the count for the default mailbox (we already have it)
  mailboxCounts[defaultMailbox] = totalEmailCount;

  // Get counts for other important mailboxes (INBOX, Sent, etc.) but limit to avoid slowdown
  const importantMailboxes = [
    'INBOX',
    'Sent',
    'Drafts',
    'Trash',
    'Spam',
    'Junk'
  ];

  // Helper function to find mailbox by pattern
  const findMailboxByPattern = (pattern: string): string | null => {
    const collectAllNames = (boxes: MailBoxes, prefix = ''): string[] => {
      const names: string[] = [];
      Object.entries(boxes).forEach(([name, box]) => {
        const fullName = prefix ? `${prefix}${box.delimiter}${name}` : name;
        const attribs = Array.isArray(box.attribs) ? box.attribs : [];
        if (!attribs.includes('\\Noselect')) {
          names.push(fullName);
        }
        if (box.children && Object.keys(box.children).length > 0) {
          names.push(...collectAllNames(box.children, fullName));
        }
      });
      return names;
    };

    const allNames = collectAllNames(mailboxes);
    return allNames.find(name =>
      name.toLowerCase().includes(pattern.toLowerCase()) ||
      name.toLowerCase() === pattern.toLowerCase()
    ) || null;
  };

  // Get counts for important mailboxes only
  for (const pattern of importantMailboxes) {
    const mailboxName = findMailboxByPattern(pattern);
    if (mailboxName && mailboxName !== defaultMailbox) {
      try {
        const lock = await imap.getMailboxLock(mailboxName);
        try {
          mailboxCounts[mailboxName] = (imap.mailbox as unknown as ImapMailboxInfo).exists ?? 0;
        } finally {
          lock.release();
        }
      } catch (error) {
        // If we can't access a mailbox, set count to 0
        mailboxCounts[mailboxName] = 0;
      }
    }
  }

  return {
    mailboxes,
    defaultMailbox,
    initialEmails,
    totalEmailCount,
    mailboxCounts,
  };
}