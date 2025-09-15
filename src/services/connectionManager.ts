/**
 * @file Simple IMAP connection manager
 */

import type { ImapFlow } from 'imapflow';
import { getLogger } from './logger';

const activeConnections = new Map<string, ImapFlow>();
const pendingConnections = new Set<string>();
const pendingConnectionPromises = new Map<string, Promise<ImapFlow>>();

export const imapFlowConnectionManager = {
  get(accountId: string): ImapFlow | undefined {
    const imap = activeConnections.get(accountId);
    if (!imap) {
      return undefined;
    }

    // Check if connection is still usable
    if (imap.usable === true) {
      return imap;
    }

    // Remove unusable connection
    activeConnections.delete(accountId);
    return undefined;
  },

  has(accountId: string): boolean {
    const imap = activeConnections.get(accountId);
    return imap ? imap.usable === true : false;
  },

  set(accountId: string, imap: ImapFlow): void {
    const logger = getLogger();
    const existingConnection = activeConnections.get(accountId);
    
    if (existingConnection && existingConnection !== imap && existingConnection.usable) {
      existingConnection.logout().catch((err: Error) => {
        logger.error({ accountId, error: err.message }, `Error logging out existing connection for ${accountId}`);
        existingConnection.close();
      });
    }

    activeConnections.set(accountId, imap);
    logger.debug({ accountId }, `Set connection for account ${accountId}`);
  },

  async end(accountId: string): Promise<void> {
    const imap = activeConnections.get(accountId);
    if (imap) {
      try {
        if (imap.usable) {
          await imap.logout();
        } else {
          imap.close();
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`Error closing connection for ${accountId}:`, err);
        imap.close();
      } finally {
        activeConnections.delete(accountId);
        // eslint-disable-next-line no-console
        console.log(`Closed connection for account ${accountId}`);
      }
    }
  },

  async endAll(): Promise<void> {
    const closePromises = Array.from(activeConnections.entries()).map(
      async ([accountId, imap]) => {
        try {
          // eslint-disable-next-line no-console
          console.log(`Closing connection for ${accountId}`);
          if (imap.usable) {
            await imap.logout();
          } else {
            imap.close();
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error(`Error closing connection for ${accountId}:`, err);
          imap.close();
        }
      }
    );

    await Promise.allSettled(closePromises);
    activeConnections.clear();
    pendingConnections.clear();
    // eslint-disable-next-line no-console
    console.log('All active IMAP connections have been closed.');
  },

  // Pending connection management
  addPendingConnection(accountId: string): void {
    pendingConnections.add(accountId);
  },

  removePendingConnection(accountId: string): void {
    pendingConnections.delete(accountId);
  },

  hasPendingConnection(accountId: string): boolean {
    return pendingConnections.has(accountId);
  },

  setPendingConnection(accountId: string, connectionPromise: Promise<ImapFlow>): void {
    pendingConnections.add(accountId);
    pendingConnectionPromises.set(accountId, connectionPromise);

    // Clean up when promise resolves and store successful connection
    connectionPromise
      .then((imap) => {
        // Store successful connection
        activeConnections.set(accountId, imap);
        const logger = getLogger();
        logger.debug({ accountId }, `Stored connection for account ${accountId} from pending promise`);
      })
      .catch(() => {
        // Connection failed, just clean up
      })
      .finally(() => {
        pendingConnections.delete(accountId);
        pendingConnectionPromises.delete(accountId);
      });
  },

  async getOrWaitForConnection(accountId: string): Promise<ImapFlow | null> {
    const pendingPromise = pendingConnectionPromises.get(accountId);
    if (pendingPromise) {
      try {
        return await pendingPromise;
      } catch (error) {
        return null;
      }
    }
    return null;
  },
};
