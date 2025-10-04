import type { IncomingMessage } from 'node:http'
import type { IpcMainEvent, IpcMainInvokeEvent } from 'electron'

import { ipcMain } from 'electron'
import { HttpsProxyAgent } from 'https-proxy-agent'
import pino from 'pino'
import type { Logger } from 'pino'
import { SocksProxyAgent } from 'socks-proxy-agent'

import { getGlobalProxy, setGlobalProxy } from '../services/configService'
import { getLogger } from '../services/logger'
import { getProxyList, saveProxyList } from '../services/proxyService'
import { ProxyTester } from '../services/proxyTester'
import type { GlobalProxyConfig, ProxyConfig, TestConfig } from '../shared/types/account'
import type { ProxyStatus } from '../shared/types/electron'

const logger = getLogger()

const activeTestSessions = new Map<string, AbortController>()

const testProxyConnection = (
  proxy: GlobalProxyConfig,
  sendProxyStatus: (_status: ProxyStatus, _details?: { ip?: string; error?: string }) => void
): void => {
  import('node:https')
    .then(https => {
      sendProxyStatus('connecting')

      const [proxyHost, proxyPortStr] = proxy.hostPort.split(':')
      const proxyPort = Number.parseInt(proxyPortStr, 10)

      const authPart =
        proxy.auth === true && (proxy.username?.length ?? 0) > 0
          ? `${encodeURIComponent(proxy.username ?? '')}:${encodeURIComponent(proxy.password ?? '')}@`
          : ''
      const url = `${proxy.type}://${authPart}${proxyHost}:${proxyPort}`

      // Select correct agent based on proxy type: HTTP/HTTPS use HttpsProxyAgent, SOCKS use SocksProxyAgent
      const agent =
        proxy.type === 'http' || proxy.type === 'https'
          ? new HttpsProxyAgent(url)
          : new SocksProxyAgent(url)

      const requestOptions = {
        hostname: 'httpbin.org',
        port: 443,
        path: '/ip',
        method: 'GET',
        agent,
        timeout: 3000, // 3 second timeout
      }

      const req = https.get(requestOptions, (res: IncomingMessage) => {
        let body = ''
        res.on('data', (chunk: Buffer | string) => {
          body += chunk
        })

        res.on('end', () => {
          if (typeof res.statusCode === 'number' && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const data = JSON.parse(body)
              sendProxyStatus('connected', { ip: data.origin })
            } catch {
              sendProxyStatus('error', {
                error: 'Failed to parse JSON response from httpbin.org',
              })
            }
          } else {
            sendProxyStatus('error', {
              error: `Proxy test failed with status code: ${res.statusCode}`,
            })
          }
        })
      })

      req.on('error', (err: Error) => {
        sendProxyStatus('error', { error: err.message })
      })

      req.on('timeout', () => {
        req.destroy()
        sendProxyStatus('error', { error: 'Proxy connection timed out' })
      })
    })
    .catch((error: Error) => {
      sendProxyStatus('error', { error: `Failed to import https module: ${error.message}` })
    })
}

export function registerProxyHandlers(
  sendProxyStatus: (status: ProxyStatus, details?: { ip?: string; error?: string }) => void
): void {
  ipcMain.handle('proxy:get-global', async () => {
    logger.info('IPC proxy:get-global called')
    return getGlobalProxy()
  })

  ipcMain.handle(
    'proxy:set-global',
    async (_event: IpcMainInvokeEvent, config: GlobalProxyConfig) => {
      logger.info({ config }, 'IPC proxy:set-global called')
      setGlobalProxy(config)
      if (config?.enabled === true) {
        testProxyConnection(config, sendProxyStatus)
      } else {
        sendProxyStatus('disabled')
      }
    }
  )

  ipcMain.handle('proxy:start-test-session', (_event: IpcMainInvokeEvent, sessionId: string) => {
    if (activeTestSessions.has(sessionId)) {
      // Clean up previous session if it exists
      activeTestSessions.get(sessionId)?.abort()
    }
    const abortController = new AbortController()
    activeTestSessions.set(sessionId, abortController)
    logger.info(`Started proxy test session: ${sessionId}`)
  })

  ipcMain.handle('proxy:stop-test-session', (_event: IpcMainInvokeEvent, sessionId: string) => {
    const controller = activeTestSessions.get(sessionId)
    if (controller) {
      controller.abort()
      activeTestSessions.delete(sessionId)
      logger.info(`Stopped proxy test session: ${sessionId}`)
    }
  })

  // New handlers for proxy list management
  ipcMain.handle('proxy:get-list', _event => {
    return getProxyList()
  })

  ipcMain.handle('proxy:save-list', (_event, proxies: ProxyConfig[]) => {
    return saveProxyList(proxies)
  })

  ipcMain.handle(
    'proxy:test',
    async (
      _event: IpcMainInvokeEvent,
      proxyConfig: ProxyConfig,
      testConfig: TestConfig,
      sessionId?: string
    ) => {
      logger.info({ proxy: proxyConfig, config: testConfig, sessionId }, 'IPC proxy:test called')
      try {
        const controller = sessionId ? activeTestSessions.get(sessionId) : undefined
        const signal = controller?.signal

        const tester = new ProxyTester(testConfig)
        const result = await tester.testProxy(proxyConfig, signal)
        return result
      } catch (error) {
        const isAbortError = error instanceof Error && error.name === 'AbortError'
        if (isAbortError) {
          logger.warn({ proxy: proxyConfig.host, sessionId }, 'Proxy test aborted by user.')
          return {
            success: false,
            error: 'Test cancelled',
          }
        }
        logger.error({ error, proxy: proxyConfig }, 'Proxy test exception in IPC handler')
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error in IPC handler',
        }
      }
    }
  )

  // Handler for fetching external proxy sources
  ipcMain.handle('proxy:fetch-external', async (_event, url: string) => {
    try {
      logger.info(`Fetching external proxy source: ${url}`)

      // Use dynamic import to avoid bundling issues
      const https = await import('node:https')
      const http = await import('node:http')

      return new Promise<string>((resolve, reject) => {
        const client = url.startsWith('https:') ? https : http

        // Set proper headers to request text content
        const options = {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            Accept: 'text/plain, text/*, */*',
            'Accept-Encoding': 'identity',
            'Cache-Control': 'no-cache',
          },
        }

        const request = client.get(url, options, response => {
          let data = ''
          const contentType = response.headers['content-type'] || ''

          response.on('data', (chunk: Buffer) => {
            data += chunk.toString()
          })

          response.on('end', () => {
            if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
              // Log content type and first 200 chars for debugging
              logger.info(
                `Successfully fetched external proxy source (${data.split('\n').length} lines, Content-Type: ${contentType})`
              )
              logger.info(`First 200 chars: ${data.substring(0, 200)}`)
              resolve(data)
            } else {
              reject(new Error(`HTTP Error: ${response.statusCode} ${response.statusMessage}`))
            }
          })
        })

        request.on('error', (error: Error) => {
          logger.error(`Failed to fetch external proxy source: ${error.message}`)
          reject(error)
        })

        request.setTimeout(10000, () => {
          request.destroy()
          reject(new Error('Request timeout (10s)'))
        })
      })
    } catch (error) {
      logger.error(
        `Failed to fetch external proxy source: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
      throw error
    }
  })
}

export { testProxyConnection }
