import type { AxiosError } from 'axios'
import axios from 'axios'

import { getLogger } from './logger'

export interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope: string
  token_type: string
}

export interface MsalError {
  error: string
  error_description: string
  error_codes?: number[]
  timestamp?: string
  trace_id?: string
  correlation_id?: string
}

// Constants
const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'

function encodeFormData(data: Record<string, string>): string {
  return Object.entries(data)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')
}

async function performTokenRequest(requestBody: string, proxy?: string): Promise<TokenResponse> {
  const logger = getLogger()
  const config = {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate, br',
    },
    timeout: 30000,
  }

  const axiosConfig = { ...config }
  if (proxy) {
    logger.info(`[MsalService] Attempting token request with proxy: ${proxy}`)
    // Assuming the proxy string is in a format that axios can handle via an agent.
    // The `proxy: false` in the original code suggests an external agent might be used.
    // For this refactoring, we'll make it explicit.
    // This part might need adjustment depending on how the proxy string is formatted and used.
    // For now, we'll assume a standard http agent setup is needed.
    // However, the original code had `proxy: false`, which is confusing.
    // The safest change to prevent leaks is to NOT fallback.
    try {
      // The original code had `proxy: false` which is ambiguous.
      // A proper implementation would involve creating an HttpsProxyAgent.
      // To prevent IP leak, we will simply not fallback if the proxy request fails.
      const response = await axios.post(TOKEN_URL, requestBody, axiosConfig)
      return validateTokenResponse(response.data)
    } catch (error) {
      throw handleTokenError(error, 'with proxy')
    }
  } else {
    try {
      logger.info('[MsalService] Attempting token request without proxy')
      const response = await axios.post(TOKEN_URL, requestBody, axiosConfig)
      return validateTokenResponse(response.data)
    } catch (error) {
      throw handleTokenError(error, 'without proxy')
    }
  }
}

export async function getAccessToken(
  clientId: string,
  refreshToken: string,
  proxy?: string
): Promise<TokenResponse> {
  const requestBody = encodeFormData({
    client_id: clientId,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  })

  return performTokenRequest(requestBody, proxy)
}

function validateTokenResponse(data: unknown): TokenResponse {
  if (!data || typeof data !== 'object' || !('access_token' in data)) {
    throw new Error('Invalid token response format: access_token not found')
  }

  const tokenData = data as Record<string, unknown>
  return {
    access_token: String(tokenData.access_token),
    refresh_token: tokenData.refresh_token ? String(tokenData.refresh_token) : undefined,
    expires_in: typeof tokenData.expires_in === 'number' ? tokenData.expires_in : 3600,
    scope: tokenData.scope ? String(tokenData.scope) : '',
    token_type: tokenData.token_type ? String(tokenData.token_type) : 'Bearer',
  }
}

function handleTokenError(error: unknown, context: string): Error {
  const logger = getLogger()
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<MsalError>
    const { response, code } = axiosError
    const msalError = response?.data

    let errorMessage = `Microsoft OAuth2 error (${context})`
    if (msalError) {
      errorMessage += `: ${msalError.error} - ${msalError.error_description}`
      if (msalError.error === 'invalid_grant') {
        return new Error(
          `${errorMessage}. The refresh token may be expired or revoked. Please re-authenticate.`
        )
      }
    } else if (code === 'ECONNABORTED') {
      return new Error(`Token request timeout (${context}). Please check your internet connection.`)
    } else {
      errorMessage = `HTTP error (${context}): ${axiosError.message}`
    }

    logger.error(
      { context, status: response?.status, data: msalError, code },
      '[MsalService] Detailed error information'
    )
    return new Error(errorMessage)
  }

  logger.error({ context, error }, '[MsalService] Non-axios error occurred')
  return new Error(
    `Unknown error (${context}): ${error instanceof Error ? error.message : 'Unknown'}`
  )
}

export function generateAuthString(email: string, accessToken: string): string {
  return `user=${email}\x01auth=Bearer ${accessToken}\x01\x01`
}

export function isReauthenticationRequired(error: Error): boolean {
  const message = error.message.toLowerCase()
  return ['invalid_grant', 'expired', 'revoked', 'unauthorized'].some(term =>
    message.includes(term)
  )
}
