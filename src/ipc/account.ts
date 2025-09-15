import fs from 'fs';
import readline from 'readline';

import { dialog, type IpcMain, type IpcMainInvokeEvent, type BrowserWindow } from 'electron';

import { AccountImportService, type EmailServerConfig } from '../services/accountImportService';
import { discoverEmailConfig, type DiscoveredConfig } from '../services/autoDiscoveryService';
import { imapFlowConnectionManager } from '../services/connectionManager';
import { InstantImportService } from '../services/instantImportService';
import {
    getAccounts,
    addAccount,
    updateAccount,
    removeAccount,
    addAccounts,
    setAccounts,
    getDomains,
    saveDomain,
    removeDomain
} from '../services/storeService';
import type { Account } from '../shared/types/account';
import type { Logger } from 'pino';


/**
 * Convert DiscoveredConfig to EmailServerConfig format
 */
function convertToEmailServerConfig(config: DiscoveredConfig | null): EmailServerConfig | null {
    if (!config) return null;

    return {
        imap: config.imap ? {
            host: config.imap.host,
            port: config.imap.port,
            secure: config.imap.secure
        } : undefined,
        smtp: config.smtp ? {
            host: config.smtp.host,
            port: config.smtp.port,
            secure: config.smtp.secure
        } : undefined
    };
}

/**
 * A wrapper for discoverEmailConfig that caches results in domains.txt.
 */
async function getEmailConfig(domain: string, logger: Logger, force: boolean = false): Promise<DiscoveredConfig | null> {
    logger.info(`getEmailConfig called for ${domain} with force=${force}`);
    const savedDomains = await getDomains();

    // 1. Check our saved domains first (skip if force is true)
    if (!force && domain in savedDomains && savedDomains[domain] !== null && savedDomains[domain] !== undefined) {
        logger.info(`Found saved config for ${domain}`);
        // No need to parse JSON anymore, getDomains returns a parsed object
        return savedDomains[domain];
    }

    // 2. If not found or force is true, run auto-discovery
    if (force) {
        logger.info(`Force discovery requested for ${domain}. Running auto-discovery...`);
    } else {
        logger.info(`No saved config for ${domain}. Running auto-discovery...`);
    }
    const config = await discoverEmailConfig(domain, logger as any, { force });

    // 3. Save the result for next time
    if (config) {
        logger.info(`Successfully discovered config for ${domain}. Saving...`);
        // Pass the raw config object to saveDomain, casting it to ensure compatibility
        await saveDomain(domain, config);
    }

    return config;
}

/**
 * Register discovery and domain handlers
 */
function registerDiscoveryHandlers(ipcMain: IpcMain, logger: Logger): void {
    ipcMain.handle('discover:email-config', async (_event: IpcMainInvokeEvent, domain: string, force: boolean = false) => {
        // This handler now uses our caching wrapper
        logger.info(`IPC discover:email-config called for ${domain} with force=${force}`);
        return getEmailConfig(domain, logger, force);
    });

    ipcMain.handle('domains:get', async () => {
        return await getDomains();
    });

    ipcMain.handle('domains:save', async (_event: IpcMainInvokeEvent, domain: string, config: DiscoveredConfig) => {
        await saveDomain(domain, config);
        logger.info(`Saved domain configuration for: ${domain}`);
        return { success: true };
    });

    ipcMain.handle('domains:remove', async (_event: IpcMainInvokeEvent, domain: string) => {
        await removeDomain(domain);
        logger.info(`Removed domain configuration for: ${domain}`);
        return { success: true };
    });
}

/**
 * Register basic account CRUD handlers
 */
function registerAccountCrudHandlers(ipcMain: IpcMain, logger: Logger): void {
    ipcMain.handle('accounts:get', async () => {
        logger.info('🔥 IPC accounts:get handler called 🔥');
        const accounts = await getAccounts();
        logger.info(`🔥 IPC accounts:get returning accounts: ${accounts.length} accounts`);
        return accounts;
    });

    ipcMain.handle('accounts:get-by-id', async (_event: IpcMainInvokeEvent, accountId: string) => {
        const accounts = await getAccounts();
        return accounts.find(acc => acc.id === accountId) || null;
    });

    ipcMain.handle('accounts:add', async (_event: IpcMainInvokeEvent, accountData: Omit<Account, 'id'>) => {
        logger.info({ accountData }, 'IPC accounts:add called');

        // Save custom IMAP settings to domains.txt for future use
        const domain = accountData.email.split('@')[1];
        if ((domain?.length ?? 0) > 0 && accountData.incoming !== null && accountData.incoming !== undefined) {
            // Don't save example domains or configurations with example hosts
            if (domain.includes('example.com') || domain.includes('example.org') ||
                accountData.incoming.host.includes('example.com') || accountData.incoming.host.includes('example.org')) {
                console.log('Skipping domain save for example domain/host:', domain, accountData.incoming.host);
            } else {
                const savedDomains = await getDomains();

                // Check if this domain doesn't exist in our saved domains or has different settings
                const existingConfig = savedDomains[domain];
                const currentConfig: DiscoveredConfig = {};

            // Build current config from account data
            if (accountData.incoming !== null && accountData.incoming !== undefined) {
                currentConfig.imap = {
                    host: accountData.incoming.host,
                    port: accountData.incoming.port,
                    secure: accountData.incoming.useTls
                };
            }

            if (accountData.outgoing) {
                currentConfig.smtp = {
                    host: accountData.outgoing.host,
                    port: accountData.outgoing.port,
                    secure: accountData.outgoing.useTls
                };
            }

            // Save if domain doesn't exist or settings are different
            const shouldSave = existingConfig === null || existingConfig === undefined ||
                (currentConfig.imap !== null && currentConfig.imap !== undefined &&
                 (existingConfig.imap === null || existingConfig.imap === undefined ||
                    existingConfig.imap.host !== currentConfig.imap.host ||
                    existingConfig.imap.port !== currentConfig.imap.port ||
                    existingConfig.imap.secure !== currentConfig.imap.secure));

                if (shouldSave === true) {
                    logger.info(`Saving custom IMAP settings for domain: ${domain}`);
                    await saveDomain(domain, currentConfig);
                }
            }
        }

        logger.info(`Adding account: ${accountData.email}`);
        const result = await addAccount({
            ...accountData,
            authType: accountData.authType,
            clientId: accountData.clientId,
            refreshToken: accountData.refreshToken,
            accessToken: accountData.accessToken,
            accessTokenExpiry: accountData.accessTokenExpiry,
        });
        logger.info({ account: result }, 'addAccount returned');
        return result;
    });

    ipcMain.handle('accounts:update', async (_event: IpcMainInvokeEvent, accountId: string, accountData: Partial<Omit<Account, 'id'>>) => {
        logger.info({ accountId, accountData }, 'IPC accounts:update called');

        const updatedAccount = await updateAccount(accountId, accountData);
        if (!updatedAccount) {
            throw new Error('Failed to find account to update.');
        }

        logger.info({ updatedAccount }, 'IPC accounts:update returning');
        return updatedAccount;
    });

    ipcMain.handle('accounts:delete', async (_event: IpcMainInvokeEvent, accountId: string) => {
        try {
            await removeAccount(accountId);
            void imapFlowConnectionManager.end(accountId);
            return { success: true };
        } catch (error) {
            logger.error({ accountId, error }, 'Failed to delete account');
            throw new Error('Failed to delete account from store.');
        }
    });

    ipcMain.handle('accounts:delete-all', async (_event: IpcMainInvokeEvent) => {
        try {
            logger.info('IPC accounts:delete-all called');
            // Clear all accounts from file by setting empty array
            await setAccounts([]);
            // End all IMAP connections
            const accounts = await getAccounts();
            for (const account of accounts) {
                void imapFlowConnectionManager.end(account.id);
            }
            logger.info('All accounts deleted from file and connections closed');
            return { success: true };
        } catch (error) {
            logger.error({ error }, 'Failed to delete all accounts');
            throw new Error('Failed to delete all accounts from store.');
        }
    });
}

/**
 * Register file import handlers
 */
function registerFileImportHandlers(ipcMain: IpcMain, mainWindow: BrowserWindow, logger: Logger): void {
    ipcMain.handle('accounts:import-from-file', async () => {
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
            title: 'Import Accounts',
            buttonLabel: 'Import',
            properties: ['openFile'],
            filters: [{ name: 'Text Files', extensions: ['txt', 'csv'] }],
        });

        if (canceled || filePaths.length === 0) {
            return { addedCount: 0, skippedCount: 0, error: 'File selection canceled.' };
        }

        const filePath = filePaths[0];
        const fileStream = fs.createReadStream(filePath);
        const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

        let skippedCount = 0;
        const accountsToAdd: Omit<Account, 'id' | 'connectionStatus'>[] = [];
        const separatorRegex = /[:;|]/;

        for await (const line of rl) {
            const parts = line.split(separatorRegex);

            if (parts.length < 2) {
                skippedCount++;
                continue;
            }

            const email = parts[0].trim();
            const password = parts.slice(1).join(parts[0].match(separatorRegex)?.[0] ?? '').trim();

            if (/^\S+@\S+\.\S+$/.test(email) && (password?.length ?? 0) > 0) {
                accountsToAdd.push({
                    displayName: email.split('@')[0],
                    email,
                    password,
                    incoming: { protocol: 'imap', host: 'imap.example.com', port: 993, useTls: true },
                    useProxy: false,
                });
            } else {
                skippedCount++;
            }
        }

        logger.info(`Parsed ${accountsToAdd.length} accounts. Starting server configuration discovery...`);

        const configuredAccountsPromises = accountsToAdd.map(async (accountData) => {
            try {
                // Extract domain from email for caching
                const domain = accountData.email.split('@')[1];
                const config = await getEmailConfig(domain, logger);
                if (config?.imap) {
                    accountData.incoming = {
                        protocol: 'imap',
                        host: config.imap.host,
                        port: config.imap.port,
                        useTls: config.imap.secure,
                    };
                    if (config.smtp) {
                        accountData.outgoing = {
                            protocol: 'smtp',
                            host: config.smtp.host,
                            port: config.smtp.port,
                            useTls: config.smtp.secure,
                        };
                    } else {
                        delete accountData.outgoing;
                    }
                } else {
                    logger.error(`Auto-discovery failed for ${accountData.email}. Requires manual configuration.`);
                }
            } catch (e) {
                logger.error(`Error during discovery for ${accountData.email}: ${(e as Error).message}`);
            }
            return accountData;
        });

        const configuredAccounts = await Promise.all(configuredAccountsPromises);
        const newAccounts = await addAccounts(configuredAccounts);
        
        return {
            addedCount: newAccounts.length,
            skippedCount,
            totalCount: configuredAccounts.length + skippedCount
        };
    });
}

/**
 * Register preview and instant import handlers
 */
function registerPreviewImportHandlers(ipcMain: IpcMain, mainWindow: BrowserWindow, logger: Logger): void {
    // Enhanced import with preview and progress
    ipcMain.handle('accounts:import-preview', async () => {
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
            title: 'Preview Import File',
            buttonLabel: 'Preview',
            properties: ['openFile'],
            filters: [
                { name: 'Text Files', extensions: ['txt', 'csv'] },
                { name: 'All Files', extensions: ['*'] }
            ],
        });

        if (canceled || filePaths.length === 0) {
            return { success: false, error: 'File selection canceled.' };
        }

        try {
            const preview = await AccountImportService.generatePreview(filePaths[0]);
            return { success: true, preview, filePath: filePaths[0] };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to preview file';
            logger.error(`Preview failed: ${errorMessage}`);
            return { success: false, error: errorMessage };
        }
    });

    ipcMain.handle('accounts:import-enhanced', async (event: IpcMainInvokeEvent, filePath: string) => {
        try {
            logger.info('Starting enhanced import...');

            // Parse the file with progress reporting
            const parseResult = await AccountImportService.parseFile(filePath, (progress) => {
                // Send progress updates to renderer
                event.sender.send('import:progress', progress);
            });

            if (!parseResult.success) {
                logger.error(`Parse failed: ${parseResult.errors.join(', ')}`);
                return { success: false, errors: parseResult.errors };
            }

            logger.info(`Parsed ${parseResult.accounts.length} accounts. Configuring servers...`);

            // Configure accounts with server discovery
            const configuredAccounts = await AccountImportService.configureAccounts(
                parseResult.accounts,
                async (email) => {
                    const domain = email.split('@')[1];
                    const config = await getEmailConfig(domain, logger);
                    return convertToEmailServerConfig(config);
                },
                (progress) => {
                    event.sender.send('import:progress', progress);
                }
            );

            // Add to store
            const newAccounts = await addAccounts(configuredAccounts);

            logger.info(`Successfully imported ${newAccounts.length} accounts`);

            return {
                success: true,
                addedCount: newAccounts.length,
                skippedCount: parseResult.skippedLines,
                totalCount: parseResult.totalLines,
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Import failed';
            logger.error(`Enhanced import failed: ${errorMessage}`);
            return { success: false, error: errorMessage };
        }
    });
}

/**
 * Register instant import handlers
 */
function registerInstantImportHandlers(ipcMain: IpcMain, mainWindow: BrowserWindow, logger: Logger): void {
    // Instant import - adds accounts immediately and discovers DNS in background
    ipcMain.handle('accounts:import-from-file-instant', async () => {
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
            title: 'Import Accounts (Instant)',
            buttonLabel: 'Import',
            properties: ['openFile'],
            filters: [
                { name: 'Text Files', extensions: ['txt', 'csv'] },
                { name: 'All Files', extensions: ['*'] }
            ],
        });

        if (canceled || filePaths.length === 0) {
            return { success: false, error: 'File selection canceled.' };
        }

        try {
            logger.info('Starting instant import...');
            const result = await InstantImportService.importFromFile(
                filePaths[0],
                (email) => getEmailConfig(email.split('@')[1], logger)
            );

            if (result.success) {
                logger.info(`Instantly imported ${result.addedCount} accounts. DNS discovery running in background.`);
            } else {
                logger.error(`Instant import failed: ${result.error}`);
            }

            return result;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Instant import failed';
            logger.error(`Instant import failed: ${errorMessage}`);
            return { success: false, error: errorMessage };
        }
    });
}

/**
 * Register drag-and-drop import handlers
 */
function registerDragDropImportHandlers(ipcMain: IpcMain, logger: Logger): void {
    // Import from specific file path (for drag-and-drop)
    ipcMain.handle('accounts:import-from-file-data', async (_event: IpcMainInvokeEvent, filePath: string) => {
        try {
            logger.info('Starting file import...');
            const result = await InstantImportService.importFromFile(
                filePath,
                (email) => getEmailConfig(email.split('@')[1], logger)
            );

            if (result.success) {
                logger.info(`Imported ${result.addedCount} accounts from dropped file. DNS discovery running in background.`);
            } else {
                logger.error(`File import failed: ${result.error}`);
            }

            return result;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'File import failed';
            logger.error(`File import failed: ${errorMessage}`);
            return { success: false, error: errorMessage };
        }
    });

    // Import from file content (for drag-and-drop)
    ipcMain.handle('accounts:import-from-file-content', async (_event: IpcMainInvokeEvent, content: string) => {
        try {
            logger.info('Starting content import...');
            const result = await InstantImportService.importFromContent(
                content,
                (email) => getEmailConfig(email.split('@')[1], logger)
            );

            if (result.success) {
                logger.info(`Imported ${result.addedCount} accounts from dropped content. DNS discovery running in background.`);
            } else {
                logger.error(`Content import failed: ${result.error}`);
            }

            return result;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Content import failed';
            logger.error(`Content import failed: ${errorMessage}`);
            return { success: false, error: errorMessage };
        }
    });
}

/**
 * Main function to register all account handlers
 */
export const registerAccountHandlers = (ipcMain: IpcMain, mainWindow: BrowserWindow, logger: Logger): void => {
    registerDiscoveryHandlers(ipcMain, logger);
    registerAccountCrudHandlers(ipcMain, logger);
    registerFileImportHandlers(ipcMain, mainWindow, logger);
    registerPreviewImportHandlers(ipcMain, mainWindow, logger);
    registerInstantImportHandlers(ipcMain, mainWindow, logger);
    registerDragDropImportHandlers(ipcMain, logger);
};