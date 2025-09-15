/**
 * @file Provider-based email discovery
 */

import { imapProviders } from '../../shared/store/imapProviders';

import { isValidEmailServer } from './connectionTesting';
import type { Logger, DiscoveredConfig } from './types';

/**
 * Check if a domain matches a pattern (supports wildcards)
 */
const matchesPattern = (domain: string, pattern: string): boolean => {
  if (pattern === '*') return true;
  if (!pattern.includes('*')) return domain === pattern;

  // Convert pattern to regex
  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*/g, '.*');

  const regex = new RegExp(`^${regexPattern}$`, 'i');
  return regex.test(domain);
};

/**
 * Strategy 1: Look up in our predefined list of common providers.
 */
export const discoverViaProviderList = async (domain: string, logger: Logger): Promise<DiscoveredConfig | null> => {
  logger.info(`[Discovery/S1-Providers] Checking known providers for ${domain}`);

  // First, try exact match
  const exactProvider = imapProviders.find(p => p.domains.includes(domain));
  if (exactProvider) {
    logger.info(`[Discovery/S1-Providers] Found exact match provider: ${exactProvider.name}`);
    return await validateAndReturnConfig(exactProvider, logger);
  }

  // If no exact match, try wildcard patterns
  for (const provider of imapProviders) {
    const matchingDomain = provider.domains.find(d => matchesPattern(domain, d));
    if (matchingDomain) {
      logger.info(`[Discovery/S1-Providers] Found pattern match provider: ${provider.name} (pattern: ${matchingDomain})`);
      return await validateAndReturnConfig(provider, logger);
    }
  }

  // Fallback: try common IMAP patterns
  logger.info(`[Discovery/S1-Providers] No known provider found, trying fallback patterns for ${domain}`);
  return await tryFallbackPatterns(domain, logger);
};

/**
 * Validate provider configuration and return it if valid
 */
const validateAndReturnConfig = async (provider: any, logger: Logger): Promise<DiscoveredConfig | null> => {
  if (provider.config.imap !== null && provider.config.imap !== undefined) {
    const isValid = await isValidEmailServer(
      provider.config.imap.host,
      provider.config.imap.port,
      provider.config.imap.secure,
      logger
    );

    if (isValid) {
      logger.info(`[Discovery/S1-Providers] Successfully validated ${provider.name} IMAP server`);
      return {
        imap: {
          host: provider.config.imap.host,
          port: provider.config.imap.port,
          secure: provider.config.imap.secure
        },
        smtp: provider.config.smtp ? {
          host: provider.config.smtp.host,
          port: provider.config.smtp.port,
          secure: provider.config.smtp.secure
        } : undefined
      };
    }
  }

  logger.info(`[Discovery/S1-Providers] Provider ${provider.name} validation failed`);
  return null;
};

/**
 * Try common fallback patterns for unknown domains
 */
const tryFallbackPatterns = async (domain: string, logger: Logger): Promise<DiscoveredConfig | null> => {
  const fallbackPatterns = [
    `imap.${domain}`,
    `mail.${domain}`,
    `mx.${domain}`,
    `pop.${domain}`
  ];

  for (const host of fallbackPatterns) {
    logger.info(`[Discovery/S1-Providers] Trying fallback pattern: ${host}`);

    const isValid = await isValidEmailServer(host, 993, true, logger);
    if (isValid) {
      logger.info(`[Discovery/S1-Providers] Fallback pattern successful: ${host}`);
      return {
        imap: {
          host: host,
          port: 993,
          secure: true
        },
        smtp: {
          host: host.replace('imap.', 'smtp.').replace('mail.', 'smtp.').replace('mx.', 'smtp.').replace('pop.', 'smtp.'),
          port: 465,
          secure: true
        }
      };
    }
  }

  logger.info(`[Discovery/S1-Providers] All fallback patterns failed for ${domain}`);
  return null;
};
