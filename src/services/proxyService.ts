/**
 * @file Service for managing the proxy list (proxies.txt).
 */
import { promises as fsPromises, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import type { ProxyConfig } from '../shared/types/account'

import { getLogger } from './logger'
import { testProxy as testProxyFromTester } from './proxyTester'
import { DATA_DIR, ensureFileExists } from './storageManager'

export const PROXIES_FILE = path.join(DATA_DIR, 'proxies.txt')

// Store the current index for proxy rotation in memory
let currentProxyIndex = 0

/**
 * Gets the list of proxies from the proxies.txt file.
 * @returns An array of proxy configurations.
 */
export const getProxyList = (): ProxyConfig[] => {
  try {
    // Using sync read here as it's typically done at startup or by user action
    // where a small block is acceptable.
    ensureFileExists(PROXIES_FILE)
    const content = readFileSync(PROXIES_FILE, 'utf8')
    const proxies: ProxyConfig[] = []

    for (const line of content.split('\n')) {
      const trimmedLine = line.trim()
      if (trimmedLine.length === 0 || trimmedLine.startsWith('#')) {
        continue
      }

      const parts = trimmedLine.split(':')
      if (parts.length < 3) continue

      const [type, host, port, username, password] = parts

      proxies.push({
        enabled: true, // Proxies from file are considered enabled by default
        type: type as 'socks5' | 'socks4' | 'https',
        host,
        port: Number.parseInt(port, 10),
        hostPort: `${host}:${port}`,
        auth: !!(username && password),
        username: username || undefined,
        password: password || undefined,
      })
    }

    return proxies
  } catch (error) {
    const logger = getLogger()
    logger.error({ error }, 'Failed to read proxy list.')
    return []
  }
}

/**
 * Saves a list of proxies to the proxies.txt file.
 * @param proxies The array of proxy configurations to save.
 */
export const saveProxyList = (proxies: ProxyConfig[]): void => {
  try {
    const content = proxies
      .map(proxy => {
        const host = proxy.hostPort?.split(':')[0] ?? proxy.host
        const port = proxy.hostPort?.split(':')[1] ?? proxy.port
        const base = `${proxy.type}:${host}:${port}`
        if (proxy.auth && proxy.username && proxy.password) {
          return `${base}:${proxy.username}:${proxy.password}`
        }
        return base
      })
      .join('\n')

    // Using sync write for simplicity, consistent with read.
    writeFileSync(PROXIES_FILE, content, 'utf8')
  } catch (error) {
    const logger = getLogger()
    logger.error({ error }, 'Failed to save proxy list.')
  }
}

/**
 * Gets the next proxy from the rotation list.
 * @returns The next proxy configuration or null if no proxies are available.
 */
export const getNextProxy = (): ProxyConfig | null => {
  const proxies = getProxyList().filter(p => p.enabled)
  if (proxies.length === 0) {
    return null
  }

  if (currentProxyIndex >= proxies.length) {
    currentProxyIndex = 0 // Reset index if it's out of bounds
  }

  const proxy = proxies[currentProxyIndex]
  currentProxyIndex = (currentProxyIndex + 1) % proxies.length // Cycle through

  return proxy
}

/**
 * Tests if a proxy is working by making a request to httpbin.org/ip.
 * Uses the dedicated ProxyTester service with 2 attempts and 3s timeout.
 * @param proxy The proxy configuration to test.
 * @returns A promise that resolves to an object with success status, IP, and error message.
 */
export const testProxy = async (
  proxy: ProxyConfig
): Promise<{ success: boolean; ip?: string; error?: string }> => {
  return testProxyFromTester(proxy)
}
