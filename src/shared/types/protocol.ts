/**
 * @file Protocol types for email server configuration and discovery
 */

export interface ServerConfig {
  host: string;
  port: number;
  secure: boolean;
}

export interface DiscoveredConfig {
  imap?: ServerConfig | null;
  smtp?: ServerConfig | null;
  pop3?: ServerConfig | null;
}

export interface ProtocolConfig {
  protocol: 'imap' | 'pop3' | 'smtp';
  host: string;
  port: number;
  secure: boolean;
}
