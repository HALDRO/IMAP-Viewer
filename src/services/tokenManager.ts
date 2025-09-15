/**
 * @file Simple OAuth2 token manager
 */

import { MsalService } from './msalService';

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

interface TokenRequest {
  clientId: string;
  refreshToken: string;
  proxy?: string;
  scope?: string;
}

/**
 * Simple token manager with basic caching
 */
export class TokenManager {
  private static instance: TokenManager;
  private tokenCache = new Map<string, CachedToken>();

  private constructor() {}

  public static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }

  /**
   * Check if token is still valid (with 5 minute buffer)
   */
  private isTokenValid(token: CachedToken): boolean {
    const bufferTime = 5 * 60 * 1000; // 5 minutes
    return Date.now() < (token.expiresAt - bufferTime);
  }

  /**
   * Get access token with simple caching
   */
  public async getAccessToken(request: TokenRequest): Promise<string> {
    const cacheKey = `${request.clientId}:${request.refreshToken}`;
    
    // Check cache first
    const cachedToken = this.tokenCache.get(cacheKey);
    if (cachedToken && this.isTokenValid(cachedToken)) {
      return cachedToken.accessToken;
    }

    // Get new token (without scope as Microsoft API rejects any scope)
    const result = await MsalService.getAccessToken(
      request.clientId,
      request.refreshToken,
      request.proxy
      // No scope parameter - Microsoft API only accepts requests without scope
    );

    // Cache the token
    const expiresAt = Date.now() + (result.expires_in * 1000);
    this.tokenCache.set(cacheKey, {
      accessToken: result.access_token,
      expiresAt,
    });

    return result.access_token;
  }
}

// Export singleton instance
export const tokenManager = TokenManager.getInstance();
