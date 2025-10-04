/**
 * @file Types for email discovery services
 */

import type { Logger as PinoLogger } from 'pino'

import type { DiscoveredConfig, ServerConfig } from '../../shared/types/protocol'

export type Logger = PinoLogger

export interface ConnectionTestResult {
  success: boolean
  error?: string
  details?: {
    host: string
    port: number
    secure: boolean
  }
}

export interface DiscoveryStrategy {
  name: string
  discover: (_domain: string, _logger: Logger) => Promise<DiscoveredConfig | null>
}

export interface DiscoveryOptions {
  timeout?: number
  retries?: number
  skipProviderList?: boolean
  skipDnsGuessing?: boolean
  skipExchangeAutodiscover?: boolean
  force?: boolean
}

export type { DiscoveredConfig, ServerConfig }
