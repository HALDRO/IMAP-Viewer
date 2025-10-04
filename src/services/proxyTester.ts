/**
 * @file Modern proxy testing service with axios integration
 * @description Streamlined proxy testing using axios with http-proxy-agent and socks-proxy-agent. Eliminates custom HTTP request handling for better performance and maintainability. Supports HTTP/HTTPS and SOCKS4/5 proxies with configurable timeout and retry logic. Returns structured results with success status, real IP address, and detailed error messages with minimal latency for real-time UI updates.
 */
import axios, { type AxiosInstance } from 'axios'
import { HttpProxyAgent } from 'http-proxy-agent'
import { SocksProxyAgent } from 'socks-proxy-agent'

import type { ProxyConfig } from '../shared/types/account'

import { getLogger } from './logger'

interface ProxyTestConfig {
  timeout?: number // Timeout in milliseconds (default: 3000)
  maxRetries?: number // Number of retry attempts (default: 2)
  testUrl?: string // Test endpoint URL (default: ip-api.com)
  delayBetweenRetries?: number // Delay in ms between retries (default: 0)
}

interface ProxyTestResult {
  success: boolean
  ip?: string
  error?: string
  attemptNumber?: number
  responseTime?: number
}

/**
 * ProxyTester service for testing proxy connectivity and validity using axios
 */
export class ProxyTester {
  private readonly timeout: number
  private readonly maxRetries: number
  private readonly testUrl: string
  private readonly delayBetweenRetries: number
  private readonly logger = getLogger()

  constructor(config: ProxyTestConfig = {}) {
    this.timeout = config.timeout ?? 3000
    this.maxRetries = config.maxRetries ?? 2
    // Fast and reliable endpoint - returns JSON with IP address
    this.testUrl = config.testUrl ?? 'http://ip-api.com/json/?fields=query'
    this.delayBetweenRetries = config.delayBetweenRetries ?? 0
  }

  /**
   * Test a single proxy using axios with appropriate agent
   */
  async testProxy(proxy: ProxyConfig, signal?: AbortSignal): Promise<ProxyTestResult> {
    if (signal?.aborted) {
      this.logger.warn(`Proxy test for ${proxy.host} cancelled before starting`)
      return { success: false, error: 'Test cancelled' }
    }

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      const startTime = Date.now()

      try {
        if (signal?.aborted) {
          throw new Error('Aborted by user')
        }

        this.logger.info(
          `Testing proxy ${proxy.hostPort || `${proxy.host}:${proxy.port}`} (${proxy.type || 'socks5'}) - attempt ${attempt}/${this.maxRetries}`
        )

        const result = await this.makeRequest(proxy, signal)
        const responseTime = Date.now() - startTime

        this.logger.info(
          `✓ Proxy ${proxy.hostPort || `${proxy.host}:${proxy.port}`} OK | IP: ${result.ip} | ${responseTime}ms`
        )

        return {
          ...result,
          attemptNumber: attempt,
          responseTime,
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        const responseTime = Date.now() - startTime

        this.logger.error(
          `✗ Proxy ${proxy.hostPort || `${proxy.host}:${proxy.port}`} failed (attempt ${attempt}/${this.maxRetries}): ${errorMessage}`
        )

        // Check if aborted
        if (signal?.aborted || errorMessage.includes('Aborted')) {
          return {
            success: false,
            error: 'Test cancelled',
            attemptNumber: attempt,
          }
        }

        // Last attempt - return failure
        if (attempt === this.maxRetries) {
          return {
            success: false,
            error: this.simplifyError(errorMessage),
            attemptNumber: attempt,
            responseTime,
          }
        }

        // Delay before retry if configured
        if (this.delayBetweenRetries > 0 && !signal?.aborted) {
          await new Promise((resolve, reject) => {
            const timeoutId = setTimeout(resolve, this.delayBetweenRetries)
            const onAbort = () => {
              clearTimeout(timeoutId)
              reject(new Error('Aborted during retry delay'))
            }
            signal?.addEventListener('abort', onAbort, { once: true })
          })
        }
      }
    }

    return {
      success: false,
      error: 'All retry attempts exhausted',
      attemptNumber: this.maxRetries,
    }
  }

  /**
   * Make request through proxy using axios with appropriate agent
   */
  private async makeRequest(proxy: ProxyConfig, signal?: AbortSignal): Promise<ProxyTestResult> {
    const [proxyHost, proxyPortStr] = (proxy.hostPort || `${proxy.host}:${proxy.port}`).split(':')
    const proxyPort = Number.parseInt(proxyPortStr, 10)
    const proxyType = (proxy.type || 'socks5').toLowerCase()

    // Build proxy URL with authentication if needed
    const authPart =
      proxy.auth && proxy.username
        ? `${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.password ?? '')}@`
        : ''
    const proxyUrl = `${proxyType}://${authPart}${proxyHost}:${proxyPort}`

    this.logger.info(
      `Using proxy: ${proxyType}://${authPart ? '[AUTH]@' : ''}${proxyHost}:${proxyPort}`
    )

    // Create appropriate agent based on proxy type
    let agent: HttpProxyAgent | SocksProxyAgent

    if (proxyType === 'http' || proxyType === 'https') {
      // HTTP/HTTPS proxy - use http-proxy-agent (works for both HTTP and HTTPS)
      agent = new HttpProxyAgent(proxyUrl)
    } else {
      // SOCKS proxy - use socks-proxy-agent
      agent = new SocksProxyAgent(proxyUrl)
    }

    // Create axios instance with proxy agent
    const axiosInstance: AxiosInstance = axios.create({
      timeout: this.timeout,
      httpAgent: agent,
      httpsAgent: agent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: signal as AbortSignal | undefined,
    })

    try {
      const response = await axiosInstance.get(this.testUrl, {
        validateStatus: status => status >= 200 && status < 400,
      })

      // Extract IP from response
      let ip = `${proxyHost}:${proxyPort}`

      if (response.data) {
        // Try to extract IP from various response formats
        if (typeof response.data === 'object') {
          ip = response.data.query || response.data.ip || response.data.origin || ip
        } else if (typeof response.data === 'string') {
          // Try to parse as JSON
          try {
            const parsed = JSON.parse(response.data)
            ip = parsed.query || parsed.ip || parsed.origin || ip
          } catch {
            ip = response.data.trim() || ip
          }
        }
      }

      return { success: true, ip }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
          throw new Error('Connection timeout')
        }
        if (error.code === 'ECONNREFUSED') {
          throw new Error('Connection refused')
        }
        if (error.response) {
          throw new Error(`HTTP ${error.response.status}`)
        }
        throw new Error(error.message || 'Request failed')
      }
      throw error
    }
  }

  /**
   * Simplify error messages for better UX
   */
  private simplifyError(errorMessage: string): string {
    if (errorMessage.includes('timeout')) return 'Timeout'
    if (errorMessage.includes('ECONNREFUSED')) return 'Connection refused'
    if (errorMessage.includes('ENOTFOUND')) return 'Host not found'
    if (errorMessage.includes('ETIMEDOUT')) return 'Connection timeout'
    if (errorMessage.includes('ECONNRESET')) return 'Connection reset'
    if (errorMessage.includes('Unauthorized')) return 'Auth failed'
    if (errorMessage.match(/HTTP \d{3}/)) return errorMessage
    return errorMessage.length > 50 ? 'Connection error' : errorMessage
  }

  /**
   * Test multiple proxies concurrently with batching
   */
  async testProxies(
    proxies: ProxyConfig[],
    concurrency = 500,
    signal?: AbortSignal
  ): Promise<Map<string, ProxyTestResult>> {
    const results = new Map<string, ProxyTestResult>()

    for (let i = 0; i < proxies.length; i += concurrency) {
      if (signal?.aborted) {
        this.logger.warn('Batch testing aborted')
        break
      }

      const batch = proxies.slice(i, i + concurrency)
      const batchResults = await Promise.allSettled(
        batch.map(async proxy => ({
          key: `${proxy.host}:${proxy.port}`,
          result: await this.testProxy(proxy, signal),
        }))
      )

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.set(result.value.key, result.value.result)
        }
      }
    }

    return results
  }
}

// Export singleton instance with default configuration
export const defaultProxyTester = new ProxyTester()

// Export function for backward compatibility
export const testProxy = async (
  proxy: ProxyConfig
): Promise<{ success: boolean; ip?: string; error?: string }> => {
  return defaultProxyTester.testProxy(proxy)
}
