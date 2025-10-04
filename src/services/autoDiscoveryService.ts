/**
 * @file Service for auto-discovering email server settings, now with parallel execution and caching.
 */

import pino from 'pino'

import { discoverViaDns } from './discovery/dnsDiscovery'
import { discoverViaExchangeAutodiscover } from './discovery/exchangeDiscovery'
import { discoverViaProviderList } from './discovery/providerDiscovery'
import type { DiscoveredConfig, DiscoveryOptions, Logger } from './discovery/types'
import { getDomains, removeDomain, saveDomain } from './domainService'

/**
 * Main email configuration discovery function.
 * Tries multiple strategies in parallel and returns the first successful result.
 * It now uses a persistent file-based cache.
 */
export const discoverEmailConfig = async (
  domain: string,
  logger: Logger = pino({ level: 'silent' }),
  options: DiscoveryOptions = {}
): Promise<DiscoveredConfig | null> => {
  logger.info({ domain, options }, 'Starting email discovery')

  if (domain === null || domain === undefined || domain.length === 0) {
    logger.error('Invalid domain provided: cannot be empty.')
    return null
  }

  const finalDomain = domain.toLowerCase().trim()

  // If forcing discovery, remove from persistent cache first
  if (options.force === true) {
    logger.info({ domain: finalDomain }, 'Force discovery requested, removing from cache.')
    await removeDomain(finalDomain)
  } else {
    // Check persistent cache first
    const cachedDomains = await getDomains()
    if (cachedDomains[finalDomain]) {
      logger.info({ domain: finalDomain }, 'Returning cached configuration from file.')
      return cachedDomains[finalDomain]
    }
  }

  const abortController = new AbortController()
  const discoveryStrategies = [
    {
      name: 'Provider List',
      promise: discoverViaProviderList(finalDomain, logger),
      enabled: options.skipProviderList !== true,
    },
    {
      name: 'DNS Discovery',
      promise: discoverViaDns(finalDomain, logger),
      enabled: options.skipDnsGuessing !== true,
    },
    {
      name: 'Exchange Autodiscover',
      promise: discoverViaExchangeAutodiscover(finalDomain, logger),
      enabled: options.skipExchangeAutodiscover !== true,
    },
  ].filter(s => s.enabled === true)

  logger.info(
    { domain: finalDomain, count: discoveryStrategies.length },
    'Running discovery strategies.'
  )

  try {
    const result = await Promise.race(
      discoveryStrategies.map(async strategy => {
        const res = await strategy.promise
        if (res) {
          logger.info({ domain: finalDomain, strategy: strategy.name }, 'Discovery successful.')
          return res
        }
        // Throw to signal failure for this strategy, allowing Promise.any to proceed
        throw new Error(`Strategy ${strategy.name} failed`)
      })
    )

    if (result !== null && result !== undefined) {
      await saveDomain(finalDomain, result) // Cache the successful result
      return result
    }
  } catch (_error) {
    // This block is expected to be hit when all promises in Promise.any reject.
    logger.warn({ domain: finalDomain }, 'All discovery strategies failed.')
  } finally {
    abortController.abort() // Clean up any ongoing requests
  }

  return null
}

/**
 * Simplified discovery function for common use cases.
 */
export const quickDiscoverEmailConfig = async (
  domain: string,
  logger?: Logger
): Promise<DiscoveredConfig | null> => {
  return discoverEmailConfig(domain, logger, {
    skipExchangeAutodiscover: true, // Skip complex Exchange discovery for quick results
  })
}

// Re-export types for convenience
export type { Logger, DiscoveredConfig, DiscoveryOptions } from './discovery/types'
