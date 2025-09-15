/**
 * @file Service for auto-discovering email server settings, now with parallel execution and caching.
 */

import pino from 'pino';
import { discoverViaDns } from './discovery/dnsDiscovery';
import { discoverViaExchangeAutodiscover } from './discovery/exchangeDiscovery';
import { discoverViaProviderList } from './discovery/providerDiscovery';
import type { Logger, DiscoveredConfig, DiscoveryOptions } from './discovery/types';

// In-memory cache for discovered configurations
const configCache = new Map<string, DiscoveredConfig>();

/**
 * Main email configuration discovery function.
 * Tries multiple strategies in parallel and returns the first successful result.
 */
export const discoverEmailConfig = async (
  domain: string,
  logger: Logger = pino({ level: 'silent' }),
  options: DiscoveryOptions = {}
): Promise<DiscoveredConfig | null> => {
  logger.info(`Starting email discovery for domain: ${domain}`);

  if (!domain || domain.length === 0) {
    logger.error('Invalid domain provided');
    return null;
  }

  const normalizedDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, '').toLowerCase().trim();
  logger.info(`Normalized domain: ${normalizedDomain}`);

  const finalDomain = normalizedDomain;

  logger.info(`Final domain for discovery: ${finalDomain}`);

  // Check cache first (skip if force is true)
  if (!options.force && configCache.has(finalDomain)) {
    logger.info(`Returning cached configuration for ${finalDomain}`);
    return configCache.get(finalDomain)!;
  }

  // Clear cache if force is true
  if (options.force && configCache.has(finalDomain)) {
    logger.info(`Force discovery requested - clearing cache for ${finalDomain}`);
    configCache.delete(finalDomain);
  }

  // Create AbortController to cancel remaining strategies when one succeeds
  const abortController = new AbortController();

  const discoveryStrategies: Array<{name: string, promise: Promise<DiscoveredConfig | null>}> = [];

  if (!options.skipProviderList) {
    discoveryStrategies.push({
      name: 'Provider List',
      promise: discoverViaProviderList(finalDomain, logger)
    });
  }
  if (!options.skipDnsGuessing) {
    discoveryStrategies.push({
      name: 'DNS Discovery',
      promise: discoverViaDns(finalDomain, logger)
    });
  }
  if (!options.skipExchangeAutodiscover) {
    discoveryStrategies.push({
      name: 'Exchange Autodiscover',
      promise: discoverViaExchangeAutodiscover(finalDomain, logger)
    });
  }

  // Race all strategies and take the first one that resolves with a non-null value
  logger.info(`Running ${discoveryStrategies.length} discovery strategies for ${finalDomain}`);

  return new Promise<DiscoveredConfig | null>((resolve) => {
    let completedStrategies = 0;
    let hasResolved = false;

    discoveryStrategies.forEach((strategy, index) => {
      strategy.promise.then((res: DiscoveredConfig | null) => {
        completedStrategies++;
        logger.info(`Strategy ${index + 1} (${strategy.name}) completed for ${finalDomain}: ${res ? 'SUCCESS' : 'FAILED'}`);

        if (res && !hasResolved) {
          hasResolved = true;
          // Cancel all other strategies
          logger.info(`Cancelling remaining discovery strategies for ${finalDomain}`);
          abortController.abort();
          logger.info(`Discovery successful for ${finalDomain}`);
          configCache.set(finalDomain, res); // Cache the successful result
          resolve(res);
          return;
        }

        // If all strategies completed and none succeeded
        if (completedStrategies === discoveryStrategies.length && !hasResolved) {
          logger.info(`All discovery strategies failed for ${finalDomain}`);
          abortController.abort(); // Clean up
          resolve(null);
        }
      }).catch((error: any) => {
        completedStrategies++;
        logger.info(`Strategy ${index + 1} (${strategy.name}) failed for ${finalDomain}: ${error.message}`);

        // If all strategies completed and none succeeded
        if (completedStrategies === discoveryStrategies.length && !hasResolved) {
          logger.info(`All discovery strategies failed for ${finalDomain}`);
          abortController.abort(); // Clean up
          resolve(null);
        }
      });
    });
  });

  logger.info(`No email configuration found for ${finalDomain}`);
  return null;
};

/**
 * Simplified discovery function for common use cases.
 */
export const quickDiscoverEmailConfig = async (
  domain: string,
  logger?: Logger
): Promise<DiscoveredConfig | null> => {
  return discoverEmailConfig(domain, logger, {
    skipExchangeAutodiscover: true, // Skip complex Exchange discovery for quick results
  });
};

// Re-export types for convenience
export type { Logger, DiscoveredConfig, DiscoveryOptions } from './discovery/types';