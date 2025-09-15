/**
 * @file Email content sanitization service
 * Simple service for handling email content display
 */

export interface EmailContent {
  html?: string | false;
  text?: string;
  textAsHtml?: string;
}

/**
 * Simple service for email content handling
 */
export class EmailSanitizationService {
  /**
   * Legacy method for backward compatibility
   * Now just returns a simple message since logic moved to component
   */
  static getSanitizedHtml(email: EmailContent | null): string {
    if (!email) return '<div style="color: white; padding: 20px;"><p>No email content available</p></div>';
    
    // Simple fallback - prefer textAsHtml, then text
    if (email.textAsHtml !== null && email.textAsHtml !== undefined && typeof email.textAsHtml === 'string' && email.textAsHtml.length > 0) {
      return email.textAsHtml;
    }

    if (email.text !== null && email.text !== undefined && typeof email.text === 'string' && email.text.length > 0) {
      return `<div style="white-space: pre-wrap; word-wrap: break-word; font-family: inherit; line-height: 1.6; color: white;">${email.text}</div>`;
    }
    
    return '<div style="color: white; padding: 20px;"><p>No content available</p></div>';
  }

  /**
   * Checks if email content contains suspicious elements
   */
  static hasSuspiciousContent(email: EmailContent | null): boolean {
    if (!email) return false;

    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i,
    ];

    const contentToCheck = [
      email.html,
      email.textAsHtml,
      email.text
    ].filter(Boolean).join(' ');

    return suspiciousPatterns.some(pattern => pattern.test(contentToCheck));
  }
}
