import type { IpcMain, IpcMainInvokeEvent, WebContents } from 'electron';
import type { Logger } from 'pino';

import { imapFlowConnectionManager } from '../services/connectionManager';
import {
  connectToAccount,
  getMailboxes as fetchMailboxes,
  fetchEmails,
  fetchEmailBody,
  deleteEmail as deleteEmailIMAP,
  markAsSeen as markAsSeenIMAP,
  markAsUnseen as markAsUnseenIMAP,
  deleteEmails as deleteEmailsIMAP,
  initializeAccountData,
} from '../services/imapFlowService';
import { getAccounts } from '../services/storeService';
import type { Account } from '../shared/types/account';
import type { MailBoxes } from '../shared/types/electron';
import type { EmailHeader } from '../shared/types/email';

// Interface for IMAP mailbox object
interface ImapMailbox {
  path: string;
  delimiter: string;
  flags?: string[];
  specialUse?: string;
}

type SendConnectionStatusFn = (_accountId: string, _status: 'connected' | 'connecting' | 'disconnected') => void;

interface MailboxWatcher {
  release: () => Promise<void>;
  listener: (_newCount: number) => void;
}

// Note: Using 'any' for IMAP types due to complex external library interfaces

// Map to keep track of the active mailbox watcher for each account
const mailboxWatchers = new Map<string, MailboxWatcher>();

/**
 * Helper to find the real path of the INBOX folder.
 * @param imap - The connected IMAP instance.
 * @returns The path of the INBOX folder.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function findInboxPath(imap: any): Promise<string> {
  const mailboxes = await imap.list();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inbox = mailboxes.find((m: any) => m.flags?.has('\\Inbox') === true);
  return inbox?.path ?? 'INBOX';
}

const getOrCreateConnection = async (
  accountId: string,
  logger: Logger,
  sendConnectionStatus: SendConnectionStatusFn
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> => {
  // First check for existing connection
  const existingConnection = imapFlowConnectionManager.get(accountId);
  if (existingConnection) {
    logger.info(`Using existing connection for account.`);
    sendConnectionStatus(accountId, 'connected');
    return existingConnection;
  }

  // Check for pending connection and wait for it
  const pendingConnection = await imapFlowConnectionManager.getOrWaitForConnection(accountId);
  if (pendingConnection) {
    logger.info(`Using pending connection for account.`);
    sendConnectionStatus(accountId, 'connected');
    return pendingConnection;
  }

  // Prevent duplicate connection attempts
  if (imapFlowConnectionManager.hasPendingConnection(accountId)) {
    logger.info(`Connection already in progress for account.`);
    sendConnectionStatus(accountId, 'connecting');
    return await imapFlowConnectionManager.getOrWaitForConnection(accountId);
  }

  logger.info(`No active connection found. Creating a new one...`);
  sendConnectionStatus(accountId, 'connecting');
  // Get the latest account data from file (includes any recent updates)
  const accounts = await getAccounts();
  const account = accounts.find((acc: Account) => acc.id === accountId);

  if (!account) {
    const errorMsg = `Account not found for id: ${accountId}`;
    logger.error(errorMsg);
    sendConnectionStatus(accountId, 'disconnected');
    throw new Error(errorMsg);
  }

  try {
    const logFn = (message: string, level: 'info' | 'success' | 'error' = 'info'): void => {
        const pinoLevel = level === 'success' ? 'info' : level;
        logger[pinoLevel](message);
    };
    logFn(`Attempting to connect to ${account.incoming.host} for ${account.email}...`);

    // Create connection promise and register it to prevent duplicates
    const connectionPromise = connectToAccount(account, logFn);
    imapFlowConnectionManager.setPendingConnection(accountId, connectionPromise.then(result => result.imap));

    const { imap: newImap, proxyUsed } = await connectionPromise;

    let successMessage = `Successfully connected to ${account.email}.`;
    if (proxyUsed) {
      successMessage = `Successfully connected to ${account.email} via proxy.`;
    }
    logger.info(successMessage);
    sendConnectionStatus(accountId, 'connected');

    // Store the connection in the manager
    imapFlowConnectionManager.set(accountId, newImap);
    return newImap;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    let errorMessage = error.responseText ?? error.message ?? 'An unknown connection error occurred.';

    // Provide more user-friendly error messages
    if (errorMessage.includes('ECONNREFUSED')) {
      errorMessage = `Cannot connect to ${account.incoming.host}:${account.incoming.port}. Server may be down or settings incorrect.`;
    } else if (errorMessage.includes('AUTHENTICATIONFAILED') || errorMessage.includes('Invalid credentials')) {
      if (account.email.includes('@gmail.com')) {
        errorMessage = `Gmail authentication failed. Please use App Password instead of regular password.`;
      } else {
        errorMessage = `Authentication failed for ${account.email}. Please check your email and password.`;
      }
    } else if (errorMessage.includes('ENOTFOUND')) {
      errorMessage = `Cannot find server ${account.incoming.host}. Please check the server address.`;
    } else if (errorMessage.includes('timeout')) {
      errorMessage = `Connection timeout to ${account.incoming.host}. Please check your internet connection.`;
    }

    logger.error(errorMessage);
    sendConnectionStatus(accountId, 'disconnected');
    throw new Error(errorMessage);
  }
};

/**
 * Helper function to process email message
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function processEmailMessage(message: any): EmailHeader | null {
  if (message.envelope === null || message.envelope === undefined ||
      message.flags === null || message.flags === undefined) {
    return null;
  }

  const fromAddress = message.envelope.from?.[0];
  let fromText = 'Unknown Sender';
  if (fromAddress !== null && fromAddress !== undefined) {
    fromText = (fromAddress.name?.length ?? 0) > 0
      ? `${fromAddress.name} <${fromAddress.address}>`
      : fromAddress.address ?? 'Unknown Sender';
  }

  return {
    uid: message.uid,
    subject: message.envelope.subject ?? 'No Subject',
    from: { text: fromText },
    date: message.envelope.date?.toISOString() ?? new Date().toISOString(),
    flags: Array.from(message.flags),
    seen: message.flags.has('\\Seen')
  };
}

/**
 * Helper function to fetch initial emails
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchInitialEmails(imap: any, mailboxName: string, limit: number, logger: Logger): Promise<EmailHeader[]> {
  const initialEmails: EmailHeader[] = [];

  if (typeof imap.mailbox !== 'object' || imap.mailbox === null ||
      typeof imap.mailbox.exists !== 'number' || imap.mailbox.exists <= 0) {
    return initialEmails;
  }

  const totalMessages = imap.mailbox.exists;
  logger.info(`Found ${totalMessages} messages in ${mailboxName}`);

  if (totalMessages > 0) {
    const start = Math.max(1, totalMessages - limit + 1);
    const end = totalMessages;

    for await (const message of imap.fetch(`${start}:${end}`, { envelope: true, flags: true })) {
      const emailHeader = processEmailMessage(message);
      if (emailHeader !== null) {
        initialEmails.push(emailHeader);
      }
    }
  }

  return initialEmails;
}

/**
 * Register IMAP connection and mailbox handlers
 */
function registerImapConnectionHandlers(
  ipcMain: IpcMain,
  webContents: WebContents,
  logger: Logger,
  sendConnectionStatus: SendConnectionStatusFn
): void {
  // This handler starts a background watch on an account's INBOX.
  ipcMain.handle('imap:watch-inbox', async (_event, accountId: string) => {
    try {
      const imap = await getOrCreateConnection(accountId, logger, sendConnectionStatus);

      // Don't create a new watcher if one already exists for this account.
      if (mailboxWatchers.has(accountId)) {
        return;
      }

      const inboxPath = await findInboxPath(imap);
      const lock = await imap.getMailboxLock(inboxPath);
      
      let messageCount = (typeof imap.mailbox === 'object' && imap.mailbox !== null && typeof imap.mailbox.exists === 'number') ? imap.mailbox.exists : 0;

      const listener = (newCount: number): void => {
        if (newCount > messageCount) {
          const newMailCount = newCount - messageCount;
          logger.info(`📬 Account ${accountId} has ${newMailCount} new email(s) in INBOX!`);
          webContents.send('mail:new', { accountId, mailboxName: inboxPath, newMailCount });
        }
        messageCount = newCount;
      };

      imap.on('exists', listener);
      
      mailboxWatchers.set(accountId, { release: () => lock.release(), listener });
      logger.info(`Started watching INBOX for account ${accountId}.`);

    } catch (error) {
      logger.error(`Failed to start watching INBOX for ${accountId}: ${(error as Error).message}`);
    }
  });

  // This single handler now manages selecting a mailbox, fetching initial emails, and watching for new ones.
  ipcMain.handle('imap:select-mailbox', async (_event, accountId: string, mailboxName: string, limit: number) => {
    try {
      logger.info(`🔍 DIAGNOSTIC: Selecting mailbox ${mailboxName} for account ${accountId} with limit ${limit}`);
      const imap = await getOrCreateConnection(accountId, logger, sendConnectionStatus);

      // We only need a short-term lock for fetching, no more IDLE here.
      const lock = await imap.getMailboxLock(mailboxName);
      logger.info(`🔍 DIAGNOSTIC: Acquired mailbox lock for ${mailboxName}`);

      try {
        const initialEmails = await fetchInitialEmails(imap, mailboxName, limit, logger);
        logger.info(`🔍 DIAGNOSTIC: Fetched ${initialEmails.length} emails before reversing`);
        initialEmails.reverse(); // Show newest first
        const totalCount = (typeof imap.mailbox === 'object' && imap.mailbox !== null && typeof imap.mailbox.exists === 'number') ? imap.mailbox.exists : 0;
        logger.info(`🔍 DIAGNOSTIC: Successfully fetched ${initialEmails.length} emails from ${mailboxName} (${totalCount} total)`);
        logger.info(`🔍 DIAGNOSTIC: Returning result: { emails: ${initialEmails.length} items, totalCount: ${totalCount} }`);
        return { emails: initialEmails, totalCount };
      } finally {
        // Release the lock immediately after fetching.
        lock.release();
        logger.info(`🔍 DIAGNOSTIC: Released mailbox lock for ${mailboxName}`);
      }

    } catch (error) {
      const errorMessage = `Failed to select mailbox ${mailboxName}: ${(error as Error).message}`;
      logger.error(`🔍 DIAGNOSTIC: ERROR in select-mailbox: ${errorMessage}`);
      // Return empty result instead of throwing to prevent UI crashes
      return { emails: [], totalCount: 0 };
    }
  });
}

/**
 * Register IMAP mailbox and email fetching handlers
 */
function registerImapMailboxHandlers(
  ipcMain: IpcMain,
  logger: Logger,
  sendConnectionStatus: SendConnectionStatusFn
): void {
  ipcMain.handle('imap:getMailboxes', async (_event: IpcMainInvokeEvent, accountId: string) => {
    try {
      logger.info(`🔍 DIAGNOSTIC: Getting mailboxes for account ${accountId}`);
      const imap = await getOrCreateConnection(accountId, logger, sendConnectionStatus);

      // Verify connection is still usable right before using it
      if (!imap.usable) {
        throw new Error('Connection not available');
      }

      logger.info('🔍 DIAGNOSTIC: Fetching mailboxes...');
      const mailboxes = await fetchMailboxes(imap) as ImapMailbox[];
      logger.info(`🔍 DIAGNOSTIC: Found ${mailboxes.length} mailboxes`);

      // Преобразуем формат mailboxes для совместимости с существующим кодом
      const mailboxesTree: MailBoxes = {};

      for (const mailbox of mailboxes) {
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
            currentLevel[part].attribs = Array.from(mailbox.flags ?? []);
            if (currentLevel[part].children === undefined) {
              currentLevel[part].children = {};
            }
          }

          if (currentLevel[part].children !== null && currentLevel[part].children !== undefined) {
            currentLevel = currentLevel[part].children;
          }
        }
      }

      logger.info('🔍 DIAGNOSTIC: Mailboxes fetched successfully.');
      logger.info(`🔍 DIAGNOSTIC: Returning mailboxes tree with ${Object.keys(mailboxesTree).length} top-level folders`);
      return mailboxesTree;
    } catch (error) {
      const errorMessage = `Failed to fetch mailboxes: ${(error as Error).message}`;
      logger.error(`🔍 DIAGNOSTIC: ERROR in getMailboxes: ${errorMessage}`);
      // Throw error instead of returning empty object to let UI handle it properly
      throw new Error(errorMessage);
    }
  });

  ipcMain.handle('imap:getEmails', async (_event: IpcMainInvokeEvent, accountId: string, mailboxName: string, offset: number, limit: number) => {
    const imap = imapFlowConnectionManager.get(accountId);
    if (!imap) {
      // eslint-disable-next-line no-console
      console.error(`No active connection found for account ${accountId}`);
      return [];
    }

    try {
      const emails = await fetchEmails(imap, mailboxName, offset, limit);
      return emails;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Failed to fetch emails for ${accountId} from ${mailboxName}:`, error);
      return []; // Return empty array on error
    }
  });

  // New handler for coordinated account initialization
  ipcMain.handle('imap:initialize-account', async (_event: IpcMainInvokeEvent, accountId: string, initialEmailLimit: number = 50) => {
    try {
      logger.info(`Initializing account data for ${accountId}`);

      // Get or create connection
      let imap = imapFlowConnectionManager.get(accountId);
      if (!imap || !imap.usable) {
        logger.info('Creating new connection for account initialization...');
        imap = await getOrCreateConnection(accountId, logger, sendConnectionStatus);
      }

      // Double-check connection is usable before proceeding
      if (!imap || !imap.usable) {
        throw new Error('Connection not available');
      }

      logger.info('Fetching account data (mailboxes + initial emails)...');
      const result = await initializeAccountData(imap, initialEmailLimit);

      logger.info(`Account initialized: ${Object.keys(result.mailboxes).length} mailboxes, ${result.initialEmails.length} initial emails from ${result.defaultMailbox}`);
      return result;
    } catch (error) {
      const errorMessage = `Failed to initialize account: ${(error as Error).message}`;
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }
  });
}

/**
 * Register IMAP email operation handlers
 */
function registerImapEmailHandlers(
  ipcMain: IpcMain,
  logger: Logger
): void {
  ipcMain.handle('imap:getEmailBody', async (_event: IpcMainInvokeEvent, accountId: string, mailboxName: string, emailUid: number) => {
    const imap = imapFlowConnectionManager.get(accountId);
    if (!imap) {
      logger.error({ accountId }, `No active connection found for account ${accountId}`);
      return null;
    }

    try {
      const logFn = (message: string, level: 'info' | 'success' | 'error' = 'info'): void => {
        const pinoLevel = level === 'success' ? 'info' : level;
        logger[pinoLevel](message);
      };
      const email = await fetchEmailBody(imap, mailboxName, emailUid, logFn);
      return email;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Failed to fetch email body for UID ${emailUid}:`, error);
      throw error;
    }
  });

  // Add attachment download handler
  ipcMain.handle('imap:downloadAttachment', async (_event: IpcMainInvokeEvent, accountId: string, mailboxName: string, emailUid: number, attachmentIndex: number) => {
    const imap = imapFlowConnectionManager.get(accountId);
    if (!imap) {
      // eslint-disable-next-line no-console
      console.error(`No active connection found for account ${accountId}`);
      return null;
    }

    try {
      const logFn = (message: string, level: 'info' | 'success' | 'error' = 'info'): void => {
        const pinoLevel = level === 'success' ? 'info' : level;
        logger[pinoLevel](message);
      };
      const email = await fetchEmailBody(imap, mailboxName, emailUid, logFn);

      if (email && typeof email === 'object' && 'attachments' in email && Array.isArray(email.attachments)) {
        const attachment = email.attachments[attachmentIndex];
        if (attachment && attachment.content) {
          return {
            filename: attachment.filename || `attachment_${attachmentIndex}`,
            contentType: attachment.contentType,
            content: attachment.content,
            size: attachment.size
          };
        }
      }

      throw new Error('Attachment not found');
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Failed to download attachment for UID ${emailUid}:`, error);
      throw error;
    }
  });

  ipcMain.handle('imap:deleteEmail', async (_event: IpcMainInvokeEvent, accountId: string, mailboxName: string, emailUid: number) => {
    const imap = imapFlowConnectionManager.get(accountId);
    if (!imap) {
      // eslint-disable-next-line no-console
      console.error(`No active connection found for account ${accountId}`);
      return;
    }

    try {
      await deleteEmailIMAP(imap, mailboxName, emailUid);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Failed to delete email UID ${emailUid}:`, error);
      throw error;
    }
  });

  ipcMain.handle('imap:markAsSeen', async (_event: IpcMainInvokeEvent, accountId: string, mailboxName: string, emailUid: number) => {
    const imap = imapFlowConnectionManager.get(accountId);
    if (!imap) return;
    try {
      await markAsSeenIMAP(imap, mailboxName, emailUid);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Failed to mark email UID ${emailUid} as seen:`, error);
      throw error;
    }
  });

  ipcMain.handle('imap:markAsUnseen', async (_event: IpcMainInvokeEvent, accountId: string, mailboxName: string, emailUid: number) => {
    const imap = imapFlowConnectionManager.get(accountId);
    if (!imap) return;
    try {
      await markAsUnseenIMAP(imap, mailboxName, emailUid);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Failed to mark email UID ${emailUid} as unseen:`, error);
      throw error;
    }
  });

  ipcMain.handle('imap:deleteEmails', async (_event: IpcMainInvokeEvent, accountId: string, mailboxName: string, emailUids: number[]) => {
    const imap = imapFlowConnectionManager.get(accountId);
    if (!imap) {
      // eslint-disable-next-line no-console
      console.error(`No active connection found for account ${accountId}`);
      return { success: false, error: 'No active connection' };
    }
    try {
      await deleteEmailsIMAP(imap, mailboxName, emailUids);
      return { success: true };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Failed to delete emails with UIDs ${emailUids}:`, error);
      return { success: false, error: (error as Error).message };
    }
  });
}

/**
 * Main function to register all IMAP handlers
 */
export const registerImapFlowHandlers = (
  ipcMain: IpcMain,
  webContents: WebContents,
  logger: Logger,
  sendConnectionStatus: SendConnectionStatusFn
): void => {
  registerImapConnectionHandlers(ipcMain, webContents, logger, sendConnectionStatus);
  registerImapMailboxHandlers(ipcMain, logger, sendConnectionStatus);
  registerImapEmailHandlers(ipcMain, logger);
};