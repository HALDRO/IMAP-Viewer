/**
 * @file Account types and schemas for email account management
 */

import { z } from 'zod';

export interface ProxyConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  type?: 'http' | 'https' | 'socks4' | 'socks5';
  // Extended properties for proxy list management
  enabled?: boolean;
  hostPort?: string;
  auth?: boolean;
}

export interface GlobalProxyConfig {
  enabled: boolean;
  type: 'http' | 'https' | 'socks4' | 'socks5';
  hostPort: string;
  auth: boolean;
  username?: string;
  password?: string;
}

export interface IncomingServerConfig {
  protocol: 'imap' | 'pop3' | 'oauth2';
  host: string;
  port: number;
  useTls: boolean;
}

export interface OutgoingServerConfig {
  protocol: 'smtp';
  host: string;
  port: number;
  useTls: boolean;
}

export interface Account {
  id: string;
  displayName?: string;
  email: string;
  password: string;
  incoming: IncomingServerConfig;
  outgoing?: OutgoingServerConfig;
  useProxy?: boolean;
  proxy?: ProxyConfig | null;
  connectionStatus?: 'connected' | 'disconnected' | 'connecting';
  // OAuth2 fields for Microsoft accounts
  authType?: 'basic' | 'oauth2';
  clientId?: string;
  refreshToken?: string;
  accessToken?: string;
  accessTokenExpiry?: number;
}

// Zod schemas for validation
export const proxyConfigSchema = z.object({
  host: z.string().min(1, 'Host is required'),
  port: z.number().min(1).max(65535),
  username: z.string().optional(),
  password: z.string().optional(),
  type: z.enum(['http', 'https', 'socks4', 'socks5']).optional(),
});

export const incomingServerConfigSchema = z.object({
  protocol: z.enum(['imap', 'pop3', 'oauth2']),
  host: z.string().min(1, 'Host is required'),
  port: z.number().min(1).max(65535),
  useTls: z.boolean(),
});

export const outgoingServerConfigSchema = z.object({
  protocol: z.literal('smtp'),
  host: z.string().min(1, 'Host is required'),
  port: z.number().min(1).max(65535),
  useTls: z.boolean(),
});

export const accountSchema = z.object({
  id: z.string(),
  displayName: z.string().optional(),
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  incoming: incomingServerConfigSchema,
  outgoing: outgoingServerConfigSchema.optional(),
  useProxy: z.boolean().optional(),
  proxy: proxyConfigSchema.nullable().optional(),
  connectionStatus: z.enum(['connected', 'disconnected', 'connecting']).optional(),
  // OAuth2 validation
  authType: z.enum(['basic', 'oauth2']).optional(),
  clientId: z.string().optional(),
  refreshToken: z.string().optional(),
  accessToken: z.string().optional(),
  accessTokenExpiry: z.number().optional(),
});
