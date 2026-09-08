/**
 * XSS Prevention Utility - Output Escaping & Sanitization
 * Prevents Cross-Site Scripting (XSS) attacks through output encoding
 * 
 * OWASP A07:2021 - Cross-Site Scripting (XSS)
 * CWE-79: Improper Neutralization of Input During Web Page Generation
 * 
 * Escaping Strategy: Context-aware output encoding
 * - HTML context: Encode special characters as HTML entities
 * - Attribute context: Encode for safe attribute values
 * - URL context: Validate and encode URLs
 * - JavaScript context: Escape for safe JavaScript literals
 * - CSS context: Escape for safe CSS values
 */

/**
 * Escape HTML special characters to entities
 * Prevents interpretation of HTML/JavaScript
 * 
 * Characters encoded:
 * - & → &amp;
 * - < → &lt;
 * - > → &gt;
 * - " → &quot;
 * - ' → &#x27;
 * - / → &#x2F;
 * 
 * @param {string} str - String to escape
 * @returns {string} HTML-escaped string
 */
function escapeHtml(str) {
  if (typeof str !== 'string') {
    return str;
  }

  const htmlEscapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };

  return str.replace(/[&<>"'\/]/g, (char) => htmlEscapeMap[char]);
}

/**
 * Escape HTML attributes to prevent attribute injection
 * Escapes quotes and angle brackets
 * 
 * @param {string} str - Attribute value to escape
 * @returns {string} Escaped attribute value
 */
function escapeHtmlAttribute(str) {
  if (typeof str !== 'string') {
    return str;
  }

  return str
    .replace(/&/g, '&amp;')
    .replace(/'/g, '&#x27;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Escape string for safe use in JavaScript context
 * Handles line breaks, quotes, backslashes
 * 
 * @param {string} str - String to escape for JavaScript
 * @returns {string} Escaped string safe for JavaScript literal
 */
function escapeJavaScript(str) {
  if (typeof str !== 'string') {
    return str;
  }

  return str
    .replace(/\\/g, '\\\\')      // Backslash
    .replace(/"/g, '\\"')         // Double quote
    .replace(/'/g, "\\'")         // Single quote
    .replace(/\n/g, '\\n')        // Newline
    .replace(/\r/g, '\\r')        // Carriage return
    .replace(/\t/g, '\\t')        // Tab
    .replace(/\//g, '\\/')        // Forward slash (can close </ tags)
    .replace(/</g, '\\x3c')       // Less than
    .replace(/>/g, '\\x3e');      // Greater than
}

/**
 * Escape CSS to prevent CSS injection
 * Removes potentially dangerous CSS values
 * 
 * @param {string} str - CSS value to escape
 * @returns {string} Escaped CSS value
 */
function escapeCss(str) {
  if (typeof str !== 'string') {
    return str;
  }

  return str
    .replace(/[^a-zA-Z0-9]/g, (char) => {
      const code = char.charCodeAt(0);
      return '\\' + ('0' + code.toString(16)).slice(-2);
    });
}

/**
 * Validate and sanitize URLs to prevent javascript: protocol
 * Only allows http:, https:, and relative URLs
 * 
 * @param {string} url - URL to validate
 * @returns {string} Safe URL or empty string if dangerous
 */
function sanitizeUrl(url) {
  if (typeof url !== 'string') {
    return '';
  }

  const trimmedUrl = url.trim().toLowerCase();

  // Block dangerous protocols
  const blockedProtocols = [
    'javascript:',
    'data:',
    'vbscript:',
    'file:',
    'about:',
  ];

  for (const protocol of blockedProtocols) {
    if (trimmedUrl.startsWith(protocol)) {
      return '';
    }
  }

  // Allow relative URLs
  if (trimmedUrl.startsWith('/') || trimmedUrl.startsWith('./') || trimmedUrl.startsWith('../')) {
    return url.trim();
  }

  // Allow absolute URLs with safe protocols
  if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
    try {
      const cleaned = url.trim();
      new URL(cleaned); // Validate URL format
      return cleaned;
    } catch (e) {
      return '';
    }
  }

  // Reject everything else
  return '';
}

/**
 * Remove dangerous HTML tags and attributes
 * Whitelist approach: only allow safe tags/attributes
 * 
 * @param {string} html - HTML content to sanitize
 * @returns {string} Sanitized HTML (dangerous elements removed)
 */
function sanitizeHtml(html) {
  if (typeof html !== 'string') {
    return html;
  }

  // Remove script tags and content
  let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove style tags and content - CSS can carry XSS vectors (e.g.
  // url("javascript:...") in older/quirks-mode engines), so treat it the
  // same as script rather than leaving it untouched.
  sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Remove iframe tags
  sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');

  // Remove event handlers (onclick, onerror, onload, etc.)
  sanitized = sanitized.replace(/\son\w+\s*=\s*"[^"]*"/gi, '');
  sanitized = sanitized.replace(/\son\w+\s*=\s*'[^']*'/gi, '');
  sanitized = sanitized.replace(/\son\w+\s*=\s*[^\s>]*/gi, '');

  // Remove javascript: protocol from href/src
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*['"]?javascript:[^'">\s]*['"]?/gi, '');
  sanitized = sanitized.replace(/href\s*=\s*['"]?javascript:[^'">\s]*['"]?/gi, '');
  sanitized = sanitized.replace(/src\s*=\s*['"]?javascript:[^'">\s]*['"]?/gi, '');

  // Remove data: URIs from src (can contain JavaScript)
  sanitized = sanitized.replace(/src\s*=\s*['"]?data:[^'">\s]*['"]?/gi, '');

  // Remove potentially dangerous style attributes
  sanitized = sanitized.replace(/\bstyle\s*=\s*['"](?:.*?expression|.*?javascript|.*?behavior)[^'"]*['"]/gi, '');

  // Remove SVG-based XSS vectors: full open/close pairs first, then any
  // remaining bare/self-closing/unclosed <svg ...> opening tags. SVG can
  // carry XSS through <animate>, <set>, <foreignObject>, event handler
  // attributes, etc., so an unclosed or self-closing tag needs removing
  // too, not just properly-paired ones.
  sanitized = sanitized.replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '');
  sanitized = sanitized.replace(/<svg\b[^>]*>/gi, '');

  // Remove object and embed tags
  sanitized = sanitized.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '');
  sanitized = sanitized.replace(/<embed\b[^<]*(\/)?>/gi, '');

  return sanitized;
}

/**
 * Escape JSON string for safe embedding in HTML
 * Prevents JSON breakout attacks
 * 
 * @param {*} value - Value to convert and escape
 * @returns {string} Safe JSON string for HTML embedding
 */
function escapeJsonForHtml(value) {
  const json = JSON.stringify(value);
  return escapeHtml(json);
}

/**
 * Create a safe text node (prevents interpretation as HTML)
 * Used when setting text content instead of HTML content
 * 
 * @param {string} text - Text to make safe
 * @returns {string} Text marked as safe for text content
 */
function createSafeTextNode(text) {
  if (typeof text !== 'string') {
    return '';
  }

  return text;
}

/**
 * Validate email format without DNS checks
 * Prevents email header injection
 * 
 * @param {string} email - Email to validate
 * @returns {boolean} Whether email format is valid
 */
function isValidEmailFormat(email) {
  if (typeof email !== 'string') {
    return false;
  }

  // RFC 5322 simplified pattern
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Check for newlines (CRLF injection)
  if (email.includes('\n') || email.includes('\r')) {
    return false;
  }

  return emailRegex.test(email);
}

/**
 * Remove null bytes which can truncate strings in some contexts
 * 
 * @param {string} str - String to clean
 * @returns {string} String without null bytes
 */
function removeNullBytes(str) {
  if (typeof str !== 'string') {
    return str;
  }

  return str.replace(/\0/g, '');
}

/**
 * Comprehensive output sanitizer for API responses
 * Escapes all text fields to prevent XSS
 * 
 * @param {Object} data - Object to sanitize
 * @param {string[]} fieldsToEscape - List of field names to escape (optional)
 * @returns {Object} Sanitized object with escaped fields
 */
// Field names that hold URLs, not free-form text - these get URL-sanitized
// (protocol allowlist) instead of HTML-escaped, since HTML-escaping a URL
// (e.g. '/' -> '&#x2F;') corrupts it for actual use as a link/image source
// without adding any real safety benefit.
const URL_FIELD_NAME_PATTERN = /(^|[_-])(url|link|href|src|avatar|photo|image|thumbnail|logo|icon)([_-]|$)/i;

function sanitizeApiResponse(data, fieldsToEscape = []) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeApiResponse(item, fieldsToEscape));
  }

  const sanitized = {};

  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string' && (fieldsToEscape.length === 0 || fieldsToEscape.includes(key))) {
      sanitized[key] = URL_FIELD_NAME_PATTERN.test(key) ? sanitizeUrl(value) : escapeHtml(value);
    } else if (typeof value === 'object' && value !== null) {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeApiResponse(value, fieldsToEscape);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Create Content Security Policy (CSP) header value
 * Restricts sources of content to prevent XSS
 * 
 * @param {Object} options - CSP directives options
 * @returns {string} CSP header value
 */
function createCspHeader(options = {}) {
  const defaults = {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for now
    imgSrc: ["'self'", 'https:', 'data:'],
    fontSrc: ["'self'", 'https:'],
    connectSrc: ["'self'"],
    frameSrc: ["'none'"],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    formAction: ["'self'"],
    baseUri: ["'self'"],
    frameAncestors: ["'none'"],
    upgradeInsecureRequests: true,
    blockAllMixedContent: true,
  };

  const config = { ...defaults, ...options };

  const directives = [];

  for (const [key, value] of Object.entries(config)) {
    if (key === 'upgradeInsecureRequests' || key === 'blockAllMixedContent') {
      if (value) {
        directives.push(convertCamelCaseToKebab(key));
      }
    } else if (Array.isArray(value)) {
      directives.push(`${convertCamelCaseToKebab(key)} ${value.join(' ')}`);
    }
  }

  return directives.join('; ');
}

/**
 * Convert camelCase to kebab-case for CSS header directives
 * @private
 */
function convertCamelCaseToKebab(str) {
  return str.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

/**
 * Verify script integrity with SRI (Subresource Integrity)
 * Ensures loaded scripts haven't been modified
 * 
 * @param {string} url - Script URL
 * @param {string} hash - Expected hash (format: sha384-xxxxx)
 * @returns {string} Script tag with integrity attribute
 */
function createScriptTagWithIntegrity(url, hash) {
  return `<script src="${escapeHtmlAttribute(url)}" integrity="${escapeHtmlAttribute(hash)}" crossorigin="anonymous"><\/script>`;
}

/**
 * Common XSS payload patterns (for testing)
 * These are examples of what to detect and prevent
 */
const xssPayloadPatterns = {
  scriptTag: '<script>alert("xss")</script>',
  eventHandler: '<img src=x onerror="alert(1)">',
  javascriptProtocol: '<a href="javascript:alert(1)">Click</a>',
  datataURI: '<img src="data:text/html,<script>alert(1)</script>">',
  svgVector: '<svg onload="alert(1)">',
  styleTag: '<style>body { background: url("javascript:alert(1)"); }</style>',
  iframeTag: '<iframe src="javascript:alert(1)"></iframe>',
  bodyTag: '<body onload="alert(1)">',
  formTag: '<form action="javascript:alert(1)">',
  inputTag: '<input onfocus="alert(1)" autofocus>',
  imgTag: '<img src=x onerror="alert(1)">',
  anchorTag: '<a href="javascript:void(0)" onclick="alert(1)">click</a>',
  commentTag: '<!-- <img src=x onerror="alert(1)"> -->',
  nullByteInjection: 'test\x00<script>alert(1)</script>',
  unicodeEscape: '<img src=x onerror="&#97;&#108;&#101;&#114;&#116;&#40;&#49;&#41;">',
};

module.exports = {
  escapeHtml,
  escapeHtmlAttribute,
  escapeJavaScript,
  escapeCss,
  sanitizeUrl,
  sanitizeHtml,
  escapeJsonForHtml,
  createSafeTextNode,
  isValidEmailFormat,
  removeNullBytes,
  sanitizeApiResponse,
  createCspHeader,
  createScriptTagWithIntegrity,
  xssPayloadPatterns,
};
