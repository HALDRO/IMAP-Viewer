/**
 * @file Service for handling clipboard operations
 */

import { clipboard } from 'electron'
// import sanitizeFilename from 'sanitize-filename' // Not used, commented out

import type { Account } from '@/shared/types/account'
import type { ClipboardParseResult, CredentialsParseResult } from '../shared/types/electron'
import { getLogger } from './logger'
import { isMicrosoftFormat, parseLine } from './oauthAccountParser'

/**
 * @file Service for handling clipboard operations
 */
export namespace ClipboardService {
  /**
   * Writes text to the clipboard.
   * @param text The text to write.
   */
  export async function writeText(text: string): Promise<void> {
    try {
      clipboard.writeText(text)
      getLogger().info('[Clipboard] Text successfully written to clipboard.')
    } catch (error) {
      getLogger().error(`[Clipboard] Error writing text to clipboard: ${error}`)
      throw new Error('Failed to write to clipboard.')
    }
  }

  /**
   * Reads text from the clipboard.
   * @returns The text from the clipboard.
   */
  export async function readText(): Promise<string> {
    try {
      const text = clipboard.readText()
      getLogger().info('[Clipboard] Text successfully read from clipboard.')
      return text
    } catch (error) {
      getLogger().error(`[Clipboard] Error reading text from clipboard: ${error}`)
      throw new Error('Failed to read from clipboard.')
    }
  }

  /**
   * Clears the clipboard.
   */
  export async function clear(): Promise<void> {
    try {
      clipboard.clear()
      getLogger().info('[Clipboard] Clipboard successfully cleared.')
    } catch (error) {
      getLogger().error(`[Clipboard] Error clearing clipboard: ${error}`)
      throw new Error('Failed to clear clipboard.')
    }
  }

  /**
   * Formats account credentials into various string formats.
   * @param account The account to format.
   * @param format The desired format string.
   * @returns The formatted credential string.
   */
  export function formatCredentials(account: Account, format: string): string {
    const replacements: Record<string, string> = {
      '%email%': account.email,
      '%password%': account.password,
      '%login%': account.email,
      '%pass%': account.password,
      '%host%': account.incoming.host,
      '%port%': account.incoming.port.toString(),
      '%type%': account.incoming.protocol,
      '%proxy%': 'No proxy', // Proxy information is not stored in account object
    }

    let formatted = format
    for (const key in replacements) {
      if (Object.prototype.hasOwnProperty.call(replacements, key)) {
        formatted = formatted.replace(new RegExp(key, 'g'), replacements[key])
      }
    }
    return formatted
  }

  /**
   * Copies formatted account credentials to the clipboard.
   * @param account The account to copy.
   * @param format The format string.
   */
  export async function copyFormattedCredentials(
    account: Account,
    format: string
  ): Promise<string> {
    const formatted = formatCredentials(account, format)
    await writeText(formatted)
    return formatted
  }

  /**
   * Detects credentials from clipboard text
   */
  export async function detectCredentialsFromClipboard(): Promise<ClipboardParseResult> {
    try {
      const clipboardText = await readText()
      if (!clipboardText) {
        return { success: false, error: 'Clipboard is empty' }
      }

      // Try to detect Microsoft OAuth2 format
      if (isMicrosoftFormat(clipboardText)) {
        const result = parseLine(clipboardText)
        if (result.success && result.account) {
          return {
            success: true,
            credentials: {
              email: result.account.email,
              password: result.account.password,
              isOAuth2: true,
              refreshToken: result.account.refreshToken,
              clientId: result.account.clientId,
            },
          }
        }
      }

      // Try basic email:password format
      const lines = clipboardText.split('\n').filter(line => line.trim())
      for (const line of lines) {
        const parts = line.split(/[:;|\t]/)
        if (parts.length >= 2) {
          const email = parts[0].trim()
          const password = parts.slice(1).join(':').trim()
          if (email.includes('@') && password) {
            return {
              success: true,
              credentials: {
                email,
                password,
                isOAuth2: false,
              },
            }
          }
        }
      }

      return { success: false, error: 'No credentials detected in clipboard' }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  /**
   * Parses credentials from text string
   */
  export async function parseCredentialsString(text: string): Promise<CredentialsParseResult> {
    try {
      if (!text) {
        return { success: false, error: 'Text is empty' }
      }

      // Try to detect Microsoft OAuth2 format
      if (isMicrosoftFormat(text)) {
        const result = parseLine(text)
        if (result.success && result.account) {
          return {
            success: true,
            credentials: {
              email: result.account.email,
              password: result.account.password,
              isOAuth2: true,
              refreshToken: result.account.refreshToken,
              clientId: result.account.clientId,
            },
          }
        }
      }

      // Try basic email:password format
      const parts = text.split(/[:;|\t]/)
      if (parts.length >= 2) {
        const email = parts[0].trim()
        const password = parts.slice(1).join(':').trim()
        if (email.includes('@') && password) {
          return {
            success: true,
            credentials: {
              email,
              password,
              isOAuth2: false,
            },
          }
        }
      }

      return { success: false, error: 'No valid credentials found in text' }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  /**
   * Copies account credentials to clipboard
   */
  export async function copyAccountCredentials(email: string, password: string): Promise<boolean> {
    try {
      await writeText(`${email}:${password}`)
      return true
    } catch (_error) {
      return false
    }
  }
}
