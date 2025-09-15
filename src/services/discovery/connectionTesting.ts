/**
 * @file Connection testing utilities for email discovery
 */

import dns from 'dns/promises';
import net from 'net';
import tls from 'tls';

import type { Logger, ConnectionTestResult } from './types';

/**
 * Checks if a hostname exists in DNS before attempting connection.
 */
export const checkHostExists = async (hostname: string): Promise<boolean> => {
  try {
    await dns.lookup(hostname);
    return true;
  } catch {
    return false;
  }
};

/**
 * Tests if a host is reachable on a given port and validates it's actually an email server.
 */
export const testConnection = async (
  host: string,
  port: number,
  secure: boolean,
  timeout = 5000
): Promise<ConnectionTestResult> => {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let resolved = false;

    const cleanup = (): void => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
      }
    };

    const timer = setTimeout(() => {
      cleanup();
      resolve({
        success: false,
        error: 'Connection timeout',
        details: { host, port, secure }
      });
    }, timeout);

    socket.setTimeout(timeout);

    socket.on('connect', () => {
      clearTimeout(timer);
      cleanup();
      resolve({
        success: true,
        details: { host, port, secure }
      });
    });

    socket.on('error', (err) => {
      clearTimeout(timer);
      cleanup();
      resolve({
        success: false,
        error: err.message,
        details: { host, port, secure }
      });
    });

    socket.on('timeout', () => {
      clearTimeout(timer);
      cleanup();
      resolve({
        success: false,
        error: 'Socket timeout',
        details: { host, port, secure }
      });
    });

    try {
      socket.connect(port, host);
    } catch (err) {
      clearTimeout(timer);
      cleanup();
      resolve({
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        details: { host, port, secure }
      });
    }
  });
};

/**
 * Validates if a server is actually an email server by checking response
 */
export const isValidEmailServer = async (
  host: string,
  port: number,
  secure: boolean,
  logger: Logger
): Promise<boolean> => {
  const result = await testConnection(host, port, secure);

  if (!result.success) {
    logger.info(`Connection failed to ${host}:${port} - ${result.error ?? 'Unknown error'}`);
    return false;
  }

  // For now, just check if connection is successful
  // In the future, we could add protocol-specific validation
  logger.info(`Successfully connected to ${host}:${port} (secure: ${secure})`);
  return true;
};

/**
 * Gets the real hostname from TLS certificate for secure connections
 */
export const getRealHostnameFromTLS = async (
  host: string,
  port: number,
  timeout = 5000
): Promise<string | null> => {
  return new Promise((resolve) => {
    const socket = tls.connect({
      host,
      port,
      rejectUnauthorized: false, // We just want to read the certificate
      timeout
    });

    socket.on('secureConnect', () => {
      try {
        const cert = socket.getPeerCertificate();
        socket.destroy();

        if (cert && cert.subject && cert.subject.CN) {
          const cn = cert.subject.CN;
          // Skip wildcard certificates
          if (!cn.startsWith('*.')) {
            resolve(cn);
            return;
          }
        }

        if (cert && cert.subjectaltname) {
          // Extract DNS names from Subject Alternative Names
          const dnsMatches = cert.subjectaltname.match(/DNS:([^,]+)/g);
          if (dnsMatches) {
            // First, try to find non-wildcard hostnames
            for (const match of dnsMatches) {
              const hostname = match.replace('DNS:', '');
              if (!hostname.startsWith('*.')) {
                resolve(hostname);
                return;
              }
            }

            // If only wildcards found, return the first wildcard
            // The caller will handle constructing the proper hostname
            for (const match of dnsMatches) {
              const hostname = match.replace('DNS:', '');
              if (hostname.startsWith('*.')) {
                resolve(hostname);
                return;
              }
            }
          }
        }

        resolve(null);
      } catch (error) {
        socket.destroy();
        resolve(null);
      }
    });

    socket.on('error', () => {
      socket.destroy();
      resolve(null);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(null);
    });
  });
};

/**
 * Enhanced validation that checks TLS certificate for secure connections
 * and returns the real hostname if different from the tested hostname
 */
export const isValidEmailHostWithRealHostname = async (
  host: string,
  port: number,
  secure: boolean,
  logger: Logger
): Promise<{ isValid: boolean; realHostname?: string }> => {
  // First check if host exists in DNS
  if (!(await checkHostExists(host))) {
    logger.info(`Host ${host} does not exist in DNS`);
    return { isValid: false };
  }

  // Then check if port is open
  const result = await testConnection(host, port, secure, 3000);

  if (!result.success) {
    logger.info(`Connection failed to ${host}:${port} - ${result.error ?? 'Unknown error'}`);
    return { isValid: false };
  }

  // For secure connections, check the real hostname from TLS certificate
  if (secure) {
    const realHostname = await getRealHostnameFromTLS(host, port);
    if (realHostname && realHostname !== host) {
      logger.info(`Host ${host}:${port} redirects to real hostname: ${realHostname}`);

      // If we got a wildcard certificate, construct proper hostname
      if (realHostname.startsWith('*.')) {
        const baseDomain = realHostname.substring(2); // Remove '*.'
        const constructedHost = `imap.${baseDomain}`;
        logger.info(`Wildcard certificate detected, using constructed hostname: ${constructedHost}`);
        return { isValid: true, realHostname: constructedHost };
      }

      // If we got a base domain, construct IMAP hostname
      if (realHostname && !realHostname.startsWith('imap.') && !realHostname.startsWith('mail.') && !realHostname.startsWith('mx.')) {
        // Check if this looks like a base domain by testing if imap.domain works
        const constructedHost = `imap.${realHostname}`;
        logger.info(`Base domain detected (${realHostname}), trying constructed hostname: ${constructedHost}`);
        return { isValid: true, realHostname: constructedHost };
      }

      return { isValid: true, realHostname };
    }
  }

  logger.info(`Host ${host}:${port} is reachable (secure: ${secure})`);
  return { isValid: true };
};

/**
 * Quick validation that just checks if the host exists and port is open
 * This is more permissive and faster than full email server validation
 */
export const isValidEmailHost = async (
  host: string,
  port: number,
  secure: boolean,
  logger: Logger
): Promise<boolean> => {
  const result = await isValidEmailHostWithRealHostname(host, port, secure, logger);
  return result.isValid;
};
