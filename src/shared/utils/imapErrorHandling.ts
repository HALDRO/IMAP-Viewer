/**
 * @file IMAP error handling utilities
 */

import { getGlobalProxy, getNextProxy } from '../../services/storeService';
import { getLogger } from '../../services/logger';

/**
 * Creates user-friendly error messages from IMAP errors
 */
export function createUserFriendlyErrorMessage(err: Error, _accountEmail: string, hostName: string): string {
  if ((err.message?.toLowerCase().includes('authentication')) === true) {
    return 'Authentication failed. Please check your email and password. If you use 2-Factor Authentication, you may need to generate an App Password.';
  } else if ((err.message?.toLowerCase().includes('timeout')) === true) {
    return `Connection to ${hostName} timed out. Please check your network and server address.`;
  } else {
    return `A connection error occurred: ${err.message}`;
  }
}

/**
 * Logs IMAP connection errors with user-friendly messages
 */
export function logImapError(err: Error, accountEmail: string, hostName: string, logCallback: (message: string, level?: 'info' | 'error' | 'success') => void): void {
  const logger = getLogger();
  logger.error({ error: err.message, accountEmail, hostName }, `IMAP connection error for ${accountEmail}`);

  const userFriendlyMessage = createUserFriendlyErrorMessage(err, accountEmail, hostName);
  logCallback(userFriendlyMessage, 'error');
}

interface AccountConfig {
  incoming: {
    host: string;
    port: number;
    useTls: boolean;
  };
  email: string;
  password: string;
  useProxy?: boolean;
  displayName?: string;
}

interface ImapConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass?: string;
    accessToken?: string;
  };
  proxy?: string;
  logger: false;
  connTimeout: number;
  authTimeout: number;
}

export interface OAuth2AuthConfig {
  authMethod: 'XOAUTH2';
  authString: string;
}

/**
 * Creates IMAP connection configuration with support for OAuth2
 */
export function createImapConfig(
  account: AccountConfig,
  proxy?: string,
  oauthConfig?: OAuth2AuthConfig
): ImapConfig {
  const baseConfig = {
    host: account.incoming.host,
    port: account.incoming.port,
    secure: account.incoming.useTls,
    proxy,
    logger: false as const,
    connTimeout: 30000,
    authTimeout: 30000,
  };

  // OAuth2 authentication
  if (oauthConfig) {
    return {
      ...baseConfig,
      auth: {
        user: account.email,
        accessToken: oauthConfig.authString,
      },
    };
  }

  // Basic authentication
  return {
    ...baseConfig,
    auth: {
      user: account.email,
      pass: account.password,
    },
  };
}

/**
 * Configures proxy for IMAP connection
 */
export async function configureProxy(account: AccountConfig, logCallback: (message: string, level?: 'info' | 'error' | 'success') => void): Promise<{ proxy: string | undefined; proxyUsed: boolean }> {
  let proxy: string | undefined;
  let proxyUsed = false;

  if (account.useProxy === true) {
    // Try to get a proxy from the rotation list first
    const nextProxy = getNextProxy();

    // If there's no proxy in the rotation list, fall back to global proxy
    const proxyConfig = nextProxy ?? await getGlobalProxy();

    if (proxyConfig && proxyConfig.enabled === true && (proxyConfig.hostPort?.length ?? 0) > 0) {
      logCallback(`Connecting account '${(account.displayName?.length ?? 0) > 0 ? account.displayName : account.email}' via proxy ${proxyConfig.hostPort}`, 'info');

      const authPart = (proxyConfig.auth === true && (proxyConfig.username?.length ?? 0) > 0) ?
        `${encodeURIComponent(proxyConfig.username ?? '')}:${encodeURIComponent(proxyConfig.password ?? '')}@` : '';
      proxy = `${proxyConfig.type}://${authPart}${proxyConfig.hostPort}`;
      proxyUsed = true;
    } else {
      logCallback(`Proxy is enabled for '${(account.displayName?.length ?? 0) > 0 ? account.displayName : account.email}', but no proxy is available. Connecting directly.`, 'info');
    }
  }

  return { proxy, proxyUsed };
}
