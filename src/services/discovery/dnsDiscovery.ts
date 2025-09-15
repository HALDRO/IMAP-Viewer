/**
 * @file DNS-based email discovery using modern techniques.
 */

import dns from 'dns/promises';
import { isValidEmailServer, isValidEmailHost, isValidEmailHostWithRealHostname } from './connectionTesting';
import type { Logger, DiscoveredConfig, ServerConfig } from './types';

// SRV records for standard email services
const srvRecords = [
  { service: 'imap', protocol: 'tcp', srv: '_imaps._tcp' },
  { service: 'imap', protocol: 'tcp', srv: '_imap._tcp' },
  { service: 'pop3', protocol: 'tcp', srv: '_pop3s._tcp' },
  { service: 'pop3', protocol: 'tcp', srv: '_pop3._tcp' },
  { service: 'smtp', protocol: 'tcp', srv: '_submission._tcp' }, // For SMTP
];

// Extract hostname from MX record and generate IMAP/SMTP guesses
const generateHostnamesFromMX = (mxHostname: string, domain: string): string[] => {
  const hosts = new Set<string>();

  // If MX is like mail.domain.com, try imap.domain.com, smtp.domain.com
  if (mxHostname.startsWith('mail.')) {
    const baseDomain = mxHostname.substring(5); // Remove 'mail.'
    hosts.add(`imap.${baseDomain}`);
    hosts.add(`smtp.${baseDomain}`);
    hosts.add(`pop3.${baseDomain}`);
    hosts.add(`pop.${baseDomain}`);
  }

  // If MX is like mx.domain.com or mx1.domain.com, try mail.domain.com variants
  if (mxHostname.match(/^mx\d*\./)) {
    const baseDomain = mxHostname.replace(/^mx\d*\./, '');
    hosts.add(`mail.${baseDomain}`);
    hosts.add(`imap.${baseDomain}`);
    hosts.add(`smtp.${baseDomain}`);
  }

  // Try replacing common prefixes
  const prefixReplacements = [
    { from: /^mail\./, to: ['imap.', 'smtp.', 'pop3.', 'pop.'] },
    { from: /^smtp\./, to: ['imap.', 'mail.', 'pop3.'] },
    { from: /^mx\d*\./, to: ['imap.', 'mail.', 'smtp.'] }
  ];

  for (const replacement of prefixReplacements) {
    if (replacement.from.test(mxHostname)) {
      const baseDomain = mxHostname.replace(replacement.from, '');
      for (const prefix of replacement.to) {
        hosts.add(`${prefix}${baseDomain}`);
      }
    }
  }

  // Also try the MX hostname itself as IMAP/SMTP server
  hosts.add(mxHostname);

  return Array.from(hosts);
};

// Get MX records and extract hostnames for email server guessing
const getMXBasedHostnames = async (domain: string, logger: Logger): Promise<string[]> => {
  try {
    logger.info(`[Discovery/S2-DNS-MX] Looking up MX records for ${domain}`);

    // Add timeout to MX lookup
    const mxPromise = dns.resolveMx(domain);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('MX lookup timeout')), 10000)
    );

    const mxRecords = await Promise.race([mxPromise, timeoutPromise]);

    if (mxRecords.length === 0) {
      logger.info(`[Discovery/S2-DNS-MX] No MX records found for ${domain}`);
      return [];
    }

    // Sort by priority (lower number = higher priority)
    mxRecords.sort((a, b) => a.priority - b.priority);

    const allHosts = new Set<string>();

    for (const mx of mxRecords) {
      logger.info(`[Discovery/S2-DNS-MX] Found MX record: ${mx.exchange} (priority: ${mx.priority})`);
      const hostsFromMX = generateHostnamesFromMX(mx.exchange, domain);
      hostsFromMX.forEach(host => allHosts.add(host));
    }

    const result = Array.from(allHosts);
    logger.info(`[Discovery/S2-DNS-MX] Generated ${result.length} hostnames from MX records: ${result.join(', ')}`);
    return result;

  } catch (error) {
    logger.info(`[Discovery/S2-DNS-MX] Failed to resolve MX records for ${domain}: ${error}`);
    return [];
  }
};

/**
 * Strategy 2, Modernized: DNS-based discovery using SRV records and falling back to guessing.
 */
export const discoverViaDns = async (domain: string, logger: Logger): Promise<DiscoveredConfig | null> => {
  logger.info(`[Discovery/S2-DNS] Starting DNS discovery for ${domain}`);
  logger.info(`[Discovery/S2-DNS] Will test hosts: ${[
    `imap.${domain}`, `mail.${domain}`, `smtp.${domain}`, `pop.${domain}`,
    `pop3.${domain}`, `mx.${domain}`, `email.${domain}`, `mailserver.${domain}`, domain
  ].join(', ')}`);

  // First, try SRV records - the modern, standard way
  const srvResult = await discoverViaSrvRecords(domain, logger);
  if (srvResult) {
    logger.info(`[Discovery/S2-DNS] Found config via SRV records for ${domain}`);
    return srvResult;
  }

  // Fallback to guessing common hostnames
  logger.info(`[Discovery/S2-DNS] SRV lookup failed, falling back to DNS guessing for ${domain}`);
  const guessResult = await discoverViaDnsGuessing(domain, logger);
  if (guessResult) {
    logger.info(`[Discovery/S2-DNS] Found config via DNS guessing for ${domain}`);
    return guessResult;
  }

  logger.info(`[Discovery/S2-DNS] No working servers found for ${domain}`);
  return null;
};

/**
 * Discover email configuration using DNS SRV records.
 */
const discoverViaSrvRecords = async (domain: string, logger: Logger): Promise<DiscoveredConfig | null> => {
  const discovered: DiscoveredConfig = {};

  const resolutions = await Promise.all(
    srvRecords.map(async ({ service, srv }) => {
      try {
        const records = await dns.resolveSrv(`${srv}.${domain}`);
        if (records && records.length > 0) {
          // Sort by priority and weight
          records.sort((a, b) => (a.priority - b.priority) || (b.weight - a.weight));
          
          for (const record of records) {
            const { name, port } = record;
            const secure = srv.includes('s'); // _imaps, _pop3s imply SSL/TLS
            
            const isValid = await isValidEmailServer(name, port, secure, logger);
            if (isValid) {
              logger.info(`[Discovery/S2-DNS-SRV] Found working ${service.toUpperCase()} server: ${name}:${port}`);
              return { service, config: { host: name, port, secure } };
            }
          }
        }
      } catch (error: any) {
        if (error.code !== 'ENODATA' && error.code !== 'ENOTFOUND') {
          logger.warn(`[Discovery/S2-DNS-SRV] SRV lookup for ${srv}.${domain} failed: ${error.message}`);
        }
      }
      return null;
    })
  );

  resolutions.forEach(res => {
    if (res) {
      if (res.service === 'imap' && !discovered.imap) discovered.imap = res.config;
      if (res.service === 'pop3' && !discovered.pop3) discovered.pop3 = res.config;
      if (res.service === 'smtp' && !discovered.smtp) discovered.smtp = res.config;
    }
  });

  return discovered.imap || discovered.pop3 ? discovered : null;
};

/**
 * Fallback Strategy: DNS-based guessing of common server names.
 */
const discoverViaDnsGuessing = async (domain: string, logger: Logger): Promise<DiscoveredConfig | null> => {
  // Get hostnames from MX records first
  const mxBasedHosts = await getMXBasedHostnames(domain, logger);

  // Common server patterns - expanded for better coverage
  const commonHosts = [
    `imap.${domain}`,
    `mail.${domain}`,
    `smtp.${domain}`,
    `pop.${domain}`,
    `pop3.${domain}`,
    `mx.${domain}`,
    `email.${domain}`,
    `mailserver.${domain}`,
    domain,
    // Additional patterns for custom email providers
    `webmail.${domain}`,
    `server.${domain}`,
    `mail1.${domain}`,
    `mail2.${domain}`,
    `imap1.${domain}`,
    `imap2.${domain}`,
    `secure.${domain}`,
    `ssl.${domain}`
  ];

  // Combine MX-based hosts with common patterns, prioritizing MX-based
  const allHosts = [...mxBasedHosts, ...commonHosts];

  logger.info(`[Discovery/S2-DNS-Guess] Testing ${allHosts.length} hostnames: ${allHosts.join(', ')}`);
  const imapConfigs = [{ port: 993, secure: true }, { port: 143, secure: false }];
  const pop3Configs = [{ port: 995, secure: true }, { port: 110, secure: false }];
  const smtpConfigs = [{ port: 587, secure: true }, { port: 465, secure: true }, { port: 25, secure: false }];

  const testConfig = async (host: string, configs: {port: number, secure: boolean}[], type: 'imap' | 'pop3' | 'smtp'): Promise<ServerConfig | null> => {
    logger.info(`[Discovery/S2-DNS-Guess] Testing ${type.toUpperCase()} host: ${host}`);

    try {
      // Use enhanced host validation that checks TLS certificates
      for (const config of configs) {
        logger.info(`[Discovery/S2-DNS-Guess] Testing ${host}:${config.port} (secure: ${config.secure})`);

        // Add timeout to each host test
        const testPromise = isValidEmailHostWithRealHostname(host, config.port, config.secure, logger);
        const timeoutPromise = new Promise<{ isValid: boolean; realHostname?: string }>((_, reject) =>
          setTimeout(() => reject(new Error('Host test timeout')), 8000)
        );

        const result = await Promise.race([testPromise, timeoutPromise]);

        if (result.isValid) {
          let finalHost = result.realHostname || host;

          // If we got a real hostname from TLS certificate, check if it looks like a proper mail server
          if (result.realHostname && (type === 'imap' || type === 'smtp')) {
            const realHost = result.realHostname.toLowerCase();
            logger.info(`[Discovery/S2-DNS-Guess] Checking real hostname: "${realHost}" for type: "${type}"`);
            // If the real hostname doesn't look like a mail server, add appropriate prefix
            if (!realHost.includes('imap') && !realHost.includes('mail') && !realHost.includes('mx') && !realHost.includes('smtp')) {
              if (type === 'imap') {
                finalHost = `imap.${result.realHostname}`;
                logger.info(`[Discovery/S2-DNS-Guess] Real hostname doesn't look like mail server, using: ${finalHost}`);
              } else if (type === 'smtp') {
                finalHost = `smtp.${result.realHostname}`;
                logger.info(`[Discovery/S2-DNS-Guess] Real hostname doesn't look like mail server, using: ${finalHost}`);
              }
            } else {
              logger.info(`[Discovery/S2-DNS-Guess] Using real hostname from TLS certificate: ${result.realHostname}`);
            }
          }

          logger.info(`[Discovery/S2-DNS-Guess] Found working ${type.toUpperCase()} server: ${finalHost}:${config.port}`);
          return { host: finalHost, ...config };
        }
      }
    } catch (error) {
      logger.info(`[Discovery/S2-DNS-Guess] Error testing ${type.toUpperCase()} host ${host}: ${error}`);
    }

    logger.info(`[Discovery/S2-DNS-Guess] No working ${type.toUpperCase()} server found for host: ${host}`);
    return null;
  };

  logger.info(`[Discovery/S2-DNS-Guess] Starting parallel testing of ${allHosts.length} hosts for IMAP/POP3/SMTP`);

  // Test IMAP first (priority), then POP3, then SMTP
  const discovered: DiscoveredConfig = {};

  // Test IMAP servers first - stop as soon as we find one
  logger.info(`[Discovery/S2-DNS-Guess] Testing IMAP servers first (priority)`);
  for (const host of allHosts) {
    const imapResult = await testConfig(host, imapConfigs, 'imap');
    if (imapResult) {
      discovered.imap = imapResult;
      logger.info(`[Discovery/S2-DNS-Guess] Found IMAP server, stopping further IMAP tests`);
      break;
    }
  }

  // Test POP3 servers if no IMAP found
  if (!discovered.imap) {
    logger.info(`[Discovery/S2-DNS-Guess] No IMAP found, testing POP3 servers`);
    for (const host of allHosts) {
      const pop3Result = await testConfig(host, pop3Configs, 'pop3');
      if (pop3Result) {
        discovered.pop3 = pop3Result;
        logger.info(`[Discovery/S2-DNS-Guess] Found POP3 server, stopping further POP3 tests`);
        break;
      }
    }
  }

  // Test SMTP servers (always useful to have)
  if (discovered.imap || discovered.pop3) {
    logger.info(`[Discovery/S2-DNS-Guess] Testing SMTP servers`);
    for (const host of allHosts) {
      const smtpResult = await testConfig(host, smtpConfigs, 'smtp');
      if (smtpResult) {
        discovered.smtp = smtpResult;
        logger.info(`[Discovery/S2-DNS-Guess] Found SMTP server, stopping further SMTP tests`);
        break;
      }
    }
  }

  logger.info(`[Discovery/S2-DNS-Guess] Sequential testing completed for ${domain}`);

  // Post-processing: Ensure hostname consistency between IMAP and SMTP
  if (discovered.imap && discovered.smtp) {
    const imapHost = discovered.imap.host;
    const smtpHost = discovered.smtp.host;

    // Check if IMAP and SMTP use different domains (e.g., mail.gmx.net vs mail.gmx.ch)
    const imapDomain = imapHost.split('.').slice(-2).join('.');
    const smtpDomain = smtpHost.split('.').slice(-2).join('.');

    if (imapDomain !== smtpDomain) {
      logger.info(`[Discovery/S2-DNS-Guess] Hostname inconsistency detected: IMAP=${imapHost}, SMTP=${smtpHost}`);

      // If IMAP uses a different domain, try to use the same domain for SMTP
      const imapPrefix = imapHost.split('.')[0]; // e.g., 'mail' from 'mail.gmx.net'
      const imapBaseDomain = imapHost.substring(imapPrefix.length + 1); // e.g., 'gmx.net' from 'mail.gmx.net'

      // Try to construct SMTP hostname using IMAP's domain
      const potentialSmtpHost = `mail.${imapBaseDomain}`;

      if (potentialSmtpHost !== smtpHost) {
        logger.info(`[Discovery/S2-DNS-Guess] Testing SMTP consistency: trying ${potentialSmtpHost} instead of ${smtpHost}`);

        // Test if the consistent hostname works for SMTP
        const testPromise = isValidEmailHostWithRealHostname(potentialSmtpHost, discovered.smtp.port, discovered.smtp.secure, logger);
        const timeoutPromise = new Promise<{ isValid: boolean; realHostname?: string }>((_, reject) =>
          setTimeout(() => reject(new Error('Consistency test timeout')), 5000)
        );

        try {
          const result = await Promise.race([testPromise, timeoutPromise]);
          if (result.isValid) {
            logger.info(`[Discovery/S2-DNS-Guess] SMTP hostname consistency fix: using ${potentialSmtpHost} instead of ${smtpHost}`);
            discovered.smtp.host = potentialSmtpHost;
          } else {
            logger.info(`[Discovery/S2-DNS-Guess] SMTP hostname consistency test failed, keeping original: ${smtpHost}`);
          }
        } catch (error) {
          logger.info(`[Discovery/S2-DNS-Guess] SMTP hostname consistency test error, keeping original: ${smtpHost}`);
        }
      }
    }
  }

  const hasResults = discovered.imap || discovered.pop3;
  logger.info(`[Discovery/S2-DNS-Guess] DNS guessing completed for ${domain}. Found: ${hasResults ? 'YES' : 'NO'}`);
  if (hasResults) {
    if (discovered.imap) logger.info(`[Discovery/S2-DNS-Guess] IMAP: ${discovered.imap.host}:${discovered.imap.port}`);
    if (discovered.pop3) logger.info(`[Discovery/S2-DNS-Guess] POP3: ${discovered.pop3.host}:${discovered.pop3.port}`);
    if (discovered.smtp) logger.info(`[Discovery/S2-DNS-Guess] SMTP: ${discovered.smtp.host}:${discovered.smtp.port}`);
  }

  return hasResults ? discovered : null;
};
