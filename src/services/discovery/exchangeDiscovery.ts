/**
 * @file Microsoft Exchange Autodiscover implementation using modern techniques.
 */

import dns from 'dns/promises';
import { checkHostExists, isValidEmailServer } from './connectionTesting';
import type { Logger, DiscoveredConfig } from './types';

declare const fetch: (_url: string, _options?: RequestInit) => Promise<Response>;

/**
 * Strategy 3, Modernized: Microsoft Exchange Autodiscover.
 */
export const discoverViaExchangeAutodiscover = async (domain: string, logger: Logger): Promise<DiscoveredConfig | null> => {
  logger.info(`[Discovery/S3-Exchange] Starting Exchange Autodiscover for ${domain}`);

  const autodiscoverEndpoints = await getAutodiscoverEndpoints(domain, logger);

  if (autodiscoverEndpoints.length === 0) {
    logger.info(`[Discovery/S3-Exchange] No Autodiscover endpoints found for ${domain}`);
    return null;
  }

  const results = await Promise.all(
    autodiscoverEndpoints.map(url => tryExchangeAutodiscoverUrl(url, domain, logger))
  );

  const successfulResult = results.find(result => result !== null);

  if (successfulResult) {
    logger.info(`[Discovery/S3-Exchange] Successfully discovered configuration for ${domain}`);
    return successfulResult;
  }

  logger.info(`[Discovery/S3-Exchange] No working Exchange configuration found for ${domain}`);
  return null;
};

/**
 * Gets potential Autodiscover endpoints from SRV records and common URLs.
 */
const getAutodiscoverEndpoints = async (domain: string, logger: Logger): Promise<string[]> => {
  const endpoints = new Set<string>();

  // 1. SRV record
  try {
    const records = await dns.resolveSrv(`_autodiscover._tcp.${domain}`);
    if (records && records.length > 0) {
      records.sort((a, b) => a.priority - b.priority || b.weight - a.weight);
      for (const record of records) {
        endpoints.add(`https://${record.name}:${record.port}/autodiscover/autodiscover.xml`);
      }
      logger.info(`[Discovery/S3-Exchange] Found Autodiscover SRV records for ${domain}`);
    }
  } catch (error: any) {
    if (error.code !== 'ENODATA' && error.code !== 'ENOTFOUND') {
      logger.warn(`[Discovery/S3-Exchange] SRV lookup failed: ${error.message}`);
    }
  }

  // 2. Standard URLs
  endpoints.add(`https://autodiscover.${domain}/autodiscover/autodiscover.xml`);
  endpoints.add(`https://${domain}/autodiscover/autodiscover.xml`);

  return Array.from(endpoints);
};

/**
 * Attempts Exchange Autodiscover for a specific URL.
 */
async function tryExchangeAutodiscoverUrl(url: string, domain: string, logger: Logger): Promise<DiscoveredConfig | null> {
  try {
    const hostname = new URL(url).hostname;
    if (!await checkHostExists(hostname)) {
      logger.info(`[Discovery/S3-Exchange] Host ${hostname} does not exist.`);
      return null;
    }

    logger.info(`[Discovery/S3-Exchange] Trying URL: ${url}`);
    const requestBody = createAutodiscoverRequestXml(domain);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8' },
      body: requestBody,
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      logger.info(`[Discovery/S3-Exchange] HTTP ${response.status} from ${url}`);
      return null;
    }

    const xmlText = await response.text();
    const config = parseExchangeAutodiscoverXml(xmlText, logger);

    if (config && config.imap) {
        const { host, port, secure } = config.imap;
        if (await isValidEmailServer(host, port, secure, logger)) {
            logger.info(`[Discovery/S3-Exchange] Validated IMAP server at ${host}:${port}`);
            return config;
        }
    }
    return null;

  } catch (error) {
    logger.warn(`[Discovery/S3-Exchange] Request to ${url} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
}

/**
 * Creates the XML request body for Exchange Autodiscover.
 */
function createAutodiscoverRequestXml(emailAddress: string): string {
    const email = `user@${emailAddress}`;
    return `<?xml version="1.0" encoding="utf-8"?>
<Autodiscover xmlns="http://schemas.microsoft.com/exchange/autodiscover/mobilesync/requestschema/2006">
    <Request>
        <EMailAddress>${email}</EMailAddress>
        <AcceptableResponseSchema>http://schemas.microsoft.com/exchange/autodiscover/mobilesync/responseschema/2006</AcceptableResponseSchema>
    </Request>
</Autodiscover>`;
}

/**
 * Parses Exchange Autodiscover XML response with improved robustness.
 */
function parseExchangeAutodiscoverXml(xmlText: string, logger: Logger): DiscoveredConfig | null {
  try {
    const config: DiscoveredConfig = {};

    const extractValue = (tagName: string) => {
        const match = xmlText.match(new RegExp(`<${tagName}>(.*?)</${tagName}>`, 'i'));
        return match ? match[1] : null;
    };

    const server = extractValue('Server');
    const type = extractValue('Type');

    if (server && type) {
        if (type.toLowerCase() === 'imap') {
            config.imap = {
                host: server,
                port: 993, // Default IMAPS port
                secure: true,
            };
            logger.info(`[Discovery/S3-Exchange] Parsed IMAP server: ${server}`);
        }
        // Can be extended for POP3/SMTP if needed
    }

    return config.imap ? config : null;
  } catch (error) {
    logger.error(`[Discovery/S3-Exchange] Failed to parse XML: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
}