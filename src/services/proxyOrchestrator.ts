/**
 * @file Proxy Management Orchestrator
 * @description This module centralizes the core business logic for proxy management,
 *              decoupling it from React components and hooks. It handles proxy parsing,
 *              normalization, validation, and preparation for bulk operations. This service
 *              acts as a pure data processing layer, ensuring that UI-independent logic
 *              is reusable and easily testable. It provides a stable API for interacting
 *              with proxy data structures, abstracting away the complexities of different
 *              proxy formats and potential data inconsistencies.
 */

import { z } from 'zod'

import type { ProxyItem } from '../shared/types/account'
import { logger as appLogger } from '../shared/utils/logger'
import { extractProxyContent, parseProxyLine } from '../shared/utils/proxyParser'

// Re-export for consistency
export type { ProxyItem }

// ====================================
// ZOD VALIDATION SCHEMA
// ====================================

/**
 * Zod schema for validating a single proxy item.
 * Ensures that proxy objects adhere to a strict and consistent structure.
 */
export const proxySchema = z.object({
  host: z
    .string()
    .trim()
    .min(1, 'Host is required')
    .refine(val => {
      const ipRegex =
        /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
      const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/
      const localhostRegex = /^localhost$/i
      return ipRegex.test(val) || domainRegex.test(val) || localhostRegex.test(val)
    }, 'Invalid host format. Use IP address, domain name, or localhost'),
  port: z.number().min(1, 'Port > 0').max(65535, 'Port < 65536').int('Port must be an integer'),
  username: z.string().trim().optional(),
  password: z.string().trim().optional(),
  type: z.enum(['http', 'https', 'socks4', 'socks5']).optional(),
})

// ====================================
// CORE SERVICE LOGIC
// ====================================

/**
 * Normalizes a proxy object to a consistent format.
 * - Converts host to lowercase.
 * - Trims whitespace from host, username, and password.
 * - Ensures empty credentials are set to `undefined`.
 * - Preserves the explicit proxy type if provided.
 *
 * @param data - The raw proxy data.
 * @returns A normalized `ProxyItem` object.
 */
export const normalizeProxy = (data: Partial<ProxyItem>): ProxyItem => {
  const host = (data.host || '').toLowerCase().trim()
  const port = data.port || 0
  const username = data.username?.trim() || undefined
  const password = data.password?.trim() || undefined
  const type = data.type

  return { host, port, username, password, type }
}

/**
 * Parses a raw text block containing multiple proxy lines into a structured array of ProxyItems.
 * - Extracts proxy data from various formats (JSON, HTML, plain text).
 * - Parses each line into a structured object.
 * - Applies validation and normalization to each proxy.
 * - Shuffles the resulting array if randomization is enabled.
 *
 * @param text - The raw string input from a file or textarea.
 * @param defaultProxyType - The default protocol to assign if not specified in the proxy line.
 * @param randomize - Whether to shuffle the final list of proxies.
 * @returns An array of validated and normalized `ProxyItem` objects.
 */
export const parseProxyImport = (
  text: string,
  defaultProxyType: 'http' | 'https' | 'socks4' | 'socks5',
  randomize: boolean
): ProxyItem[] => {
  try {
    const processedText = extractProxyContent(text)
    if (!processedText) {
      appLogger.error('No processable proxy data found in the input.')
      return []
    }

    const lines = processedText.split('\n').filter(line => line.trim())
    appLogger.info(`Processing ${lines.length} lines from extracted content.`)

    const parsedProxies = lines
      .map(line => parseProxyLine(line.trim(), defaultProxyType))
      .filter((proxy): proxy is ProxyItem => {
        if (!proxy) return false
        const validation = proxySchema.safeParse(proxy)
        if (!validation.success) {
          appLogger.warn(
            `Invalid proxy data skipped: ${JSON.stringify(proxy)} - ${validation.error.flatten().fieldErrors}`
          )
          return false
        }
        return true
      })
      .map(normalizeProxy) // Ensure final normalization

    if (randomize) {
      // Fisher-Yates shuffle for robust randomization
      for (let i = parsedProxies.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[parsedProxies[i], parsedProxies[j]] = [parsedProxies[j], parsedProxies[i]]
      }
      appLogger.info('Proxy list has been successfully shuffled.')
    }

    return parsedProxies
  } catch (error) {
    appLogger.error(
      `Failed to parse proxy import: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
    return []
  }
}

/**
 * Exports an array of ProxyItems to a string format.
 * Each proxy is converted to the format: `socks5://user:pass@host:port`.
 *
 * @param proxies - An array of `ProxyItem` objects.
 * @returns A string with each proxy on a new line.
 */
export const exportProxiesToString = (proxies: ProxyItem[]): string => {
  return proxies
    .map(proxy => {
      const auth = proxy.username && proxy.password ? `${proxy.username}:${proxy.password}@` : ''
      // Default to socks5 for export format consistency if type is missing
      const type = proxy.type || 'socks5'
      return `${type}://${auth}${proxy.host}:${proxy.port}`
    })
    .join('\n')
}
