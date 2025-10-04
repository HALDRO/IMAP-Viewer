import { type BrowserWindow, type IpcMain, type IpcMainInvokeEvent, dialog } from 'electron'
import type { Logger } from 'pino'

import {
  addAccount,
  addAccounts,
  getAccounts,
  removeAccount,
  setAccounts,
  updateAccount,
} from '../services/accountService'
import { type DiscoveredConfig, discoverEmailConfig } from '../services/autoDiscoveryService'
import { imapFlowConnectionManager } from '../services/connectionManager'
import { getDomains, removeDomain, saveDomain } from '../services/domainService'
import { importFromContent, importFromFile } from '../services/instantImportService'
import type { Account } from '../shared/types/account'

/**
 * A wrapper for discoverEmailConfig that caches results in domains.txt.
 */
async function getEmailConfig(
  domain: string,
  logger: Logger,
  force = false
): Promise<DiscoveredConfig | null> {
  logger.info(`getEmailConfig called for ${domain} with force=${force}`)
  const savedDomains = await getDomains()

  // 1. Check our saved domains first (skip if force is true)
  if (
    !force &&
    domain in savedDomains &&
    savedDomains[domain] !== null &&
    savedDomains[domain] !== undefined
  ) {
    logger.info(`Found saved config for ${domain}`)
    // No need to parse JSON anymore, getDomains returns a parsed object
    return savedDomains[domain]
  }

  // 2. If not found or force is true, run auto-discovery
  if (force) {
    logger.info(`Force discovery requested for ${domain}. Running auto-discovery...`)
  } else {
    logger.info(`No saved config for ${domain}. Running auto-discovery...`)
  }
  const config = await discoverEmailConfig(domain, logger, { force })

  // 3. Save the result for next time
  if (config) {
    logger.info(`Successfully discovered config for ${domain}. Saving...`)
    // Pass the raw config object to saveDomain, casting it to ensure compatibility
    await saveDomain(domain, config)
  }

  return config
}

/**
 * Register discovery and domain handlers
 */
function registerDiscoveryHandlers(ipcMain: IpcMain, logger: Logger): void {
  ipcMain.handle(
    'discover:email-config',
    async (_event: IpcMainInvokeEvent, domain: string, force = false) => {
      // This handler now uses our caching wrapper
      logger.info(`IPC discover:email-config called for ${domain} with force=${force}`)
      return getEmailConfig(domain, logger, force)
    }
  )

  ipcMain.handle('domains:get', async () => {
    return await getDomains()
  })

  ipcMain.handle(
    'domains:save',
    async (_event: IpcMainInvokeEvent, domain: string, config: DiscoveredConfig) => {
      await saveDomain(domain, config)
      logger.info(`Saved domain configuration for: ${domain}`)
      return { success: true }
    }
  )

  ipcMain.handle('domains:remove', async (_event: IpcMainInvokeEvent, domain: string) => {
    await removeDomain(domain)
    logger.info(`Removed domain configuration for: ${domain}`)
    return { success: true }
  })
}

/**
 * Register basic account CRUD handlers
 */
function registerAccountCrudHandlers(ipcMain: IpcMain, logger: Logger): void {
  ipcMain.handle('accounts:get', async () => {
    logger.info('[IPC] IPC accounts:get handler called [IPC]')
    const accounts = await getAccounts()
    logger.info(`[IPC] IPC accounts:get returning accounts: ${accounts.length} accounts`)
    return accounts
  })

  ipcMain.handle('accounts:get-by-id', async (_event: IpcMainInvokeEvent, accountId: string) => {
    const accounts = await getAccounts()
    return accounts.find(acc => acc.id === accountId) || null
  })

  ipcMain.handle(
    'accounts:add',
    async (_event: IpcMainInvokeEvent, accountData: Omit<Account, 'id'>) => {
      logger.info({ accountData }, 'IPC accounts:add called')

      // Save custom IMAP settings to domains.txt for future use
      const domain = accountData.email.split('@')[1]
      if (
        (domain?.length ?? 0) > 0 &&
        accountData.incoming !== null &&
        accountData.incoming !== undefined
      ) {
        // Don't save example domains or configurations with example hosts
        if (
          domain.includes('example.com') ||
          domain.includes('example.org') ||
          accountData.incoming.host.includes('example.com') ||
          accountData.incoming.host.includes('example.org')
        ) {
        } else {
          const savedDomains = await getDomains()

          // Check if this domain doesn't exist in our saved domains or has different settings
          const existingConfig = savedDomains[domain]
          const currentConfig: DiscoveredConfig = {}

          // Build current config from account data
          if (accountData.incoming !== null && accountData.incoming !== undefined) {
            currentConfig.imap = {
              host: accountData.incoming.host,
              port: accountData.incoming.port,
              secure: accountData.incoming.useTls,
            }
          }

          if (accountData.outgoing) {
            currentConfig.smtp = {
              host: accountData.outgoing.host,
              port: accountData.outgoing.port,
              secure: accountData.outgoing.useTls,
            }
          }

          // Save if domain doesn't exist or settings are different
          const shouldSave =
            existingConfig === null ||
            existingConfig === undefined ||
            (currentConfig.imap !== null &&
              currentConfig.imap !== undefined &&
              (existingConfig.imap === null ||
                existingConfig.imap === undefined ||
                existingConfig.imap.host !== currentConfig.imap.host ||
                existingConfig.imap.port !== currentConfig.imap.port ||
                existingConfig.imap.secure !== currentConfig.imap.secure))

          if (shouldSave === true) {
            logger.info(`Saving custom IMAP settings for domain: ${domain}`)
            await saveDomain(domain, currentConfig)
          }
        }
      }

      logger.info(`Adding account: ${accountData.email}`)
      const result = await addAccount({
        ...accountData,
        authType: accountData.authType,
        clientId: accountData.clientId,
        refreshToken: accountData.refreshToken,
        accessToken: accountData.accessToken,
        accessTokenExpiry: accountData.accessTokenExpiry,
      })
      logger.info({ account: result }, 'addAccount returned')
      return result
    }
  )

  ipcMain.handle(
    'accounts:update',
    async (
      _event: IpcMainInvokeEvent,
      accountId: string,
      accountData: Partial<Omit<Account, 'id'>>
    ) => {
      logger.info({ accountId, accountData }, 'IPC accounts:update called')

      const updatedAccount = await updateAccount(accountId, accountData)
      if (!updatedAccount) {
        throw new Error('Failed to find account to update.')
      }

      logger.info({ updatedAccount }, 'IPC accounts:update returning')
      return updatedAccount
    }
  )

  ipcMain.handle('accounts:delete', async (_event: IpcMainInvokeEvent, accountId: string) => {
    try {
      await removeAccount(accountId)
      void imapFlowConnectionManager.end(accountId)
      return { success: true }
    } catch (error) {
      logger.error({ accountId, error }, 'Failed to delete account')
      throw new Error('Failed to delete account from store.')
    }
  })

  ipcMain.handle('accounts:delete-all', async (_event: IpcMainInvokeEvent) => {
    try {
      logger.info('IPC accounts:delete-all called')
      // Clear all accounts from file by setting empty array
      await setAccounts([])
      // End all IMAP connections
      const accounts = await getAccounts()
      for (const account of accounts) {
        void imapFlowConnectionManager.end(account.id)
      }
      logger.info('All accounts deleted from file and connections closed')
      return { success: true }
    } catch (error) {
      logger.error({ error }, 'Failed to delete all accounts')
      throw new Error('Failed to delete all accounts from store.')
    }
  })
}

/**
 * Register file import handlers
 */

/**
 * Register preview and instant import handlers
 */

/**
 * Register instant import handlers
 */
function registerInstantImportHandlers(
  ipcMain: IpcMain,
  mainWindow: BrowserWindow,
  logger: Logger
): void {
  // Instant import - adds accounts immediately and discovers DNS in background
  ipcMain.handle('accounts:import-from-file-instant', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Accounts (Instant)',
      buttonLabel: 'Import',
      properties: ['openFile'],
      filters: [
        { name: 'Text Files', extensions: ['txt', 'csv'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    })

    if (canceled || filePaths.length === 0) {
      return { success: false, error: 'File selection canceled.' }
    }

    try {
      logger.info('Starting instant import...')
      const result = await importFromFile(filePaths[0], email =>
        getEmailConfig(email.split('@')[1], logger)
      )

      if (result.success) {
        logger.info(
          `Instantly imported ${result.addedCount} accounts. DNS discovery running in background.`
        )
      } else {
        logger.error(`Instant import failed: ${result.error}`)
      }

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Instant import failed'
      logger.error(`Instant import failed: ${errorMessage}`)
      return { success: false, error: errorMessage }
    }
  })
}

/**
 * Register drag-and-drop import handlers
 */
function registerDragDropImportHandlers(ipcMain: IpcMain, logger: Logger): void {
  // Import from specific file path (for drag-and-drop)
  ipcMain.handle(
    'accounts:import-from-file-data',
    async (_event: IpcMainInvokeEvent, filePath: string) => {
      try {
        logger.info('Starting file import...')
        const result = await importFromFile(filePath, email =>
          getEmailConfig(email.split('@')[1], logger)
        )

        if (result.success) {
          logger.info(
            `Imported ${result.addedCount} accounts from dropped file. DNS discovery running in background.`
          )
        } else {
          logger.error(`File import failed: ${result.error}`)
        }

        return result
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'File import failed'
        logger.error(`File import failed: ${errorMessage}`)
        return { success: false, error: errorMessage }
      }
    }
  )

  // Import from file content (for drag-and-drop)
  ipcMain.handle(
    'accounts:import-from-file-content',
    async (_event: IpcMainInvokeEvent, content: string) => {
      try {
        logger.info('Starting content import...')
        const result = await importFromContent(content, email =>
          getEmailConfig(email.split('@')[1], logger)
        )

        if (result.success) {
          logger.info(
            `Imported ${result.addedCount} accounts from dropped content. DNS discovery running in background.`
          )
        } else {
          logger.error(`Content import failed: ${result.error}`)
        }

        return result
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Content import failed'
        logger.error(`Content import failed: ${errorMessage}`)
        return { success: false, error: errorMessage }
      }
    }
  )
}

/**
 * Main function to register all account handlers
 */
export const registerAccountHandlers = (
  ipcMain: IpcMain,
  mainWindow: BrowserWindow,
  logger: Logger
): void => {
  registerDiscoveryHandlers(ipcMain, logger)
  registerAccountCrudHandlers(ipcMain, logger)
  registerInstantImportHandlers(ipcMain, mainWindow, logger)
  registerDragDropImportHandlers(ipcMain, logger)
}
