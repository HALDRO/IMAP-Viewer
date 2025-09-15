/**
 * @file High-performance account import service with data normalization
 * Handles parsing and normalization of IMAP account data from various formats
 */

import { Buffer } from 'buffer';
import fs from 'fs';

import { z } from 'zod';

import type { Account } from '../shared/types/account';
import { MicrosoftAccountParser } from './oauthAccountParser';
import { getLogger } from './logger';

// Validation schema for parsed account data
const parsedAccountSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
  domain: z.string().optional(),
  // OAuth2 fields for Microsoft accounts
  authType: z.enum(['basic', 'oauth2']).optional(),
  clientId: z.string().optional(),
  refreshToken: z.string().optional(),
});

export type ParsedAccount = z.infer<typeof parsedAccountSchema>;

export interface EmailServerConfig {
  imap?: {
    host: string;
    port: number;
    secure: boolean;
  };
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
  };
}

export interface ImportProgress {
  totalLines: number;
  processedLines: number;
  validAccounts: number;
  skippedLines: number;
  currentLine?: string;
  phase: 'reading' | 'parsing' | 'validating' | 'configuring' | 'complete';
}

export interface ImportResult {
  success: boolean;
  accounts: ParsedAccount[];
  skippedLines: number;
  totalLines: number;
  errors: string[];
}

export interface ImportPreview {
  totalLines: number;
  sampleAccounts: ParsedAccount[];
  estimatedValidAccounts: number;
  detectedSeparators: string[];
  fileSize: number;
}

/**
 * Advanced data normalizer for IMAP account files
 */
export class AccountImportService {
  private static readonly SUPPORTED_SEPARATORS = [':', ';', '|', '\t', ','];
  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  private static readonly CHUNK_SIZE = 1024 * 64; // 64KB chunks for streaming
  private static readonly MAX_PREVIEW_LINES = 100;

  /**
   * Detects the most likely separator used in the file
   */
  private static detectSeparator(lines: string[]): string {
    const separatorCounts = new Map<string, number>();
    
    for (const line of lines.slice(0, 50)) { // Check first 50 lines
      if (line.trim().length === 0) continue;
      
      for (const sep of this.SUPPORTED_SEPARATORS) {
        const parts = line.split(sep);
        if (parts.length >= 2 && this.EMAIL_REGEX.test(parts[0].trim())) {
          separatorCounts.set(sep, (separatorCounts.get(sep) ?? 0) + 1);
        }
      }
    }

    // Return the separator with the highest count
    let bestSeparator = ':';
    let maxCount = 0;
    
    for (const [sep, count] of separatorCounts) {
      if (count > maxCount) {
        maxCount = count;
        bestSeparator = sep;
      }
    }

    return bestSeparator;
  }

  /**
   * Normalizes and cleans a single line of account data
   * Uses Strategy pattern to handle both basic and Microsoft OAuth2 formats
   */
  private static normalizeLine(line: string, separator: string): ParsedAccount | null {
    if (!line || line.trim().length === 0) return null;

    // Strategy 1: Try Microsoft OAuth2 format first
    if (MicrosoftAccountParser.isMicrosoftFormat(line)) {
      const microsoftResult = MicrosoftAccountParser.parseLine(line);
      if (microsoftResult.success && microsoftResult.account) {
        const msAccount = microsoftResult.account;
        try {
          const parsed = parsedAccountSchema.parse({
            email: msAccount.email,
            password: msAccount.password,
            domain: msAccount.email.split('@')[1],
            authType: 'oauth2' as const,
            clientId: msAccount.clientId,
            refreshToken: msAccount.refreshToken,
          });
          return parsed;
        } catch {
          return null;
        }
      }
    }

    // Strategy 2: Fallback to basic format parsing
    // Remove common junk characters and normalize whitespace
    // Убираем регулярки - просто нормализуем пробелы и убираем лишние символы в начале/конце
    const cleanLine = line
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    if (!cleanLine) return null;

    const parts = cleanLine.split(separator);
    if (parts.length < 2) return null;

    const email = parts[0].trim();
    const password = parts.slice(1).join(separator).trim();

    // Validate email format
    if (!this.EMAIL_REGEX.test(email)) return null;
    if (!password) return null;

    try {
      const parsed = parsedAccountSchema.parse({
        email,
        password,
        domain: email.split('@')[1],
        authType: 'basic' as const,
      });
      return parsed;
    } catch {
      return null;
    }
  }

  /**
   * Generates a preview of the import file
   */
  static async generatePreview(filePath: string): Promise<ImportPreview> {
    const stats = await fs.promises.stat(filePath);
    const fileSize = stats.size;

    // Read first chunk for preview
    const buffer = Buffer.alloc(Math.min(this.CHUNK_SIZE, fileSize));
    const fd = await fs.promises.open(filePath, 'r');
    await fd.read(buffer, 0, buffer.length, 0);
    await fd.close();

    const content = buffer.toString('utf8');
    const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
    
    // Estimate total lines based on average line length
    const avgLineLength = content.length / lines.length;
    const estimatedTotalLines = Math.ceil(fileSize / avgLineLength);

    // Detect separators
    const detectedSeparators = this.SUPPORTED_SEPARATORS.filter(sep => {
      return lines.some(line => {
        const parts = line.split(sep);
        return parts.length >= 2 && this.EMAIL_REGEX.test(parts[0].trim());
      });
    });

    const primarySeparator = this.detectSeparator(lines);
    
    // Parse sample accounts
    const sampleAccounts: ParsedAccount[] = [];
    let validCount = 0;

    for (const line of lines.slice(0, this.MAX_PREVIEW_LINES)) {
      const parsed = this.normalizeLine(line, primarySeparator);
      if (parsed) {
        validCount++;
        if (sampleAccounts.length < 10) {
          sampleAccounts.push(parsed);
        }
      }
    }

    // Estimate valid accounts in entire file
    const sampleValidRatio = validCount / Math.min(lines.length, this.MAX_PREVIEW_LINES);
    const estimatedValidAccounts = Math.ceil(estimatedTotalLines * sampleValidRatio);

    return {
      totalLines: estimatedTotalLines,
      sampleAccounts,
      estimatedValidAccounts,
      detectedSeparators,
      fileSize,
    };
  }

  /**
   * Parses the entire file with progress reporting
   */
  static async parseFile(
    filePath: string,
    onProgress?: (progress: ImportProgress) => void
  ): Promise<ImportResult> {
    const errors: string[] = [];
    const accounts: ParsedAccount[] = [];
    let totalLines = 0;
    let processedLines = 0;
    let skippedLines = 0;

    try {
      // First pass: count total lines for progress tracking
      onProgress?.({
        totalLines: 0,
        processedLines: 0,
        validAccounts: 0,
        skippedLines: 0,
        phase: 'reading',
      });

      const content = await fs.promises.readFile(filePath, 'utf8');
      const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
      totalLines = lines.length;

      // Detect separator
      const separator = this.detectSeparator(lines);

      onProgress?.({
        totalLines,
        processedLines: 0,
        validAccounts: 0,
        skippedLines: 0,
        phase: 'parsing',
      });

      // Process lines in chunks to avoid blocking
      const chunkSize = 1000;
      for (let i = 0; i < lines.length; i += chunkSize) {
        const chunk = lines.slice(i, i + chunkSize);
        
        for (const line of chunk) {
          processedLines++;
          
          const parsed = this.normalizeLine(line, separator);
          if (parsed) {
            accounts.push(parsed);
          } else {
            skippedLines++;
          }

          // Report progress every 100 lines
          if (processedLines % 100 === 0) {
            onProgress?.({
              totalLines,
              processedLines,
              validAccounts: accounts.length,
              skippedLines,
              currentLine: `${line.substring(0, 50)  }...`,
              phase: 'parsing',
            });
          }
        }

        // Yield control to prevent blocking
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      onProgress?.({
        totalLines,
        processedLines,
        validAccounts: accounts.length,
        skippedLines,
        phase: 'complete',
      });

      return {
        success: true,
        accounts,
        skippedLines,
        totalLines,
        errors,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMessage);
      
      return {
        success: false,
        accounts,
        skippedLines,
        totalLines,
        errors,
      };
    }
  }

  /**
   * Converts parsed accounts to full Account objects with server discovery
   */
  static async configureAccounts(
    parsedAccounts: ParsedAccount[],
    getEmailConfig: (email: string) => Promise<EmailServerConfig | null>,
    onProgress?: (progress: ImportProgress) => void
  ): Promise<Omit<Account, 'id' | 'connectionStatus'>[]> {
    const configuredAccounts: Omit<Account, 'id' | 'connectionStatus'>[] = [];
    
    for (let i = 0; i < parsedAccounts.length; i++) {
      const parsed = parsedAccounts[i];
      
      onProgress?.({
        totalLines: parsedAccounts.length,
        processedLines: i,
        validAccounts: configuredAccounts.length,
        skippedLines: 0,
        currentLine: parsed.email,
        phase: 'configuring',
      });

      try {
        const config = await getEmailConfig(parsed.email);

        const account: Omit<Account, 'id' | 'connectionStatus'> = {
          displayName: parsed.email.split('@')[0],
          email: parsed.email,
          password: parsed.password,
          incoming: (config?.imap !== null && config?.imap !== undefined) ? {
            protocol: 'imap',
            host: config.imap.host,
            port: config.imap.port,
            useTls: config.imap.secure,
          } : {
            protocol: 'imap',
            host: parsed.authType === 'oauth2' ? 'outlook.office365.com' : 'imap.example.com',
            port: 993,
            useTls: true,
          },
          useProxy: false,
          // Add OAuth2 fields if present
          authType: parsed.authType,
          clientId: parsed.clientId,
          refreshToken: parsed.refreshToken,
        };

        if (config?.smtp !== null && config?.smtp !== undefined) {
          account.outgoing = {
            protocol: 'smtp',
            host: config.smtp.host,
            port: config.smtp.port,
            useTls: config.smtp.secure,
          };
        }

        configuredAccounts.push(account);
      } catch (error) {
        // Skip accounts that fail configuration
        const logger = getLogger();
        logger.warn({ error: error instanceof Error ? error.message : String(error), email: parsed.email }, `Failed to configure account ${parsed.email}`);
      }

      // Yield control periodically
      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    onProgress?.({
      totalLines: parsedAccounts.length,
      processedLines: parsedAccounts.length,
      validAccounts: configuredAccounts.length,
      skippedLines: 0,
      phase: 'complete',
    });

    return configuredAccounts;
  }
}
