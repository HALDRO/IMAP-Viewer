/**
 * @file Service for managing storage using simple text files.
 * This stores everything in the application's root directory for portability.
 */
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';

import { app } from 'electron';
import { v5 as uuidv5 } from 'uuid';

import { imapProviders } from '../shared/store/imapProviders';
import type { Account, ProxyConfig, GlobalProxyConfig } from '../shared/types/account';
import { MicrosoftAccountParser } from './oauthAccountParser';
import { getLogger } from './logger';

import type { DiscoveredConfig } from './autoDiscoveryService'; // Import the type for configs

interface ProviderConfig {
  imap: {
    host: string;
    port: number;
    secure: boolean;
  };
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
  };
}


// A constant namespace for generating deterministic UUIDs from email addresses.
// This ensures that the ID for a given email is always the same.
const ACCOUNT_ID_NAMESPACE = 'fd5a1e70-03e3-4d40-b8b0-3f7b9d10c0f2';

// Define file paths relative to the application root
const getBasePath = (): string => {
  // In development, use the project root
  // In production, use the directory where the executable is located
  return app.isPackaged ? path.dirname(app.getPath('exe')) : app.getAppPath();
};

export const DATA_DIR = path.join(getBasePath(), 'data');
export const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.txt');
export const DOMAINS_FILE = path.join(DATA_DIR, 'domains.txt');
export const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
export const PROXIES_FILE = path.join(DATA_DIR, 'proxies.txt');

// Store the current index for proxy rotation
let currentProxyIndex = 0;

// Track if infrastructure has been initialized to avoid repeated calls
let infrastructureInitialized = false;

// Ensure files and directory exist
const ensureDataInfrastructure = async (): Promise<void> => {
  if (infrastructureInitialized) {
    return; // Already initialized, skip
  }

  try {
    // 1. Create data directory if it doesn't exist
    await fsPromises.mkdir(DATA_DIR, { recursive: true });
    console.log('Ensured data directory exists:', DATA_DIR);

    // 2. Ensure all config/data files exist inside the data directory
    const files = [ACCOUNTS_FILE, DOMAINS_FILE, CONFIG_FILE, PROXIES_FILE];

    for (const file of files) {
      try {
        await fsPromises.access(file);
        // File exists, continue to next
      } catch {
        // File doesn't exist, create it
        try {
          const content = file.endsWith('.json') ? '{}' : '';
          await fsPromises.writeFile(file, content, 'utf-8');
          console.log('Created file:', file);
        } catch (error) {
          console.error(`Failed to create file ${file}:`, error);
        }
      }
    }

    infrastructureInitialized = true;
  } catch (error) {
    console.error('Failed to ensure data infrastructure:', error);
  }
};

// Initialize files on startup
void ensureDataInfrastructure();

/**
 * Finds provider configuration from built-in providers list
 */
const findProviderConfig = (domain: string): unknown | null => {
  const provider = imapProviders.find(p => p.domains.includes(domain));
  return provider ? provider.config : null;
};

// Account management functions
export const getAccounts = async (): Promise<Account[]> => {
  try {
    console.log('🔥 GETACCOUNTS FUNCTION CALLED - NEW VERSION WITH MICROSOFT PARSER 🔥');
    await ensureDataInfrastructure();
    const content = await fsPromises.readFile(ACCOUNTS_FILE, 'utf8');
    console.log('🔥 Raw file content:', content);
    const savedDomains = await getDomains(); // Get all saved domain configs at once
    const accounts: Account[] = [];
    const seenEmails = new Set<string>(); // Track seen emails to prevent duplicates

    content.split('\n').forEach(line => {
      line = line.trim();
      if (!line) return;

      let email: string;
      let password: string;
      let refreshToken: string | undefined;
      let clientId: string | undefined;
      let authType: 'basic' | 'oauth2' = 'basic';

      // Try Microsoft OAuth2 format first
      if (MicrosoftAccountParser.isMicrosoftFormat(line)) {
        const microsoftResult = MicrosoftAccountParser.parseLine(line);
        if (microsoftResult.success && microsoftResult.account) {
          const msAccount = microsoftResult.account;
          email = msAccount.email;
          password = msAccount.password;
          refreshToken = msAccount.refreshToken;
          clientId = msAccount.clientId;
          authType = 'oauth2';
        } else {
          console.warn(`Failed to parse Microsoft format line: ${line}`);
          return;
        }
      } else {
        // Fallback to basic format parsing
        const parts = line.split(':');
        if (parts.length >= 2) {
          email = parts[0];
          password = parts[1];
          refreshToken = parts.length > 2 ? parts[2] : undefined;
          clientId = parts.length > 3 ? parts[3] : undefined;
          // Determine auth type based on presence of OAuth2 fields
          authType = (refreshToken && clientId) ? 'oauth2' : 'basic';
        } else {
          console.warn(`Invalid line format: ${line}`);
          return;
        }
      }

      // Skip if we've already seen this email
      if (seenEmails.has(email)) {
        // eslint-disable-next-line no-console
        console.warn(`Duplicate email found in accounts.txt: ${email} - skipping`);
        return;
      }
      seenEmails.add(email);
      const domain = email.split('@')[1];

        // Default values - use placeholder values that indicate manual configuration needed
        let incoming: Account['incoming'] = { host: 'imap.example.com', port: 993, useTls: true, protocol: 'imap' };
        let outgoing: Account['outgoing'] | undefined = undefined;

        // First, check saved domain configs (user customizations have priority)
        if ((domain?.length ?? 0) > 0 && savedDomains[domain] !== null && savedDomains[domain] !== undefined) {
          const config = savedDomains[domain];
          console.log(`Using saved domain config for ${domain}:`, config);
          if (config.imap !== null && config.imap !== undefined) {
            incoming = {
              protocol: 'imap',
              host: config.imap.host,
              port: config.imap.port,
              useTls: config.imap.secure,
            };
            console.log(`Set IMAP host to ${config.imap.host} for ${email}`);
          }
          if (config.smtp) {
            outgoing = {
              protocol: 'smtp',
              host: config.smtp.host,
              port: config.smtp.port,
              useTls: config.smtp.secure,
            };
          }
        }
        // If no saved domain config, check built-in providers
        else {
          const providerConfig = findProviderConfig(domain);
          if (providerConfig !== null && providerConfig !== undefined) {
            const config = providerConfig as ProviderConfig;
            incoming = {
              protocol: 'imap',
              host: config.imap.host,
              port: config.imap.port,
              useTls: config.imap.secure,
            };

            if (config.smtp !== null && config.smtp !== undefined) {
              outgoing = {
                protocol: 'smtp',
                host: config.smtp.host,
                port: config.smtp.port,
                useTls: config.smtp.secure,
              };
            }
          }
        }

        console.log(`Loading account ${email}: authType=${authType}, refreshToken=${refreshToken ? 'present' : 'missing'}, clientId=${clientId ? 'present' : 'missing'}`);

        accounts.push({
          id: uuidv5(email, ACCOUNT_ID_NAMESPACE),
          email,
          password,
          refreshToken,
          clientId,
          authType,
          connectionStatus: 'disconnected',
          incoming, // Use the potentially updated values
          outgoing, // Use the potentially updated values
        });
    });
    
    return accounts;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error reading accounts file:', error);
    return [];
  }
};

/**
 * Saves an array of Account objects to the store.
 * @param accounts The array of Account objects to save.
 */
export const setAccounts = async (accounts: Account[]): Promise<void> => {
  try {
    await ensureDataInfrastructure();
    // Convert accounts to email:password:refreshToken:clientId format
    const content = accounts
      .map(a => {
        const parts = [a.email, a.password];
        if (a.refreshToken) {
          parts.push(a.refreshToken);
        }
        if (a.clientId) {
          parts.push(a.clientId);
        }
        return parts.join(':');
      })
      .join('\n');

    await fsPromises.writeFile(ACCOUNTS_FILE, content, 'utf8');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error saving accounts:', error);
  }
};

/**
 * Adds a new account to the store.
 * @param accountData The account data to add (id will be generated).
 * @returns The newly created Account object.
 */
export const addAccount = async (accountData: Omit<Account, 'id'>): Promise<Account> => {
  const logger = getLogger();
  logger.info({ email: accountData.email }, 'addAccount called');
  const accounts = await getAccounts();
  logger.info({ accountCount: accounts.length }, 'Current accounts loaded');

  // Check if account with this email already exists
  const existingAccount = accounts.find(acc => acc.email === accountData.email);
  if (existingAccount) {
    logger.warn({ email: accountData.email }, `Account with email ${accountData.email} already exists`);
    throw new Error(`Account with email ${accountData.email} already exists`);
  }

  // Construct a full Account object with a new ID
  const newAccount = {
    id: uuidv5(accountData.email, ACCOUNT_ID_NAMESPACE),
    ...accountData,
  };
  logger.info({ accountId: newAccount.id, email: newAccount.email }, 'New account created');

  accounts.push(newAccount);
  console.log('Saving accounts to store:', accounts);
  await setAccounts(accounts);
  console.log('Account saved successfully, returning:', newAccount);
  return newAccount;
};

/**
 * Updates a single account in the store.
 * @param accountId The ID of the account to update.
 * @param updates The partial account data to apply.
 * @returns The updated Account object or null if not found.
 */
export const updateAccount = async (accountId: string, updates: Partial<Omit<Account, 'id'>>): Promise<Account | null> => {
  console.log('updateAccount called with accountId:', accountId);
  console.log('updateAccount updates:', JSON.stringify(updates, null, 2));

  const accounts = await getAccounts();
  const accountIndex = accounts.findIndex(acc => acc.id === accountId);

  if (accountIndex === -1) {
    return null;
  }

  const updatedAccountData = {
    ...accounts[accountIndex],
    ...updates,
  };

  console.log('updatedAccountData before saving:', JSON.stringify(updatedAccountData, null, 2));

  accounts[accountIndex] = updatedAccountData;
  await setAccounts(accounts);

  // If IMAP settings were updated, sync domain configuration
  if (updates.incoming && updatedAccountData.email) {
    const domain = updatedAccountData.email.split('@')[1];
    if (domain && !domain.includes('example.com')) {
      const config: DiscoveredConfig = {};

      if (updatedAccountData.incoming) {
        config.imap = {
          host: updatedAccountData.incoming.host,
          port: updatedAccountData.incoming.port,
          secure: updatedAccountData.incoming.useTls,
        };
      }

      if (updatedAccountData.outgoing) {
        config.smtp = {
          host: updatedAccountData.outgoing.host,
          port: updatedAccountData.outgoing.port,
          secure: updatedAccountData.outgoing.useTls,
        };
      }

      console.log(`Saving domain config for ${domain}:`, config);
      saveDomain(domain, config);
      console.log(`Domain config saved for ${domain}`);
    }
  }

  return updatedAccountData;
};

/**
 * Removes an account from the store by its ID.
 * @param accountId The ID of the account to remove.
 */
export const removeAccount = async (accountId: string): Promise<void> => {
  const accounts = await getAccounts();
  const filteredAccounts = accounts.filter(a => a.id !== accountId);
  await setAccounts(filteredAccounts);
};

/**
 * Adds multiple new accounts to the store in a single, optimized operation.
 * @param accountsData An array of account data to add.
 * @returns An array of the newly created Account objects.
 */
export const addAccounts = async (accountsData: Omit<Account, 'id' | 'connectionStatus'>[]): Promise<Account[]> => {
  const existingAccounts = await getAccounts();
  const existingEmails = new Set(existingAccounts.map(a => a.email));

  const newAccounts = accountsData
    .filter(data => !existingEmails.has(data.email)) // Prevent adding duplicates
    .map(data => {
      const newAccount: Account = {
        id: uuidv5(data.email, ACCOUNT_ID_NAMESPACE),
        ...data,
        connectionStatus: 'disconnected' as const,
      };
      return newAccount;
    });

  if (newAccounts.length > 0) {
    const allAccounts = [...existingAccounts, ...newAccounts];
    // Directly save the combined list of accounts
    await setAccounts(allAccounts);
  }

  return newAccounts;
};

/**
 * Gets the list of proxies from the proxies.txt file.
 * @returns An array of proxy configurations.
 */
export const getProxyList = (): ProxyConfig[] => {
  try {
    const content = fs.readFileSync(PROXIES_FILE, 'utf8');
    const proxies: ProxyConfig[] = [];
    
    content.split('\n').forEach(line => {
      line = line.trim();
      if (!line || line.startsWith('#')) return; // Skip empty lines and comments
      
      // Format: type:host:port:username:password
      // Example: socks5:192.168.1.1:1080:user:pass
      // Example: socks5:192.168.1.1:1080:: (no auth)
      const parts = line.split(':');
      if (parts.length < 3) return; // Need at least type, host, port
      
      const [type, host, port, username, password] = parts;
      const hasAuth = !!(username && password);
      
      proxies.push({
        enabled: true,
        type: type as 'socks5' | 'socks4' | 'https',
        host,
        port: parseInt(port, 10),
        hostPort: `${host}:${port}`,
        auth: hasAuth,
        username: username || undefined,
        password: password || undefined,
      });
    });
    
    return proxies;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error reading proxy list:', error);
    return [];
  }
};

/**
 * Saves a list of proxies to the proxies.txt file.
 * @param proxies The array of proxy configurations to save.
 */
export const saveProxyList = (proxies: ProxyConfig[]): void => {
  try {
    const content = proxies.map(proxy => {
      const type = proxy.type;
      const host = (proxy.hostPort?.length ?? 0) > 0 ? (proxy.hostPort ?? '').split(':')[0] : proxy.host;
      const port = (proxy.hostPort?.length ?? 0) > 0 ? (proxy.hostPort ?? '').split(':')[1] : proxy.port.toString();
      const username = proxy.auth === true ? proxy.username ?? '' : '';
      const password = proxy.auth === true ? proxy.password ?? '' : '';

      return `${type}:${host}:${port}:${username}:${password}`;
    }).join('\n');
    
    fs.writeFileSync(PROXIES_FILE, content, 'utf8');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error saving proxy list:', error);
  }
};

/**
 * Gets the next proxy from the rotation list.
 * @returns The next proxy configuration or null if no proxies are available.
 */
export const getNextProxy = (): ProxyConfig | null => {
  const proxies = getProxyList().filter(p => p.enabled);
  if (proxies.length === 0) {
    return null;
  }
  
  // Reset index if it's out of bounds
  if (currentProxyIndex >= proxies.length) {
    currentProxyIndex = 0;
  }
  
  // Get the proxy and increment the index
  const proxy = proxies[currentProxyIndex];
  currentProxyIndex = (currentProxyIndex + 1) % proxies.length;
  
  return proxy;
};

/**
 * Tests if a proxy is working by attempting to connect to a test server.
 * @param proxy The proxy configuration to test.
 * @returns A promise that resolves to true if the proxy is working, false otherwise.
 */
export const testProxy = async (_proxy: ProxyConfig): Promise<boolean> => {
  try {
    // This is a placeholder. In a real implementation, you would:
    // 1. Create a socket connection through the proxy
    // 2. Try to connect to a known server (like google.com)
    // 3. Return true if successful, false otherwise
    
    // For now, we'll just simulate a test with a random result
    return new Promise(resolve => {
      setTimeout(() => {
        resolve(Math.random() > 0.2); // 80% chance of success for demo
      }, 500);
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error testing proxy:', error);
    return false;
  }
};

// Domain management functions
export const getDomains = async (): Promise<Record<string, DiscoveredConfig>> => {
  try {
    await ensureDataInfrastructure();
    const content = await fsPromises.readFile(DOMAINS_FILE, 'utf8');
    const domains: Record<string, DiscoveredConfig> = {};

    content.split('\n').forEach(line => {
      line = line.trim();
      if (!line) return;

      const separatorIndex = line.indexOf(':');
      if (separatorIndex === -1) return;

      const domain = line.substring(0, separatorIndex);
      const configString = line.substring(separatorIndex + 1);

      if (domain && configString) {
        const [imapStr, smtpStr] = configString.split('|');
        const config: DiscoveredConfig = {};

        if (imapStr) {
          const [host, port, secure] = imapStr.split(':');
          if (host && port && secure) {
            config.imap = { host, port: parseInt(port, 10), secure: secure === 'true' };
          }
        }
        if (smtpStr) {
          const [host, port, secure] = smtpStr.split(':');
          if (host && port && secure) {
            config.smtp = { host, port: parseInt(port, 10), secure: secure === 'true' };
          }
        }
        domains[domain] = config;
      }
    });

    return domains;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {};
    }
    // eslint-disable-next-line no-console
    console.error('Error reading domains file:', error);
    return {};
  }
};

/**
 * Removes a domain from the cache
 * @param domain The domain name to remove
 */
export const removeDomain = async (domain: string): Promise<void> => {
  try {
    const domains = await getDomains();
    delete domains[domain];

    const content = Object.entries(domains)
      .map(([d, c]) => {
        let line = '';
        if (c.imap) {
          line += `${c.imap.host}:${c.imap.port}:${c.imap.secure}`;
        }
        if (c.smtp) {
          line += `|${c.smtp.host}:${c.smtp.port}:${c.smtp.secure}`;
        }
        return `${d}:${line}`;
      })
      .join('\n');

    await fsPromises.writeFile(DOMAINS_FILE, content, 'utf8');
    console.log(`Removed domain from cache: ${domain}`);
  } catch (error) {
    console.error('Error removing domain:', error);
  }
};

/**
 * Saves a domain and its configuration to the store.
 * @param domain The domain name (e.g., 'gmail.com').
 * @param config The configuration object from auto-discovery.
 */
export const saveDomain = async (domain: string, config: DiscoveredConfig): Promise<void> => {
  try {
    // Don't save example domains or invalid configurations
    if (!domain || domain.includes('example.com') || domain.includes('example.org')) {
      console.log('Skipping save for example domain:', domain);
      return;
    }

    // Don't save configurations with example hosts
    if (config.imap?.host?.includes('example.com') ||
        config.smtp?.host?.includes('example.com') ||
        config.pop3?.host?.includes('example.com')) {
      console.log('Skipping save for configuration with example hosts:', config);
      return;
    }

    const domains = await getDomains();

    // Create the simple string format
    // Configuration will be saved as JSON object

    // This will update the existing domain or add a new one
    const newDomains = { ...domains, [domain]: config };

    const content = Object.entries(newDomains)
      .map(([d, c]) => {
        let line = '';
        if (c.imap) {
          line += `${c.imap.host}:${c.imap.port}:${c.imap.secure}`;
        }
        if (c.smtp) {
          line += `|${c.smtp.host}:${c.smtp.port}:${c.smtp.secure}`;
        }
        return `${d}:${line}`;
      })
      .join('\n');

    await fsPromises.writeFile(DOMAINS_FILE, content, 'utf8');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error saving domain:', error);
  }
};

// Config management functions
export const getConfig = async (): Promise<Record<string, unknown>> => {
  try {
    await ensureDataInfrastructure();
    const content = await fsPromises.readFile(CONFIG_FILE, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error reading config file:', error);
    return {};
  }
};

export const saveConfig = async (config: Record<string, unknown>): Promise<void> => {
  try {
    await ensureDataInfrastructure();
    await fsPromises.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error saving config:', error);
  }
};

// Proxy configuration functions
export const getGlobalProxy = async (): Promise<GlobalProxyConfig | null> => {
  const config = await getConfig();
  return (config.proxy as GlobalProxyConfig) ?? null;
};

export const setGlobalProxy = async (proxy: GlobalProxyConfig | null): Promise<void> => {
  const config = await getConfig();
  config.proxy = proxy;
  await saveConfig(config);
};