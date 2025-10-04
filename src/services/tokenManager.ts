/**
 * @file Simple OAuth2 token manager
 */

import { getLogger } from './logger'
import { getAccessToken } from './msalService'

interface CachedToken {
  accessToken: string
  expiresAt: number
}

interface TokenRequest {
  clientId: string
  refreshToken: string
  proxy?: string
  scope?: string
}

/**
 * Simple token manager with basic caching
 */
class TokenManager {
  private static instance: TokenManager
  private readonly tokenCache = new Map<string, CachedToken>()

  private constructor() {}

  public static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager()
    }
    return TokenManager.instance
  }

  /**
   * Check if token is still valid (with 5 minute buffer)
   */
  private isTokenValid(token: CachedToken | undefined): token is CachedToken {
    if (!token) return false
    const bufferTime = 5 * 60 * 1000 // 5 minutes
    return Date.now() < token.expiresAt - bufferTime
  }

  /**
   * Get access token with simple caching
   */
  public async getAccessToken(request: TokenRequest): Promise<string> {
    const logger = getLogger()
    const cacheKey = `${request.clientId}:${request.refreshToken.slice(-10)}`

    const cachedToken = this.tokenCache.get(cacheKey)
    if (this.isTokenValid(cachedToken)) {
      logger.info({ cacheKey }, 'Returning cached access token')
      return cachedToken.accessToken
    }

    logger.info({ cacheKey }, 'Cached token invalid or not found, fetching new token')
    try {
      const result = await getAccessToken(request.clientId, request.refreshToken, request.proxy)

      const expiresAt = Date.now() + result.expires_in * 1000
      this.tokenCache.set(cacheKey, {
        accessToken: result.access_token,
        expiresAt,
      })

      logger.info(
        { cacheKey, expiresAt: new Date(expiresAt).toISOString() },
        'Successfully fetched and cached new access token'
      )
      return result.access_token
    } catch (error) {
      logger.error({ cacheKey, error: (error as Error).message }, 'Failed to get access token')
      this.tokenCache.delete(cacheKey)
      throw error
    }
  }
}

// Export singleton instance
export const tokenManager = TokenManager.getInstance()
