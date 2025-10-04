/**
 * @file Enhanced Email Renderer
 * @description Advanced email content renderer with support for various email formats.
 * Uses DOMPurify for sanitization and applies email-client-specific fixes.
 * Handles HTML emails, plain text, and structured content with proper styling.
 */
import DOMPurify from 'dompurify'
import type React from 'react'
import { useMemo } from 'react'

import '../shared/styles/email-content.css'

interface EmailRendererProps {
  /** HTML content from email */
  html?: string
  /** Plain text content */
  text?: string
  /** Text formatted as HTML */
  textAsHtml?: string
  /** Rendering mode */
  mode: 'html' | 'text'
  /** Custom className */
  className?: string
}

/**
 * Enhanced email renderer with support for various email client quirks
 */
export const EmailRenderer: React.FC<EmailRendererProps> = ({
  html,
  text,
  textAsHtml,
  mode,
  className = '',
}) => {
  /**
   * Process and sanitize email content
   */
  const processedContent = useMemo(() => {
    if (mode === 'html') {
      // Try HTML first
      if (html && html.length > 0) {
        return sanitizeAndNormalizeHtml(html)
      }
      // Fallback to textAsHtml
      if (textAsHtml && textAsHtml.length > 0) {
        return sanitizeAndNormalizeHtml(textAsHtml)
      }
      // Convert plain text to HTML as last resort
      if (text && text.length > 0) {
        return convertPlainTextToHtml(text)
      }
    } else {
      // Text mode
      if (textAsHtml && textAsHtml.length > 0) {
        return sanitizeAndNormalizeHtml(textAsHtml)
      }
      if (text && text.length > 0) {
        return convertPlainTextToHtml(text)
      }
    }

    return '<div class="email-no-content"><p>No email content available</p></div>'
  }, [html, text, textAsHtml, mode])

  return (
    <div
      className={`email-content email-renderer ${className}`}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: Content is sanitized with DOMPurify
      dangerouslySetInnerHTML={{ __html: processedContent }}
    />
  )
}

/**
 * Sanitize and normalize HTML for safe display
 * Applies fixes for various email client quirks
 */
function sanitizeAndNormalizeHtml(html: string): string {
  // Step 1: Pre-process HTML to fix common email client issues
  let processed = html

  // Fix Outlook conditional comments
  processed = processed.replace(/<!--\[if.*?endif\]-->/gs, '')

  // Remove Microsoft Office tags
  processed = processed.replace(/<o:p>.*?<\/o:p>/gi, '')
  processed = processed.replace(/<w:.*?>/gi, '')
  processed = processed.replace(/<m:.*?>/gi, '')

  // Step 2: Sanitize with DOMPurify
  const sanitized = DOMPurify.sanitize(processed, {
    KEEP_CONTENT: true,
    ALLOW_UNKNOWN_PROTOCOLS: true,
    FORBID_TAGS: ['style', 'script'], // Remove problematic tags
    FORBID_ATTR: ['target'], // Remove target to prevent new windows
    ADD_ATTR: ['class'], // Allow class attributes for styling
  })

  // Step 3: Post-process to normalize styling
  const normalized = normalizeEmailStyles(sanitized)

  return normalized
}

/**
 * Normalize email styles for consistent display
 */
function normalizeEmailStyles(html: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  // Fix tables (common in HTML emails)
  const tables = doc.querySelectorAll('table')
  for (const table of tables) {
    // Add responsive classes
    table.classList.add('email-table')

    // Ensure table has proper structure
    if (!table.querySelector('tbody') && table.querySelector('tr')) {
      const tbody = doc.createElement('tbody')
      while (table.firstChild) {
        tbody.appendChild(table.firstChild)
      }
      table.appendChild(tbody)
    }
  }

  // Fix images
  const images = doc.querySelectorAll('img')
  for (const img of images) {
    img.classList.add('email-img')
    // Add loading="lazy" for performance
    img.setAttribute('loading', 'lazy')

    // Remove width/height attributes to make responsive
    const width = img.getAttribute('width')
    const height = img.getAttribute('height')
    if (width) {
      img.style.maxWidth = '100%'
      img.removeAttribute('width')
    }
    if (height) {
      img.style.height = 'auto'
      img.removeAttribute('height')
    }
  }

  // Fix links
  const links = doc.querySelectorAll('a')
  for (const link of links) {
    link.classList.add('email-link')
    // Remove target to use our browser handler
    link.removeAttribute('target')
  }

  // Wrap orphan text in paragraphs
  const body = doc.body
  const walker = doc.createTreeWalker(body, NodeFilter.SHOW_TEXT)
  const textNodes: Node[] = []

  let node = walker.nextNode()
  while (node) {
    if (node.textContent?.trim()) {
      textNodes.push(node)
    }
    node = walker.nextNode()
  }

  for (const textNode of textNodes) {
    if (textNode.parentElement?.tagName === 'BODY') {
      const p = doc.createElement('p')
      textNode.parentNode?.insertBefore(p, textNode)
      p.appendChild(textNode)
    }
  }

  return doc.body.innerHTML
}

/**
 * Convert plain text to formatted HTML
 * Detects URLs, emails, phone numbers and applies formatting
 */
function convertPlainTextToHtml(text: string): string {
  let processed = DOMPurify.sanitize(text)

  // Detect and convert URLs
  const urlRegex = /((?:https?:\/\/|www\.)[^\s<>"']+[^\s<>"'.,;:!?])/gi
  processed = processed.replace(urlRegex, match => {
    const url = match.startsWith('www.') ? `https://${match}` : match
    return `<a href="${url}" class="email-link" rel="noopener noreferrer">${match}</a>`
  })

  // Detect and convert email addresses
  const emailRegex = /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g
  processed = processed.replace(emailRegex, '<a href="mailto:$1" class="email-link">$1</a>')

  // Detect and convert phone numbers
  const phoneRegex = /\b(\+?[\d\s()-]{10,})\b/g
  processed = processed.replace(phoneRegex, '<a href="tel:$1" class="email-link">$1</a>')

  // Convert markdown-like formatting
  // **bold** → <strong>
  processed = processed.replace(
    /\*\*([^*]+)\*\*/g,
    '<strong class="email-highlight-strong">$1</strong>'
  )
  // *italic* → <em>
  processed = processed.replace(/\*([^*]+)\*/g, '<em class="email-highlight-em">$1</em>')
  // _underline_ → <u>
  processed = processed.replace(/_([^_]+)_/g, '<u>$1</u>')

  // Convert multiple line breaks to paragraphs
  const paragraphs = processed
    .split(/\n\s*\n/)
    .map(para => para.trim())
    .filter(para => para.length > 0)
    .map(para => {
      // Convert single line breaks to <br>
      const withBreaks = para.replace(/\n/g, '<br>')
      return `<p>${withBreaks}</p>`
    })
    .join('\n')

  return `<div class="email-text-content">${paragraphs}</div>`
}

/**
 * Detect email type for specialized rendering
 * This function is exported for future use in email type badges or specialized rendering modes
 */
export function detectEmailType(
  html?: string,
  _text?: string
): 'plain' | 'html' | 'rich' | 'marketing' {
  if (!html || html.length === 0) return 'plain'

  const hasTable = /<table/i.test(html)
  const hasImages = /<img/i.test(html)
  const hasStyles = /<style/i.test(html)
  const isLong = html.length > 10000

  // Marketing emails typically have tables, images, and styles
  if (hasTable && hasImages && (hasStyles || isLong)) {
    return 'marketing'
  }

  // Rich HTML with formatting
  if (hasTable || hasImages || hasStyles) {
    return 'rich'
  }

  // Simple HTML
  if (/<[a-z][\s\S]*>/i.test(html)) {
    return 'html'
  }

  return 'plain'
}

export default EmailRenderer
