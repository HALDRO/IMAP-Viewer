/**
 * @file IMAP Error Handling and Configuration Utilities
 */

import type { ImapFlow, ImapFlowOptions } from 'imapflow'
import { getGlobalProxy } from '../../services/configService'
import { getLogger } from '../../services/logger'
import type { Account, OAuth2AuthConfig } from '../types/account'

export type { OAuth2AuthConfig }

// Types from imapflow
export interface FetchMessageObject {
  uid: number
  envelope?: {
    from?: Array<{ name?: string; address?: string }>
    subject?: string
    date?: Date
  } | null
  flags?: Set<string>
}

export interface MailboxObject {
  path: string
  delimiter: string
  flags?: string[]
  specialUse?: string
}

/**
 * Creates user-friendly error messages from IMAP errors
 */
export function createUserFriendlyErrorMessage(
  err: Error,
  accountEmail: string,
  hostName: string
): string {
  const lowerCaseMessage = err.message.toLowerCase()
  if (
    lowerCaseMessage.includes('authentication') ||
    lowerCaseMessage.includes('invalid credentials')
  ) {
    return `Authentication failed for ${accountEmail}. Please check your email and password. For services like Gmail, you may need to generate an App Password.`
  }
  if (lowerCaseMessage.includes('timeout')) {
    return `Connection to ${hostName} timed out. Please check your network connection and server address.`
  }
  if (lowerCaseMessage.includes('econnrefused')) {
    return `Connection refused by ${hostName}. The server may be down or the port is incorrect.`
  }
  if (lowerCaseMessage.includes('enotfound')) {
    return `Cannot find server ${hostName}. Please check the server address.`
  }
  return `A connection error occurred: ${err.message}`
}

/**
 * Logs IMAP connection errors with user-friendly messages
 */
export function logImapError(
  err: Error,
  accountEmail: string,
  hostName: string,
  logCallback: (message: string, level?: 'info' | 'error' | 'success') => void
): void {
  const logger = getLogger()
  const userFriendlyMessage = createUserFriendlyErrorMessage(err, accountEmail, hostName)
  logger.error(
    { error: err.message, accountEmail, hostName, userFriendlyMessage },
    `IMAP connection error for ${accountEmail}`
  )
  logCallback(userFriendlyMessage, 'error')
}

/**
 * Creates IMAP connection configuration with support for OAuth2
 */
export function createImapConfig(
  account: Account,
  proxy?: string,
  oauthConfig?: OAuth2AuthConfig
): ImapFlowOptions {
  // Use longer timeouts when proxy is enabled (proxies add latency)
  const timeoutMultiplier = proxy ? 3 : 1

  const baseConfig = {
    host: account.incoming.host,
    port: account.incoming.port,
    secure: account.incoming.useTls,
    proxy,
    logger: false as const,
    connectionTimeout: 8000 * timeoutMultiplier, // 8s direct, 24s via proxy
    greetingTimeout: 5000 * timeoutMultiplier, // 5s direct, 15s via proxy
    socketTimeout: 60000,
    disableAutoIdle: true,
    qresync: false,
    disableCompression: true,
    disableBinary: true,
    disableAutoEnable: true,
    tls: {
      rejectUnauthorized: false,
      minVersion: 'TLSv1.2' as const,
      ciphers: 'ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256',
    },
  }

  const auth = oauthConfig
    ? { user: account.email, accessToken: oauthConfig.authString }
    : { user: account.email, pass: account.password }

  return { ...baseConfig, auth }
}

/**
 * Configures proxy for IMAP connection based on ONLY global proxy settings
 * NO rotation, NO proxies.txt - only config.json
 */
export async function configureProxy(
  account: Account,
  logCallback: (message: string, level?: 'info' | 'error' | 'success') => void
): Promise<{ proxy?: string; proxyUsed: boolean }> {
  // ONLY use global proxy from config.json - no rotation, no proxies.txt
  const proxyConfig = await getGlobalProxy()

  // If no global proxy configured or disabled, connect directly
  if (!proxyConfig?.enabled || !proxyConfig.hostPort) {
    return { proxy: undefined, proxyUsed: false }
  }

  logCallback(
    `Connecting account '${account.displayName || account.email}' via proxy ${proxyConfig.hostPort}`,
    'info'
  )
  const authPart =
    proxyConfig.auth && proxyConfig.username
      ? `${encodeURIComponent(proxyConfig.username)}:${encodeURIComponent(proxyConfig.password || '')}@`
      : ''
  const proxy = `${proxyConfig.type}://${authPart}${proxyConfig.hostPort}`
  return { proxy, proxyUsed: true }
}

export function buildImapFlowConfig(
  account: Account,
  _appLogger: unknown,
  proxy?: string,
  oauthConfig?: OAuth2AuthConfig
): ImapFlowOptions {
  const baseConfig = {
    host: account.incoming.host,
    port: account.incoming.port,
    secure: account.incoming.useTls,
    proxy,
    logger: false as const,
    connectionTimeout: 8000,
    greetingTimeout: 3000,
    socketTimeout: 60000,
    disableAutoIdle: true,
    qresync: false,
    disableCompression: true,
    disableBinary: true,
    disableAutoEnable: true,
    tls: {
      rejectUnauthorized: false,
      minVersion: 'TLSv1.2' as const,
      ciphers: 'ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256',
    },
  }

  const auth = oauthConfig
    ? { user: account.email, accessToken: oauthConfig.authString }
    : { user: account.email, pass: account.password }

  return { ...baseConfig, auth }
}
