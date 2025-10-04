/**
 * @file Specialized parser for Microsoft OAuth2 account format
 * Handles parsing of format: email:password:refresh_token:client_id with various separators
 */

import { z } from 'zod'

import { getLogger } from './logger'

const GUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Validation schema for Microsoft OAuth2 account data
const microsoftAccountSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
  refreshToken: z
    .string()
    .min(50, 'Refresh token too short')
    .refine(token => token.includes('.'), { message: 'Refresh token must contain a dot' }),
  clientId: z.string().regex(GUID_REGEX, 'Invalid Client ID format (must be a GUID)'),
})

export type MicrosoftAccount = z.infer<typeof microsoftAccountSchema>

export interface MicrosoftParseResult {
  success: boolean
  account?: MicrosoftAccount
  error?: string
}

// Constants
const SUPPORTED_SEPARATORS = [':', '|', '----']
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MICROSOFT_DOMAINS = [
  'hotmail.com',
  'outlook.com',
  'live.com',
  'msn.com',
  'hotmail.co.uk',
  'outlook.co.uk',
  'live.co.uk',
]

/**
 * Detects if a line contains Microsoft OAuth2 format
 */
export function isMicrosoftFormat(line: string): boolean {
  if (!line || line.trim().length === 0) {
    return false
  }
  return detectSeparator(line.trim()) !== null
}

/**
 * Detects if email domain is Microsoft-related
 */
export function isMicrosoftDomain(email: string): boolean {
  if (!email || !EMAIL_REGEX.test(email)) return false

  const domain = email.split('@')[1]?.toLowerCase()
  return MICROSOFT_DOMAINS.includes(domain)
}

/**
 * Detects the separator used in the line
 */
function detectSeparator(line: string): string | null {
  for (const separator of SUPPORTED_SEPARATORS) {
    const parts = line.split(separator)
    if (parts.length >= 4) {
      // Can be more than 4 if password contains separator
      const [email, , , ...rest] = parts
      const clientId = rest[rest.length - 1]

      if (EMAIL_REGEX.test(email.trim()) && GUID_REGEX.test(clientId.trim())) {
        return separator
      }
    }
  }
  return null
}

/**
 * Extracts account components using a reverse parsing algorithm.
 * This handles cases where the password might contain the separator.
 */
function extractAccountComponents(
  parts: string[],
  separator: string
): Omit<MicrosoftAccount, 'proxy'> {
  const email = parts[0].trim()
  const clientId = parts[parts.length - 1].trim()
  const refreshToken = parts[parts.length - 2].trim()

  // Everything between email and refresh_token is the password
  const passwordParts = parts.slice(1, parts.length - 2)
  const password = passwordParts.join(separator).trim()

  return { email, password, refreshToken, clientId }
}

/**
 * Parses a single line into a Microsoft OAuth2 account.
 */
export function parseLine(line: string): MicrosoftParseResult {
  const logger = getLogger()

  if (!line || line.trim().length === 0) {
    return { success: false, error: 'Empty line' }
  }

  const cleanLine = line.trim()
  const separator = detectSeparator(cleanLine)

  if (!separator) {
    logger.warn({ line: cleanLine }, 'No valid separator or format detected for Microsoft Account')
    return { success: false, error: 'Invalid format or separator not found' }
  }

  try {
    const parts = cleanLine.split(separator)
    if (parts.length < 4) {
      logger.error(
        { line: cleanLine, partsCount: parts.length },
        'Insufficient parts for Microsoft format'
      )
      return { success: false, error: 'Insufficient parts for Microsoft format' }
    }

    const potentialAccount = extractAccountComponents(parts, separator)

    const validationResult = microsoftAccountSchema.safeParse(potentialAccount)

    if (!validationResult.success) {
      const errors = validationResult.error.errors
        .map(e => `${e.path.join('.')}: ${e.message}`)
        .join(', ')
      logger.warn({ line: cleanLine, errors }, 'Validation failed for parsed Microsoft account')
      return { success: false, error: `Validation failed: ${errors}` }
    }

    logger.info(
      { email: validationResult.data.email },
      'Successfully parsed Microsoft OAuth2 account'
    )
    return { success: true, account: validationResult.data }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error(
      { error: errorMessage, line: cleanLine },
      'An unexpected error occurred during parsing'
    )
    return { success: false, error: `Parse error: ${errorMessage}` }
  }
}

/**
 * Parses multiple lines and returns categorized results.
 */
export function parseLines(lines: string[]): {
  successful: MicrosoftAccount[]
  failed: Array<{ line: string; error: string; lineNumber: number }>
} {
  const successful: MicrosoftAccount[] = []
  const failed: Array<{ line: string; error: string; lineNumber: number }> = []

  lines.forEach((line, index) => {
    if (!line || line.trim().length === 0) return

    const result = parseLine(line)
    if (result.success && result.account) {
      successful.push(result.account)
    } else {
      failed.push({
        line: line.substring(0, 100) + (line.length > 100 ? '...' : ''),
        error: result.error || 'Unknown error',
        lineNumber: index + 1,
      })
    }
  })

  return { successful, failed }
}

/**
 * Validates if a client ID is a valid GUID.
 * @deprecated Use Zod schema `microsoftAccountSchema` for validation.
 */
export function isValidClientId(clientId: string): boolean {
  return GUID_REGEX.test(clientId)
}
