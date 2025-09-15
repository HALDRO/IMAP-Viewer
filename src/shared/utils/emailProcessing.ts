/**
 * @file Email processing utilities
 */

import type { EmailHeader } from '../types/email';

/**
 * Validates that the IMAP mailbox is properly opened
 */
export function validateMailbox(imap: { mailbox: unknown }): void {
  if (imap.mailbox === null || imap.mailbox === undefined || typeof imap.mailbox === 'boolean') {
    throw new Error('Mailbox is not properly opened');
  }
}

/**
 * Calculates message range for fetching emails
 */
export function calculateMessageRange(totalMessages: number, offset: number, limit: number): { start: number; end: number } {
  if (totalMessages === 0 || offset >= totalMessages) {
    return { start: 1, end: 0 }; // Invalid range
  }
  
  const start = Math.max(1, totalMessages - offset - limit + 1);
  const end = totalMessages - offset;
  
  return { start, end };
}

/**
 * Processes email envelope to extract sender information
 */
export function extractSenderInfo(fromAddress: { name?: string; address?: string } | null | undefined): string {
  if (fromAddress === null || fromAddress === undefined) {
    return 'Unknown Sender';
  }
  
  if ((fromAddress.name?.length ?? 0) > 0) {
    return `${fromAddress.name} <${fromAddress.address}>`;
  } else {
    return fromAddress.address ?? 'Unknown Sender';
  }
}

/**
 * Creates an EmailHeader object from IMAP message data
 */
export function createEmailHeader(message: {
  uid: number;
  envelope: {
    from?: Array<{ name?: string; address?: string }>;
    subject?: string;
    date?: Date;
  };
  flags?: Set<string>;
}): EmailHeader {
  const fromAddress = message.envelope.from?.[0];
  const fromText = extractSenderInfo(fromAddress);
  
  return {
    uid: message.uid,
    subject: message.envelope.subject ?? 'No Subject',
    from: { text: fromText },
    date: message.envelope.date?.toISOString() ?? new Date().toISOString(),
    seen: message.flags?.has('\\Seen') ?? false,
  };
}
