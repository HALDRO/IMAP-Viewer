/**
 * @file Service for managing account storage and operations.
 */
import { promises as fsPromises } from 'node:fs'
import path from 'node:path'

import { v5 as uuidv5 } from 'uuid'

import { imapProviders } from '../shared/store/imapProviders'
import type { Account } from '../shared/types/account'

import type { DiscoveredConfig } from './autoDiscoveryService'
import { getDomains, saveDomain } from './domainService'
import { getLogger } from './logger'
import { isMicrosoftFormat, parseLine } from './oauthAccountParser'
import { DATA_DIR, ensureFileExists } from './storageManager'

export const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.txt')

const ACCOUNT_ID_NAMESPACE = 'fd5a1e70-03e3-4d40-b8b0-3f7b9d10c0f2'

interface ProviderConfig {
  imap: {
    host: string
    port: number
    secure: boolean
  }
  smtp?: {
    host: string
    port: number
    secure: boolean
  }
}

const findProviderConfig = (domain: string): unknown | null => {
  const provider = imapProviders.find(p => p.domains.includes(domain))
  return provider ? provider.config : null
}

export const getAccounts = async (): Promise<Account[]> => {
  try {
    await ensureFileExists(ACCOUNTS_FILE)
    const content = await fsPromises.readFile(ACCOUNTS_FILE, 'utf8')
    const savedDomains = await getDomains()
    const accounts: Account[] = []
    const seenEmails = new Set<string>()

    for (const line of content.split('\n')) {
      const trimmedLine = line.trim()
      if (trimmedLine.length === 0 || trimmedLine.startsWith('#')) {
        continue
      }

      let email: string
      let password: string
      let refreshToken: string | undefined
      let clientId: string | undefined
      let authType: 'basic' | 'oauth2' = 'basic'

      if (isMicrosoftFormat(line)) {
        const microsoftResult = parseLine(line)
        if (microsoftResult.success && microsoftResult.account) {
          const msAccount = microsoftResult.account
          email = msAccount.email
          password = msAccount.password
          refreshToken = msAccount.refreshToken
          clientId = msAccount.clientId
          authType = 'oauth2'
        } else {
          return []
        }
      } else {
        const parts = line.split(':')
        if (parts.length >= 2) {
          email = parts[0]
          password = parts[1]
          refreshToken = parts.length > 2 ? parts[2] : undefined
          clientId = parts.length > 3 ? parts[3] : undefined
          authType = refreshToken && clientId ? 'oauth2' : 'basic'
        } else {
          return []
        }
      }

      if (seenEmails.has(email)) {
        return []
      }
      seenEmails.add(email)
      const domain = email.split('@')[1]

      let incoming: Account['incoming'] = {
        host: 'imap.example.com',
        port: 993,
        useTls: true,
        protocol: 'imap',
      }
      let outgoing: Account['outgoing'] | undefined = undefined

      if (
        (domain?.length ?? 0) > 0 &&
        savedDomains[domain] !== undefined &&
        savedDomains[domain] !== null
      ) {
        const config = savedDomains[domain]
        if (config.imap) {
          incoming = {
            protocol: 'imap',
            host: config.imap.host,
            port: config.imap.port,
            useTls: config.imap.secure,
          }
        }
        if (config.smtp) {
          outgoing = {
            protocol: 'smtp',
            host: config.smtp.host,
            port: config.smtp.port,
            useTls: config.smtp.secure,
          }
        }
      } else {
        const providerConfig = findProviderConfig(domain)
        if (providerConfig) {
          const config = providerConfig as ProviderConfig
          incoming = {
            protocol: 'imap',
            host: config.imap.host,
            port: config.imap.port,
            useTls: config.imap.secure,
          }
          if (config.smtp) {
            outgoing = {
              protocol: 'smtp',
              host: config.smtp.host,
              port: config.smtp.port,
              useTls: config.smtp.secure,
            }
          }
        }
      }

      accounts.push({
        id: uuidv5(email, ACCOUNT_ID_NAMESPACE),
        email,
        password,
        refreshToken,
        clientId,
        authType,
        connectionStatus: 'disconnected',
        incoming,
        outgoing,
      })
    }

    return accounts
  } catch (_error) {
    return []
  }
}

export const setAccounts = async (accounts: Account[]): Promise<void> => {
  try {
    await ensureFileExists(ACCOUNTS_FILE)
    const content = accounts
      .map(a => {
        const parts = [a.email, a.password]
        if (a.refreshToken) parts.push(a.refreshToken)
        if (a.clientId) parts.push(a.clientId)
        return parts.join(':')
      })
      .join('\n')
    await fsPromises.writeFile(ACCOUNTS_FILE, content, 'utf8')
  } catch (_error) {
    // Error saving accounts
  }
}

export const addAccount = async (accountData: Omit<Account, 'id'>): Promise<Account> => {
  const logger = getLogger()
  logger.info({ email: accountData.email }, 'addAccount called')
  const accounts = await getAccounts()

  const existingAccount = accounts.find(acc => acc.email === accountData.email)
  if (existingAccount) {
    throw new Error(`Account with email ${accountData.email} already exists`)
  }

  const newAccount = { id: uuidv5(accountData.email, ACCOUNT_ID_NAMESPACE), ...accountData }
  accounts.push(newAccount)
  await setAccounts(accounts)
  return newAccount
}

export const updateAccount = async (
  accountId: string,
  updates: Partial<Omit<Account, 'id'>>
): Promise<Account | null> => {
  const accounts = await getAccounts()
  const accountIndex = accounts.findIndex(acc => acc.id === accountId)

  if (accountIndex === -1) {
    return null
  }

  const updatedAccountData = { ...accounts[accountIndex], ...updates }
  accounts[accountIndex] = updatedAccountData
  await setAccounts(accounts)

  if (updates.incoming && updatedAccountData.email) {
    const domain = updatedAccountData.email.split('@')[1]
    if (domain !== null && domain !== undefined && !domain.includes('example.com')) {
      const config: DiscoveredConfig = {}
      if (updatedAccountData.incoming) {
        config.imap = {
          host: updatedAccountData.incoming.host,
          port: updatedAccountData.incoming.port,
          secure: updatedAccountData.incoming.useTls,
        }
      }
      if (updatedAccountData.outgoing) {
        config.smtp = {
          host: updatedAccountData.outgoing.host,
          port: updatedAccountData.outgoing.port,
          secure: updatedAccountData.outgoing.useTls,
        }
      }
      await saveDomain(domain, config)
    }
  }

  return updatedAccountData
}

export const removeAccount = async (accountId: string): Promise<void> => {
  const accounts = await getAccounts()
  const filteredAccounts = accounts.filter(a => a.id !== accountId)
  await setAccounts(filteredAccounts)
}

export const addAccounts = async (
  accountsData: Omit<Account, 'id' | 'connectionStatus'>[]
): Promise<Account[]> => {
  const existingAccounts = await getAccounts()
  const existingEmails = new Set(existingAccounts.map(a => a.email))

  const newAccounts = accountsData
    .filter(data => !existingEmails.has(data.email))
    .map(data => ({
      id: uuidv5(data.email, ACCOUNT_ID_NAMESPACE),
      ...data,
      connectionStatus: 'disconnected' as const,
    }))

  if (newAccounts.length > 0) {
    const allAccounts = [...existingAccounts, ...newAccounts]
    await setAccounts(allAccounts)
  }

  return newAccounts
}
