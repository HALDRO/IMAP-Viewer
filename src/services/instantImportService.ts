/**
 * @file Instant import service with background DNS discovery
 * Imports accounts immediately and discovers server settings in background
 */

import fs from 'fs';

import { z } from 'zod';

import { imapProviders } from '../shared/store/imapProviders';
import type { Account } from '../shared/types/account';

import type { DiscoveredConfig } from './autoDiscoveryService';
import { addAccounts, updateAccount } from './storeService';

// Validation schema for parsed account data
const parsedAccountSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
  domain: z.string().optional(),
});

export type ParsedAccount = z.infer<typeof parsedAccountSchema>;

export interface InstantImportResult {
  success: boolean;
  addedCount: number;
  skippedCount: number;
  totalCount: number;
  error?: string;
}

/**
 * Instant import service that adds accounts immediately and discovers DNS in background
 */
export class InstantImportService {
  private static readonly SUPPORTED_SEPARATORS = [':', ';', '|', '\t', ','];
  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  private static readonly domainConfigCache = new Map<string, DiscoveredConfig>();

  /**
   * Detects the most likely separator used in the file
   */
  private static detectSeparator(lines: string[]): string {
    const separatorCounts = new Map<string, number>();
    
    for (const line of lines.slice(0, 50)) { // Check first 50 lines
      if (line.trim().length === 0) continue;
      
      for (const sep of this.SUPPORTED_SEPARATORS) {
        const parts = line.split(sep);
        if (parts.length >= 2 && this.EMAIL_REGEX.test(parts[0].trim())) {
          separatorCounts.set(sep, (separatorCounts.get(sep) ?? 0) + 1);
        }
      }
    }

    // Return the separator with the highest count
    let bestSeparator = ':';
    let maxCount = 0;
    
    for (const [sep, count] of separatorCounts) {
      if (count > maxCount) {
        maxCount = count;
        bestSeparator = sep;
      }
    }

    return bestSeparator;
  }

  /**
   * Normalizes and cleans a single line of account data
   */
  private static normalizeLine(line: string, separator: string): ParsedAccount | null {
    // Remove common junk characters and normalize whitespace
    // Убираем регулярки - просто нормализуем пробелы и убираем лишние символы в начале/конце
    const cleanLine = line
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    if (!cleanLine) return null;

    const parts = cleanLine.split(separator);
    if (parts.length < 2) return null;

    const email = parts[0].trim();
    const password = parts.slice(1).join(separator).trim();

    // Validate email format
    if (!this.EMAIL_REGEX.test(email)) return null;
    if (!password) return null;

    try {
      const parsed = parsedAccountSchema.parse({
        email,
        password,
        domain: email.split('@')[1],
      });
      return parsed;
    } catch {
      return null;
    }
  }

  /**
   * Creates basic account objects with smart default server settings
   * Uses built-in provider configs when available, falls back to generic defaults
   */
  private static createBasicAccounts(parsedAccounts: ParsedAccount[]): Omit<Account, 'id' | 'connectionStatus'>[] {
    return parsedAccounts.map(parsed => {
      const domain = parsed.domain ?? parsed.email.split('@')[1];
      const providerConfig = this.findProviderConfig(domain);

      let incoming, outgoing;

      if (providerConfig?.imap) {
        // Use known provider configuration
        incoming = {
          protocol: 'imap' as const,
          host: providerConfig.imap.host,
          port: providerConfig.imap.port,
          useTls: providerConfig.imap.secure,
        };

        if (providerConfig.smtp !== null && providerConfig.smtp !== undefined) {
          outgoing = {
            protocol: 'smtp' as const,
            host: providerConfig.smtp.host,
            port: providerConfig.smtp.port,
            useTls: providerConfig.smtp.secure,
          };
        }

        // Using provider config for domain
      } else {
        // Fall back to generic defaults
        incoming = {
          protocol: 'imap' as const,
          host: `imap.${domain}`,
          port: 993,
          useTls: true,
        };

        outgoing = {
          protocol: 'smtp' as const,
          host: `smtp.${domain}`,
          port: 587,
          useTls: true,
        };

        // Using generic defaults for domain
      }

      return {
        displayName: parsed.email.split('@')[0],
        email: parsed.email,
        password: parsed.password,
        incoming,
        outgoing,
        useProxy: false,
      };
    });
  }

  /**
   * Finds provider configuration from built-in providers list
   */
  private static findProviderConfig(domain: string): DiscoveredConfig | null {
    const provider = imapProviders.find(p => p.domains.includes(domain));
    if (provider) {
      // Found built-in config for domain
      return provider.config;
    }
    return null;
  }

  /**
   * Discovers and caches server configuration for a domain
   * First checks built-in providers, then falls back to DNS discovery
   */
  private static async discoverDomainConfig(
    domain: string,
    getEmailConfig: (email: string) => Promise<DiscoveredConfig | null>
  ): Promise<DiscoveredConfig | null> {
    if (this.domainConfigCache.has(domain)) {
      return this.domainConfigCache.get(domain) ?? null;
    }

    // First, check built-in providers
    const providerConfig = this.findProviderConfig(domain);
    if (providerConfig) {
      this.domainConfigCache.set(domain, providerConfig);
      return providerConfig;
    }

    // Fall back to DNS discovery for unknown providers
    try {
      // Running DNS discovery for domain
      const config = await getEmailConfig(`test@${domain}`);
      if (config !== null) {
        this.domainConfigCache.set(domain, config);
      }
      return config;
    } catch {
      // Failed to discover config for domain
      return null;
    }
  }

  /**
   * Updates accounts with discovered server configurations in background
   */
  private static async updateAccountsWithDiscoveredConfigs(
    accounts: Account[],
    getEmailConfig: (email: string) => Promise<DiscoveredConfig | null>
  ): Promise<void> {
    // Group accounts by domain to avoid duplicate discoveries
    const domainGroups = new Map<string, Account[]>();
    
    for (const account of accounts) {
      const domain = account.email.split('@')[1];
      if (!domainGroups.has(domain)) {
        domainGroups.set(domain, []);
      }
      const domainAccountsList = domainGroups.get(domain);
      if (domainAccountsList) {
        domainAccountsList.push(account);
      }
    }

    // Process each domain group
    for (const [domain, domainAccounts] of domainGroups) {
      try {
        // Processing domain accounts

        // Skip domains that already have provider configs (they're already correct)
        const hasProviderConfig = this.findProviderConfig(domain) !== null;
        if (hasProviderConfig) {
          // Skipping domain - already has provider config
          continue;
        }

        const config = await this.discoverDomainConfig(domain, getEmailConfig);

        if (config) {
          // Found config for domain
          // Update all accounts for this domain
          for (const account of domainAccounts) {
            const updatedAccount: Partial<Account> = {};

            if (config.imap) {
              updatedAccount.incoming = {
                protocol: 'imap',
                host: config.imap.host,
                port: config.imap.port,
                useTls: config.imap.secure,
              };
            }

            if (config.smtp) {
              updatedAccount.outgoing = {
                protocol: 'smtp',
                host: config.smtp.host,
                port: config.smtp.port,
                useTls: config.smtp.secure,
              };
            }

            // Updating account with discovered config
            // Update account in store
            await updateAccount(account.id, updatedAccount);
          }
        } else {
          // No config found for domain
        }
      } catch {
        // Failed to update accounts for domain
      }

      // Add small delay between domain discoveries to avoid overwhelming servers
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Instantly imports accounts from file content and starts background DNS discovery
   */
  static async importFromContent(
    content: string,
    getEmailConfig: (email: string) => Promise<DiscoveredConfig | null>
  ): Promise<InstantImportResult> {
    try {
      // Parse content
      const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);

      if (lines.length === 0) {
        return {
          success: false,
          addedCount: 0,
          skippedCount: 0,
          totalCount: 0,
          error: 'Content is empty',
        };
      }

      return await this.processLines(lines, getEmailConfig);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Import failed';
      return {
        success: false,
        addedCount: 0,
        skippedCount: 0,
        totalCount: 0,
        error: errorMessage,
      };
    }
  }

  /**
   * Instantly imports accounts and starts background DNS discovery
   */
  static async importFromFile(
    filePath: string,
    getEmailConfig: (email: string) => Promise<DiscoveredConfig | null>
  ): Promise<InstantImportResult> {
    try {
      // Read and parse file
      const content = await fs.promises.readFile(filePath, 'utf8');
      return await this.importFromContent(content, getEmailConfig);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Import failed';
      return {
        success: false,
        addedCount: 0,
        skippedCount: 0,
        totalCount: 0,
        error: errorMessage,
      };
    }
  }

  /**
   * Processes lines of account data
   */
  private static async processLines(
    lines: string[],
    getEmailConfig: (email: string) => Promise<DiscoveredConfig | null>
  ): Promise<InstantImportResult> {
    // Detect separator and parse accounts
    const separator = this.detectSeparator(lines);
    const parsedAccounts: ParsedAccount[] = [];
    let skippedCount = 0;

    for (const line of lines) {
      const parsed = this.normalizeLine(line, separator);
      if (parsed) {
        parsedAccounts.push(parsed);
      } else {
        skippedCount++;
      }
    }

    if (parsedAccounts.length === 0) {
      return {
        success: false,
        addedCount: 0,
        skippedCount,
        totalCount: lines.length,
        error: 'No valid accounts found',
      };
    }

    // Create basic accounts with default settings
    const basicAccounts = this.createBasicAccounts(parsedAccounts);

    // Add accounts to store immediately
    const addedAccounts = await addAccounts(basicAccounts);

    // Start background DNS discovery (don't await)
    this.updateAccountsWithDiscoveredConfigs(addedAccounts, getEmailConfig).catch(() => {
      // Background DNS discovery failed
    });

    return {
      success: true,
      addedCount: addedAccounts.length,
      skippedCount,
      totalCount: lines.length,
    };
  }

  /**
   * Clears the domain configuration cache
   */
  static clearDomainCache(): void {
    this.domainConfigCache.clear();
  }

  /**
   * Gets cached domain configuration
   */
  static getDomainConfig(domain: string): DiscoveredConfig | null {
    return this.domainConfigCache.get(domain) ?? null;
  }
}
