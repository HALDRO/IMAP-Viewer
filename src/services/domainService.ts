/**
 * @file Service for managing cached email domain configurations (domains.txt).
 */
import { promises as fsPromises } from 'node:fs'
import path from 'node:path'

import type { DiscoveredConfig } from './autoDiscoveryService'
import { getLogger } from './logger'
import { DATA_DIR, ensureFileExists } from './storageManager'

export const DOMAINS_FILE = path.join(DATA_DIR, 'domains.txt')

/**
 * Reads all cached domain configurations from domains.txt.
 * @returns A record mapping domain names to their discovered configurations.
 */
export const getDomains = async (): Promise<Record<string, DiscoveredConfig>> => {
  try {
    await ensureFileExists(DOMAINS_FILE)
    const content = await fsPromises.readFile(DOMAINS_FILE, 'utf8')
    const domains: Record<string, DiscoveredConfig> = {}

    for (const line of content.split('\n')) {
      const trimmedLine = line.trim()
      if (trimmedLine.length === 0 || trimmedLine.startsWith('#')) {
        continue
      }

      const separatorIndex = trimmedLine.indexOf(':')
      if (separatorIndex === -1) continue

      const domain = trimmedLine.substring(0, separatorIndex)
      const configString = trimmedLine.substring(separatorIndex + 1)

      if (domain && configString) {
        const [imapStr, smtpStr] = configString.split('|')
        const config: DiscoveredConfig = {}

        if (imapStr) {
          const [host, port, secure] = imapStr.split(':')
          if (host && port && secure) {
            config.imap = { host, port: Number.parseInt(port, 10), secure: secure === 'true' }
          }
        }
        if (smtpStr) {
          const [host, port, secure] = smtpStr.split(':')
          if (host && port && secure) {
            config.smtp = { host, port: Number.parseInt(port, 10), secure: secure === 'true' }
          }
        }
        domains[domain] = config
      }
    }

    return domains
  } catch (error) {
    const logger = getLogger()
    logger.error({ error }, 'Failed to read domains file, returning empty object.')
    return {}
  }
}

/**
 * Saves a domain and its configuration to the cache.
 * @param domain The domain name (e.g., 'gmail.com').
 * @param config The configuration object from auto-discovery.
 */
export const saveDomain = async (domain: string, config: DiscoveredConfig): Promise<void> => {
  try {
    if (!domain || domain.includes('example.com')) {
      return
    }
    if (config.imap?.host?.includes('example.com') || config.smtp?.host?.includes('example.com')) {
      return
    }

    const domains = await getDomains()
    const newDomains = { ...domains, [domain]: config }

    const content = Object.entries(newDomains)
      .map(([d, c]) => {
        const imapPart = c.imap ? `${c.imap.host}:${c.imap.port}:${c.imap.secure}` : ''
        const smtpPart = c.smtp ? `${c.smtp.host}:${c.smtp.port}:${c.smtp.secure}` : ''
        return `${d}:${imapPart}|${smtpPart}`
      })
      .join('\n')

    await fsPromises.writeFile(DOMAINS_FILE, content, 'utf8')
  } catch (error) {
    const logger = getLogger()
    logger.error({ error, domain }, 'Failed to save domain configuration.')
  }
}

/**
 * Removes a domain from the cache.
 * @param domain The domain name to remove.
 */
export const removeDomain = async (domain: string): Promise<void> => {
  try {
    const domains = await getDomains()
    delete domains[domain]

    const content = Object.entries(domains)
      .map(([d, c]) => {
        const imapPart = c.imap ? `${c.imap.host}:${c.imap.port}:${c.imap.secure}` : ''
        const smtpPart = c.smtp ? `${c.smtp.host}:${c.smtp.port}:${c.smtp.secure}` : ''
        return `${d}:${imapPart}|${smtpPart}`
      })
      .join('\n')

    await fsPromises.writeFile(DOMAINS_FILE, content, 'utf8')
  } catch (error) {
    const logger = getLogger()
    logger.error({ error, domain }, 'Failed to remove domain from cache.')
  }
}
