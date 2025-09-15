/**
 * @file Service for clipboard operations and credential parsing
 */

import { clipboard } from 'electron';
import { MicrosoftAccountParser } from './oauthAccountParser';
import { getLogger } from './logger';

export interface ParsedCredentials {
  email: string;
  password: string;
  refreshToken?: string;
  clientId?: string;
  isOAuth2?: boolean;
}

export interface ClipboardParseResult {
  success: boolean;
  credentials?: ParsedCredentials;
  error?: string;
}

/**
 * Service for handling clipboard operations
 */
export class ClipboardService {
  /**
   * Attempts to read text from clipboard
   */
  static async readText(): Promise<string | null> {
    try {
      const text = clipboard.readText();
      return text || null;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log('Could not read clipboard content:', error);
      return null;
    }
  }

  /**
   * Writes text to clipboard
   */
  static async writeText(text: string): Promise<boolean> {
    try {
      clipboard.writeText(text);
      return true;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Could not write to clipboard:', error);
      return false;
    }
  }

  /**
   * Parses credentials string with common separators
   */
  static parseCredentialsString(text: string): ClipboardParseResult {
    // Regex to find common separators
    const separators = /[:;|]/;

    // Check if the input value contains a separator
    if (separators.test(text)) {
      // Split the string into email and password parts
      const parts = text.split(separators);
      if (parts.length >= 2) {
        const extractedEmail = parts[0].trim();
        // Join the rest of the parts in case the separator exists in the password
        const extractedPassword = parts.slice(1).join(parts[0].match(separators)?.[0] ?? '').trim();

        // Validate email format
        if (/^\S+@\S+\.\S+$/.test(extractedEmail) && (extractedPassword?.length ?? 0) > 0) {
          return {
            success: true,
            credentials: {
              email: extractedEmail,
              password: extractedPassword
            }
          };
        }
      }
    }

    return {
      success: false,
      error: 'Invalid credentials format'
    };
  }

  /**
   * Attempts to detect and parse credentials from clipboard
   */
  static async detectCredentialsFromClipboard(): Promise<ClipboardParseResult> {
    const logger = getLogger();
    const clipboardText = await this.readText();

    logger.info({
      hasClipboardText: !!clipboardText,
      clipboardLength: clipboardText?.length || 0,
      clipboardPreview: clipboardText?.substring(0, 50) + '...'
    }, 'Starting clipboard credentials detection');

    if (clipboardText === null || clipboardText === undefined || clipboardText.length === 0) {
      logger.warn('Could not read clipboard or clipboard is empty');
      return {
        success: false,
        error: 'Could not read clipboard'
      };
    }

    // First, try to parse as Microsoft OAuth2 format
    const isMicrosoftFormat = MicrosoftAccountParser.isMicrosoftFormat(clipboardText);
    logger.info({
      isMicrosoftFormat,
      clipboardSample: clipboardText.substring(0, 100) + '...'
    }, 'Checking if clipboard contains Microsoft OAuth2 format');

    if (isMicrosoftFormat) {
      logger.info('Microsoft OAuth2 format detected, attempting to parse');
      const microsoftResult = MicrosoftAccountParser.parseLine(clipboardText);

      logger.info({
        parseSuccess: microsoftResult.success,
        hasAccount: !!microsoftResult.account,
        error: microsoftResult.error
      }, 'Microsoft OAuth2 parsing result');

      if (microsoftResult.success && microsoftResult.account) {
        const credentials = {
          email: microsoftResult.account.email,
          password: microsoftResult.account.password,
          refreshToken: microsoftResult.account.refreshToken,
          clientId: microsoftResult.account.clientId,
          isOAuth2: true,
        };

        logger.info({
          email: credentials.email,
          hasRefreshToken: !!credentials.refreshToken,
          refreshTokenLength: credentials.refreshToken?.length,
          clientId: credentials.clientId,
          isOAuth2: credentials.isOAuth2
        }, 'Successfully parsed Microsoft OAuth2 credentials');

        return {
          success: true,
          credentials
        };
      } else {
        logger.error({
          error: microsoftResult.error
        }, 'Failed to parse Microsoft OAuth2 format despite detection');
      }
    } else {
      logger.info('Microsoft OAuth2 format not detected, trying basic parsing');
    }

    // Fallback to basic credentials parsing
    const separators = /[:;|]/;
    const hasSeparators = separators.test(clipboardText);

    logger.info({
      hasSeparators,
      clipboardLength: clipboardText.length
    }, 'Attempting basic credentials parsing');

    if (hasSeparators) {
      const parts = clipboardText.split(separators);
      const email = parts[0].trim();
      const password = parts.slice(1).join(parts[0].match(separators)?.[0] ?? '').trim();

      logger.info({
        partsCount: parts.length,
        email,
        passwordLength: password?.length || 0
      }, 'Basic parsing extracted parts');

      const emailRegex = /^\S+@\S+\.\S+$/;
      const isValidEmail = emailRegex.test(email);
      const hasPassword = (password?.length ?? 0) > 0;

      logger.info({
        isValidEmail,
        hasPassword
      }, 'Basic parsing validation');

      if (isValidEmail && hasPassword) {
        const credentials = { email, password, isOAuth2: false };
        logger.info({
          email: credentials.email,
          isOAuth2: credentials.isOAuth2
        }, 'Successfully parsed basic credentials');

        return {
          success: true,
          credentials
        };
      } else {
        logger.warn('Clipboard content resembles credentials but format is invalid');
        return {
          success: false,
          error: 'Clipboard content resembles credentials but format is invalid'
        };
      }
    }

    logger.warn('No credentials pattern found in clipboard');
    return {
      success: false,
      error: 'No credentials pattern found in clipboard'
    };
  }

  /**
   * Formats account credentials for clipboard
   */
  static formatAccountCredentials(email: string, password: string): string {
    return `${email}:${password}`;
  }

  /**
   * Copies account credentials to clipboard
   */
  static async copyAccountCredentials(email: string, password: string): Promise<boolean> {
    const formatted = this.formatAccountCredentials(email, password);
    return await this.writeText(formatted);
  }
}
