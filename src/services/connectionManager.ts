/**
 * @file Simple IMAP connection manager
 */

import type { ImapFlow } from 'imapflow'

import { getLogger } from './logger'

const activeConnections = new Map<string, ImapFlow>()
const pendingConnectionPromises = new Map<string, Promise<ImapFlow>>()

export const imapFlowConnectionManager = {
  get(accountId: string): ImapFlow | undefined {
    const imap = activeConnections.get(accountId)
    if (imap?.usable) {
      return imap
    }
    if (imap) {
      const logger = getLogger()
      logger.warn({ accountId }, `Removing unusable connection for account ${accountId}`)
      activeConnections.delete(accountId)
    }
    return undefined
  },

  has(accountId: string): boolean {
    return this.get(accountId) !== undefined
  },

  set(accountId: string, imap: ImapFlow): void {
    const logger = getLogger()

    // Validate the connection before storing it
    if (!imap?.usable) {
      logger.warn({ accountId }, `Attempted to store unusable connection for account ${accountId}`)
      return
    }

    const existing = this.get(accountId)
    if (existing && existing !== imap) {
      logger.debug({ accountId }, `Replacing existing connection for account ${accountId}`)
      existing.logout().catch((err: Error) => {
        logger.error(
          { accountId, error: err.message },
          `Error logging out existing connection for ${accountId}`
        )
        existing.close()
      })
    }

    activeConnections.set(accountId, imap)
    logger.debug({ accountId }, `Set connection for account ${accountId}`)
  },

  async end(accountId: string): Promise<void> {
    const logger = getLogger()
    const imap = activeConnections.get(accountId)
    if (imap) {
      activeConnections.delete(accountId)
      try {
        if (imap.usable) {
          await imap.logout()
          logger.info(`Closed connection for account ${accountId}`)
        } else {
          imap.close()
          logger.info(`Force-closed unusable connection for account ${accountId}`)
        }
      } catch (err) {
        logger.error(
          { accountId, error: (err as Error).message },
          `Error closing connection for ${accountId}`
        )
        imap.close() // Ensure it's closed even on logout error
      }
    }
    pendingConnectionPromises.delete(accountId)
  },

  async endAll(): Promise<void> {
    const logger = getLogger()
    logger.info('Closing all active IMAP connections.')
    const closePromises = Array.from(activeConnections.keys()).map(id => this.end(id))
    await Promise.allSettled(closePromises)
    logger.info('All active IMAP connections have been closed.')
  },

  setPendingConnection(accountId: string, connectionPromise: Promise<ImapFlow>): void {
    const logger = getLogger()

    // Clear any existing pending connection
    if (pendingConnectionPromises.has(accountId)) {
      logger.debug({ accountId }, `Replacing existing pending connection for account ${accountId}`)
    }

    pendingConnectionPromises.set(accountId, connectionPromise)
    logger.debug({ accountId }, `Set pending connection promise for account ${accountId}`)

    connectionPromise
      .then(imap => {
        // Validate connection before storing
        if (imap?.usable) {
          this.set(accountId, imap)
          logger.debug(
            { accountId },
            `Stored connection for account ${accountId} from pending promise`
          )
        } else {
          logger.warn(
            { accountId },
            `Pending connection resolved with unusable IMAP for account ${accountId}`
          )
        }
      })
      .catch(error => {
        logger.warn(
          { accountId, error: error instanceof Error ? error.message : String(error) },
          `Pending connection failed for account ${accountId}`
        )
        // Remove any partial connection state
        activeConnections.delete(accountId)
      })
      .finally(() => {
        pendingConnectionPromises.delete(accountId)
        logger.debug(
          { accountId },
          `Cleaned up pending connection promise for account ${accountId}`
        )
      })
  },

  async getOrWaitForConnection(accountId: string): Promise<ImapFlow | null> {
    const pendingPromise = pendingConnectionPromises.get(accountId)
    if (pendingPromise) {
      try {
        return await pendingPromise
      } catch (_error) {
        return null
      }
    }
    return null
  },

  hasPendingConnection(accountId: string): boolean {
    return pendingConnectionPromises.has(accountId)
  },
}
