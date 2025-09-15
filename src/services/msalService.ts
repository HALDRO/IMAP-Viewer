import axios, { AxiosError } from 'axios';
import { getLogger } from './logger';

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export interface MsalError {
  error: string;
  error_description: string;
  error_codes?: number[];
  timestamp?: string;
  trace_id?: string;
  correlation_id?: string;
}

export class MsalService {
  private static readonly TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";



  /**
   * Manual URL encoding for form data to ensure proper encoding
   */
  private static encodeFormData(data: Record<string, string>): string {
    return Object.entries(data)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
  }

  /**
   * Validates if refresh token looks like a Microsoft refresh token
   */
  private static validateMicrosoftRefreshToken(token: string): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Microsoft refresh tokens are typically 400+ characters
    if (token.length < 300) {
      issues.push(`Token too short: ${token.length} chars (expected 300+)`);
    }

    // Should start with specific patterns
    if (!token.startsWith('M.') && !token.startsWith('0.') && !token.startsWith('1.')) {
      issues.push(`Unexpected token prefix: ${token.substring(0, 10)}`);
    }

    // Should contain mostly alphanumeric and specific special chars
    const validChars = /^[A-Za-z0-9._!*-]+$/;
    if (!validChars.test(token)) {
      issues.push('Contains invalid characters for Microsoft token');
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }

  /**
   * Gets access token using refresh token (without scope as Microsoft API rejects any scope)
   */
  static async getAccessToken(
    clientId: string,
    refreshToken: string,
    proxy?: string
  ): Promise<TokenResponse> {
    const logger = getLogger();

    // Validate refresh token format
    const tokenValidation = this.validateMicrosoftRefreshToken(refreshToken);

    // DIAGNOSTIC LOGGING - Using error level to ensure visibility
    logger.error(`DIAGNOSTIC: MsalService token request starting`);
    logger.error(`DIAGNOSTIC: Client ID: ${clientId}`);
    logger.error(`DIAGNOSTIC: Refresh token length: ${refreshToken.length} chars`);
    logger.error(`DIAGNOSTIC: Refresh token first 10: ${refreshToken.substring(0, 10)}`);
    logger.error(`DIAGNOSTIC: Refresh token last 10: ${refreshToken.substring(refreshToken.length - 10)}`);
    logger.error(`DIAGNOSTIC: Token has special chars: ${/[^A-Za-z0-9._-]/.test(refreshToken)}`);
    logger.error(`DIAGNOSTIC: Token validation: ${JSON.stringify(tokenValidation)}`);
    logger.error(`DIAGNOSTIC: Scope: NONE (Microsoft API rejects any scope)`);
    logger.error(`DIAGNOSTIC: Proxy: ${proxy || 'none'}`);

    // CRITICAL: Let's see the EXACT refresh token being sent
    logger.error(`DIAGNOSTIC: EXACT REFRESH TOKEN: ${refreshToken}`);

    // ADVANCED DIAGNOSTIC: Token analysis
    logger.error(`DIAGNOSTIC: Token starts with M.: ${refreshToken.startsWith('M.')}`);
    logger.error(`DIAGNOSTIC: Token contains dots: ${(refreshToken.match(/\./g) || []).length} dots`);
    logger.error(`DIAGNOSTIC: Token base64 parts: ${refreshToken.split('.').length} parts`);

    if (!tokenValidation.isValid) {
      logger.warn(`Invalid Microsoft refresh token format: ${tokenValidation.issues.join(', ')}`);
    }

    // Create request body without scope (Microsoft API rejects any scope)
    const formData = {
      client_id: clientId,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
      // No scope - Microsoft API only accepts requests without scope
    };
    const requestBody = this.encodeFormData(formData);

    logger.error(`DIAGNOSTIC: HTTP Request - No scope method`);
    logger.error(`DIAGNOSTIC: Request URL: ${this.TOKEN_URL}`);
    logger.error(`DIAGNOSTIC: Body length: ${requestBody.length} chars`);
    logger.error(`DIAGNOSTIC: Body preview: ${requestBody.replace(/refresh_token=[^&]+/, 'refresh_token=[HIDDEN]')}`);
    logger.error(`DIAGNOSTIC: Content-Type: application/x-www-form-urlencoded`);

    const config = {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate, br'
      },
      timeout: 30000, // 30 seconds timeout
    };

    // Attempt with proxy first (if provided)
    if (proxy) {
      try {
        logger.info(`[MsalService] Attempting token request with proxy: ${proxy}`);
        const response = await axios.post(this.TOKEN_URL, requestBody, config);
        logger.info(`[MsalService] Token request with proxy successful, status: ${response.status}`);
        return this.validateTokenResponse(response.data);
      } catch (error) {
        const proxyError = this.handleTokenError(error, 'with proxy');
        logger.warn(`[MsalService] Token request failed with proxy, trying without proxy: ${proxyError.message}`);
      }
    }

    // Make direct request without proxy (Microsoft API only accepts requests without scope)
    try {
      logger.info(`[MsalService] Attempting token request without proxy`);
      const response = await axios.post(this.TOKEN_URL, requestBody, config);
      logger.info({ status: response.status, responseKeys: Object.keys(response.data) }, `[MsalService] Token request successful`);
      return this.validateTokenResponse(response.data);
    } catch (error) {
      const tokenError = this.handleTokenError(error, 'without proxy');

      // DIAGNOSTIC: Detailed error analysis
      if (axios.isAxiosError(error)) {
        logger.error(`DIAGNOSTIC: HTTP Error Status: ${error.response?.status}`);
        logger.error(`DIAGNOSTIC: HTTP Error Headers: ${JSON.stringify(error.response?.headers)}`);
        logger.error(`DIAGNOSTIC: HTTP Error Data: ${JSON.stringify(error.response?.data)}`);
        logger.error(`DIAGNOSTIC: Request Headers: ${JSON.stringify(error.config?.headers)}`);
        logger.error(`DIAGNOSTIC: Request Data: ${typeof error.config?.data === 'string' ? error.config.data.replace(/refresh_token=[^&]+/, 'refresh_token=[HIDDEN]') : 'Not string'}`);
      }

      logger.error({ error: tokenError.message }, `[MsalService] Token request failed`);
      throw tokenError;
    }
  }

  /**
   * Validates and normalizes token response
   */
  private static validateTokenResponse(data: any): TokenResponse {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid token response format');
    }

    if (!data.access_token) {
      throw new Error('Access token not found in response');
    }

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in || 3600,
      scope: data.scope || '',
      token_type: data.token_type || 'Bearer',
    };
  }

  /**
   * Handles and categorizes token acquisition errors
   */
  private static handleTokenError(error: unknown, context: string): Error {
    const logger = getLogger();

    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<MsalError>;

      // Log detailed error information for debugging
      logger.error({
        context,
        status: axiosError.response?.status,
        statusText: axiosError.response?.statusText,
        headers: axiosError.response?.headers,
        data: axiosError.response?.data,
        code: axiosError.code,
        message: axiosError.message
      }, `[MsalService] Detailed error information for ${context}`);

      if (axiosError.response?.data) {
        const msalError = axiosError.response.data;
        const errorMsg = `Microsoft OAuth2 error (${context}): ${msalError.error} - ${msalError.error_description}`;

        // Log Microsoft-specific error details
        logger.error({
          error: msalError.error,
          error_description: msalError.error_description,
          error_codes: msalError.error_codes,
          timestamp: msalError.timestamp,
          trace_id: msalError.trace_id,
          correlation_id: msalError.correlation_id
        }, `[MsalService] Microsoft OAuth2 error details`);

        // Categorize specific errors
        if (msalError.error === 'invalid_grant') {
          return new Error(`${errorMsg}. The refresh token may be expired or revoked. Please re-authenticate.`);
        } else if (msalError.error === 'invalid_client') {
          return new Error(`${errorMsg}. The client ID may be invalid or unauthorized.`);
        } else if (msalError.error === 'unauthorized_client') {
          return new Error(`${errorMsg}. The client is not authorized for this operation.`);
        }

        return new Error(errorMsg);
      } else if (axiosError.code === 'ECONNABORTED') {
        return new Error(`Token request timeout (${context}). Please check your internet connection.`);
      } else if (axiosError.code === 'ENOTFOUND' || axiosError.code === 'ECONNREFUSED') {
        return new Error(`Network error (${context}): ${axiosError.message}`);
      }

      return new Error(`HTTP error (${context}): ${axiosError.message}`);
    }

    logger.error({ context, error }, `[MsalService] Non-axios error occurred`);
    return new Error(`Unknown error (${context}): ${error instanceof Error ? error.message : 'Unknown error'}`);
  }



  /**
   * Generates OAuth2 authentication string for IMAP XOAUTH2
   */
  static generateAuthString(email: string, accessToken: string): string {
    return `user=${email}\x01auth=Bearer ${accessToken}\x01\x01`;
  }

  /**
   * Checks if an error indicates the need for re-authentication
   */
  static isReauthenticationRequired(error: Error): boolean {
    const message = error.message.toLowerCase();
    return message.includes('invalid_grant') ||
           message.includes('expired') ||
           message.includes('revoked') ||
           message.includes('unauthorized');
  }
}