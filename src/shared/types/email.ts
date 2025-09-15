/**
 * @file Email types for headers and content
 */

import type { Buffer } from 'buffer';

export interface EmailHeader {
  uid: number;
  subject: string;
  from: {
    text: string;
  };
  date: string;
  seen: boolean;
  snippet?: string;
  flags?: string[];
  attributes?: Record<string, unknown>;
}

export interface EmailAttachment {
  filename?: string;
  contentType: string;
  size: number;
  content?: Buffer;
  contentId?: string;
  cid?: string;
  related?: boolean;
}

export interface Email extends EmailHeader {
  html?: string | false;
  text?: string;
  textAsHtml?: string;
  to?: {
    text: string;
  };
  flags?: string[];
  attachments?: EmailAttachment[];
}
