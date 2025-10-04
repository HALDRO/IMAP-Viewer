/**
 * @file Universal proxy content extractor and parser using pure regex.
 * @description Zero-dependency, format-agnostic proxy extraction system. Works with ANY content type (HTML, JSON, plain text, XML, binary trash) by using aggressive text preprocessing and regex pattern matching. No platform-specific logic, no URL parsing - just brute-force content extraction. Features: (1) Aggressive HTML/JSON cleanup before regex matching; (2) Multi-format proxy line parser supporting all common formats; (3) Intelligent type detection with fallback chain. Philosophy: dump any content, strip all markup/JSON, extract proxies via regex. Simple, universal, works everywhere.
 */

import { z } from 'zod'

import type { ProxyItem } from '../types/account'
import { logger as appLogger } from './logger'

/**
 * Aggressive content cleanup - strips HTML, JSON, entities to extract raw text
 * Works with ANY format: GitHub blob HTML, GitLab UI, Pastebin, JSON APIs, etc.
 */
const cleanupContent = (content: string): string => {
  let cleaned = content

  // Decode HTML entities: &#58; → :, &quot; → ", &amp; → &, etc.
  cleaned = cleaned
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')

  // Remove ALL HTML tags completely: <div>, </div>, <span class="x">, etc.
  cleaned = cleaned.replace(/<[^>]*>/g, ' ')

  // Remove JSON noise: quotes, brackets, commas that wrap proxy data
  cleaned = cleaned.replace(/["'{}\[\],]/g, ' ')

  // Normalize whitespace: multiple spaces/tabs/newlines → single space
  cleaned = cleaned.replace(/\s+/g, ' ')

  return cleaned
}

/**
 * Universal proxy extractor - works with ANY content format
 * Strategy: aggressive cleanup → regex extraction → deduplicate
 */
export const extractProxyContent = (content: string): string => {
  if (!content || content.trim().length === 0) {
    appLogger.error('Empty content received')
    return ''
  }

  appLogger.info(`Processing content of length: ${content.length} chars`)

  // Step 1: Aggressive cleanup - strip HTML, JSON, entities
  const cleanedContent = cleanupContent(content)
  appLogger.info(`After cleanup: ${cleanedContent.length} chars`)

  // Step 2: Master regex patterns for ALL proxy formats
  const proxyPatterns = [
    // 1. Protocol format: socks5://host:port or socks5://user:pass@host:port
    /(?:socks[45]|https?):\/\/(?:([^\s:@]+):([^\s:@]+)@)?([a-zA-Z0-9.-]+):(\d{1,5})/g,

    // 2. Simple IP:port format: 192.168.1.1:8080
    /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d{1,5})/g,

    // 3. Domain:port format: proxy.example.com:8080
    /([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+):(\d{1,5})/g,

    // 4. Type:host:port:user:pass format: socks5:host:1080:user:pass
    /(?:socks[45]|https?):([a-zA-Z0-9.-]+):(\d{1,5})(?::([^\s:]+):([^\s:]+))?/g,
  ]

  const foundProxies = new Set<string>()

  // Step 3: Run all patterns and collect unique matches
  for (const pattern of proxyPatterns) {
    const matches = cleanedContent.matchAll(pattern)
    for (const match of matches) {
      const fullMatch = match[0].trim()
      if (fullMatch.length > 0) {
        foundProxies.add(fullMatch)
      }
    }
  }

  if (foundProxies.size > 0) {
    const result = Array.from(foundProxies).join('\n')
    appLogger.info(`Extracted ${foundProxies.size} unique proxy entries via regex`)
    return result
  }

  appLogger.warn('No proxy patterns found in content')
  return ''
}

/**
 * Universal proxy line parser that supports multiple formats
 * Supports: host:port, host:port:user:pass, type://host:port, type://user:pass@host:port, type:host:port:user:pass
 *
 * Type determination logic (priority order):
 * 1. Explicitly specified in proxy string (socks5://host:port) → use it
 * 2. defaultType from UI configuration → use it
 * 3. Fallback → socks5
 *
 * @param line - Proxy string to parse
 * @param defaultType - Default type from UI configuration (used when type not specified in proxy string)
 */
export const parseProxyLine = (
  line: string,
  defaultType?: 'http' | 'https' | 'socks4' | 'socks5'
): ProxyItem | null => {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) return null

  let host: string
  let port: number
  let username: string | undefined
  let password: string | undefined
  let type: 'socks5' | 'socks4' | 'https' | 'http' | undefined
  let typeExplicitlySpecified = false

  try {
    if (trimmed.includes('://')) {
      // Format: type://host:port or type://username:password@host:port
      const [protocolPart, rest] = trimmed.split('://')
      if (!rest) {
        return null
      }

      const normalizedProtocol = protocolPart.toLowerCase()

      // Map common protocol names - type explicitly specified in proxy string
      if (normalizedProtocol === 'http') {
        type = 'http'
        typeExplicitlySpecified = true
      } else if (['socks5', 'socks4', 'https'].includes(normalizedProtocol)) {
        type = normalizedProtocol as 'socks5' | 'socks4' | 'https'
        typeExplicitlySpecified = true
      }

      if (rest.includes('@')) {
        const atIndex = rest.lastIndexOf('@')
        const auth = rest.substring(0, atIndex)
        const hostPort = rest.substring(atIndex + 1)

        const authParts = auth.split(':')
        username = authParts[0]
        password = authParts.slice(1).join(':') // Handle passwords with colons

        const hostPortParts = hostPort.split(':')
        host = hostPortParts[0]
        port = Number.parseInt(hostPortParts[1], 10)
      } else {
        const hostPortParts = rest.split(':')
        host = hostPortParts[0]
        port = Number.parseInt(hostPortParts[1], 10)
      }
    } else {
      // Format: host:port, host:port:user:pass, or type:host:port:user:pass
      const parts = trimmed.split(':')

      if (parts.length >= 2) {
        // Check if first part might be a protocol type
        const firstPart = parts[0].toLowerCase()
        if (['socks5', 'socks4', 'https', 'http'].includes(firstPart)) {
          // Type explicitly specified: type:host:port:user:pass format
          type = firstPart as 'socks5' | 'socks4' | 'https' | 'http'
          typeExplicitlySpecified = true
          host = parts[1]
          port = Number.parseInt(parts[2], 10)

          if (parts.length >= 5) {
            username = parts[3]
            password = parts[4]
          }
        } else {
          // Standard host:port:user:pass format - type NOT specified
          host = parts[0]
          port = Number.parseInt(parts[1], 10)

          if (parts.length >= 4) {
            username = parts[2]
            password = parts[3]
          }
        }
      } else {
        return null
      }
    }

    // Validate parsed data
    if (!host || Number.isNaN(port) || port <= 0 || port > 65535) {
      return null
    }

    // Clean and validate host
    host = host.trim()
    if (host.length === 0) {
      return null
    }

    // PRIORITY SYSTEM (DO NOT CHANGE):
    // 1. Explicitly specified in proxy string (http://host:port or type:host:port) → HIGHEST
    // 2. defaultType from UI config (only if not specified in string) → MEDIUM
    // 3. Fallback to 'socks5' (if nothing specified) → LOWEST
    const finalType = typeExplicitlySpecified ? type : defaultType || 'socks5'

    return {
      host,
      port,
      username: username?.trim() || undefined,
      password: password?.trim() || undefined,
      type: finalType,
    }
  } catch {
    // If parsing fails, return null silently (too many false positives to log)
    return null
  }
}
