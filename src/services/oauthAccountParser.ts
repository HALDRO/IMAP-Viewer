/**
 * @file Specialized parser for Microsoft OAuth2 account format
 * Handles parsing of format: email:password:refresh_token:client_id with various separators
 */

import { z } from 'zod';
import { getLogger } from './logger';

// Validation schema for Microsoft OAuth2 account data
const microsoftAccountSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
  refreshToken: z.string().min(10, 'Refresh token too short'),
  clientId: z.string().min(36, 'Client ID too short').max(36, 'Client ID too long'), // GUID длина без регулярки
});

export type MicrosoftAccount = z.infer<typeof microsoftAccountSchema>;

export interface MicrosoftParseResult {
  success: boolean;
  account?: MicrosoftAccount;
  error?: string;
}

/**
 * Specialized parser for Microsoft OAuth2 account format
 */
export class MicrosoftAccountParser {
  private static readonly SUPPORTED_SEPARATORS = [':', '|', '----'];
  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  private static readonly GUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  private static readonly MICROSOFT_DOMAINS = [
    'hotmail.com', 'outlook.com', 'live.com', 'msn.com',
    'hotmail.co.uk', 'outlook.co.uk', 'live.co.uk'
  ];

  /**
   * Detects if a line contains Microsoft OAuth2 format
   */
  static isMicrosoftFormat(line: string): boolean {
    const logger = getLogger();

    if (!line || line.trim().length === 0) {
      logger.debug('Empty line provided to isMicrosoftFormat');
      return false;
    }

    const cleanLine = line.trim();
    logger.debug({
      lineLength: cleanLine.length,
      linePreview: cleanLine.substring(0, 100) + '...'
    }, 'Checking if line is Microsoft OAuth2 format');

    // Try each separator
    for (const separator of this.SUPPORTED_SEPARATORS) {
      const parts = cleanLine.split(separator);

      logger.debug({
        separator,
        partsCount: parts.length,
        expectedParts: 4
      }, `Trying separator: "${separator}"`);

      // Microsoft format should have exactly 4 parts
      if (parts.length === 4) {
        const [email, , , clientId] = parts;
        const emailTrimmed = email.trim();
        const clientIdTrimmed = clientId.trim();

        const isValidEmail = this.EMAIL_REGEX.test(emailTrimmed);
        const isValidGuid = this.GUID_REGEX.test(clientIdTrimmed);

        logger.debug({
          email: emailTrimmed,
          clientId: clientIdTrimmed,
          isValidEmail,
          isValidGuid,
          separator
        }, 'Validating email and GUID parts');

        // Check if first part is email and last part is GUID
        if (isValidEmail && isValidGuid) {
          logger.info({
            separator,
            email: emailTrimmed,
            clientId: clientIdTrimmed
          }, 'Microsoft OAuth2 format detected successfully');
          return true;
        }
      }
    }

    logger.debug('No valid Microsoft OAuth2 format detected');
    return false;
  }

  /**
   * Detects if email domain is Microsoft-related
   */
  static isMicrosoftDomain(email: string): boolean {
    if (!email || !this.EMAIL_REGEX.test(email)) return false;
    
    const domain = email.split('@')[1]?.toLowerCase();
    return this.MICROSOFT_DOMAINS.includes(domain);
  }

  /**
   * Detects the separator used in the line
   */
  private static detectSeparator(line: string): string | null {
    for (const separator of this.SUPPORTED_SEPARATORS) {
      const parts = line.split(separator);
      if (parts.length === 4) {
        const [email, , , clientId] = parts;
        if (this.EMAIL_REGEX.test(email.trim()) && 
            this.GUID_REGEX.test(clientId.trim())) {
          return separator;
        }
      }
    }
    return null;
  }

  /**
   * Parses Microsoft OAuth2 account format using reverse parsing algorithm
   * Algorithm: email:password:refresh_token:client_id
   * - First part: email
   * - Last part: client_id (GUID)
   * - Second to last: refresh_token
   * - Everything in between: password (may contain separators)
   */
  static parseLine(line: string): MicrosoftParseResult {
    const logger = getLogger();

    if (!line || line.trim().length === 0) {
      logger.warn('Empty line provided to parseLine');
      return { success: false, error: 'Empty line' };
    }

    const cleanLine = line.trim();
    logger.info({
      lineLength: cleanLine.length,
      linePreview: cleanLine.substring(0, 100) + '...'
    }, 'Starting Microsoft OAuth2 line parsing');

    const separator = this.detectSeparator(cleanLine);

    logger.info({
      detectedSeparator: separator
    }, 'Separator detection result');

    if (!separator) {
      logger.error('No valid separator detected or invalid format');
      return { success: false, error: 'No valid separator detected or invalid format' };
    }

    try {
      const parts = cleanLine.split(separator);

      logger.info({
        partsCount: parts.length,
        separator,
        expectedMinParts: 4
      }, 'Split line into parts');

      if (parts.length < 4) {
        logger.error({
          partsCount: parts.length,
          parts: parts.map((p, i) => `[${i}]: ${p.substring(0, 20)}...`)
        }, 'Insufficient parts for Microsoft format');
        return { success: false, error: 'Insufficient parts for Microsoft format' };
      }

      // Reverse parsing algorithm
      const email = parts[0].trim();
      const clientId = parts[parts.length - 1].trim();
      const refreshToken = parts[parts.length - 2].trim();

      // Everything between email and refresh_token is password
      // This handles cases where password contains separators
      const passwordParts = parts.slice(1, parts.length - 2);
      const password = passwordParts.join(separator).trim();

      logger.info({
        email,
        passwordLength: password.length,
        refreshTokenLength: refreshToken.length,
        clientId,
        passwordPartsCount: passwordParts.length
      }, 'Extracted account components using reverse parsing');

      // Validate extracted components
      const account = {
        email,
        password,
        refreshToken,
        clientId,
      };

      // Use Zod for validation
      const validationResult = microsoftAccountSchema.safeParse(account);

      if (!validationResult.success) {
        const errors = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        logger.error({
          validationErrors: errors,
          account: {
            email: account.email,
            passwordLength: account.password.length,
            refreshTokenLength: account.refreshToken.length,
            clientId: account.clientId
          }
        }, 'Validation failed for parsed account');
        return { success: false, error: `Validation failed: ${errors}` };
      }

      logger.info({
        email: validationResult.data.email,
        clientId: validationResult.data.clientId
      }, 'Successfully parsed and validated Microsoft OAuth2 account');

      return { success: true, account: validationResult.data };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({
        error: errorMessage,
        linePreview: cleanLine.substring(0, 100) + '...'
      }, 'Parse error occurred');

      return {
        success: false,
        error: `Parse error: ${errorMessage}`
      };
    }
  }

  /**
   * Parses multiple lines and returns results
   */
  static parseLines(lines: string[]): {
    successful: MicrosoftAccount[];
    failed: Array<{ line: string; error: string; lineNumber: number }>;
  } {
    const successful: MicrosoftAccount[] = [];
    const failed: Array<{ line: string; error: string; lineNumber: number }> = [];

    lines.forEach((line, index) => {
      if (!line || line.trim().length === 0) return;

      const result = this.parseLine(line);
      if (result.success && result.account) {
        successful.push(result.account);
      } else {
        failed.push({
          line: line.substring(0, 100) + (line.length > 100 ? '...' : ''),
          error: result.error || 'Unknown error',
          lineNumber: index + 1,
        });
      }
    });

    return { successful, failed };
  }

  /**
   * Validates if a refresh token looks valid (basic heuristics)
   */
  static isValidRefreshToken(token: string): boolean {
    if (!token || token.length < 50) return false;

    // Убираем регулярки - проверяем только базовые требования
    // Microsoft refresh tokens должны быть достаточно длинными и содержать точки
    return token.length > 50 && token.includes('.');
  }

  /**
   * Validates if a client ID is a valid GUID
   */
  static isValidClientId(clientId: string): boolean {
    return this.GUID_REGEX.test(clientId);
  }
}
