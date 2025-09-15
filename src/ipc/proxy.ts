import type { IncomingMessage } from 'http';
import https from 'https';

import type { IpcMain, IpcMainInvokeEvent } from 'electron';
import type { Logger } from 'pino';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';

import { getGlobalProxy, setGlobalProxy, getProxyList, saveProxyList, testProxy as testProxyService } from '../services/storeService';
import type { ProxyConfig, GlobalProxyConfig } from '../shared/types/account';
import type { ProxyStatus } from '../shared/types/electron';


const testProxyConnection = (proxy: GlobalProxyConfig, sendProxyStatus: (_status: ProxyStatus, _details?: { ip?: string; error?: string }) => void): void => {
    sendProxyStatus('connecting');

    const [proxyHost, proxyPortStr] = proxy.hostPort.split(':');
    const proxyPort = parseInt(proxyPortStr, 10);

    const authPart = (proxy.auth === true && (proxy.username?.length ?? 0) > 0) ?
      `${encodeURIComponent(proxy.username ?? '')}:${encodeURIComponent(proxy.password ?? '')}@` : '';
    const url = `${proxy.type}://${authPart}${proxyHost}:${proxyPort}`;

    const agent = proxy.type === 'https' ? new HttpsProxyAgent(url) : new SocksProxyAgent(url);

    const requestOptions = {
        hostname: 'cloudflare.com',
        port: 443,
        path: '/cdn-cgi/trace',
        method: 'GET',
        agent,
        timeout: 5000, // 5 second timeout
    };

    const req = https.get(requestOptions, (res: IncomingMessage) => {
        let body = '';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        res.on('data', (chunk: any) => {
            body += chunk;
        });

        res.on('end', () => {
            if (typeof res.statusCode === 'number' && res.statusCode >= 200 && res.statusCode < 300) {
                const ipMatch = body.match(/^ip=(.*)$/m);
                const externalIp = ipMatch ? ipMatch[1] : undefined;
                sendProxyStatus('connected', { ip: externalIp });
            } else {
                sendProxyStatus('error', { error: `Proxy test failed with status code: ${res.statusCode}` });
            }
        });
    });

    req.on('error', (err: Error) => {
        sendProxyStatus('error', { error: err.message });
    });

    req.on('timeout', () => {
        req.destroy();
        sendProxyStatus('error', { error: 'Proxy connection timed out' });
    });
};

export const registerProxyHandlers = (ipcMain: IpcMain, sendProxyStatus: (_status: ProxyStatus, _details?: { ip?: string; error?: string }) => void, logger: Logger): void => {
    ipcMain.handle('proxy:get-global', async () => {
        logger.info('IPC proxy:get-global called');
        return await getGlobalProxy();
    });

    ipcMain.handle('proxy:set-global', async (_event: IpcMainInvokeEvent, config: GlobalProxyConfig | null) => {
        logger.info({ config }, 'IPC proxy:set-global called');
        await setGlobalProxy(config);
        if (config?.enabled === true) {
            testProxyConnection(config, sendProxyStatus);
        } else {
            sendProxyStatus('disabled');
        }
    });
    
    // New handlers for proxy list management
    ipcMain.handle('proxy:get-list', () => {
        return getProxyList();
    });
    
    ipcMain.handle('proxy:save-list', (_event: IpcMainInvokeEvent, proxies: ProxyConfig[]) => {
        return saveProxyList(proxies);
    });
    
    ipcMain.handle('proxy:test', async (_event: IpcMainInvokeEvent, proxy: ProxyConfig) => {
        return testProxyService(proxy);
    });
};

export { testProxyConnection }; 