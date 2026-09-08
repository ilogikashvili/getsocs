/**
 * Security Headers Middleware
 * Implements Content Security Policy (CSP) and other security headers
 * Prevents XSS, clickjacking, and other browser-based attacks
 * 
 * OWASP A07:2021 - Cross-Site Scripting (XSS)
 * OWASP A04:2021 - Insecure Design
 */

const { createCspHeader } = require('../utils/xssPrevention');

/**
 * Middleware to add security headers to all responses
 * Headers include:
 * - Content-Security-Policy (CSP): Prevents XSS
 * - X-Content-Type-Options: Prevents MIME sniffing
 * - X-Frame-Options: Prevents clickjacking
 * - X-XSS-Protection: Legacy XSS protection (modern browsers)
 * - Referrer-Policy: Controls referrer information
 * - Strict-Transport-Security (HSTS): Forces HTTPS
 * - Permissions-Policy: Restricts browser APIs
 * 
 * @returns {Function} Express middleware
 */
function addSecurityHeaders() {
  return (req, res, next) => {
    // Content-Security-Policy (CSP) - Most important header
    // Prevents inline scripts, restricts external script sources
    const cspOptions = {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        // Add any trusted CDN URLs here
        // 'https://cdn.example.com',
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'", // Required for most React apps, remove if possible
      ],
      imgSrc: [
        "'self'",
        'https:',
        'data:', // Allow base64 encoded images
      ],
      fontSrc: [
        "'self'",
        'https:',
      ],
      connectSrc: [
        "'self'",
        // Add any API endpoints here
        // 'https://api.example.com',
      ],
      frameSrc: ["'none'"], // Prevent embedding in frames
      objectSrc: ["'none'"], // Prevent Flash, etc.
      mediaSrc: ["'self'"],
      formAction: ["'self'"], // Restrict form submissions
      baseUri: ["'self'"], // Restrict <base> tag
      frameAncestors: ["'none'"], // Prevent clickjacking
      upgradeInsecureRequests: true, // Upgrade HTTP to HTTPS
      blockAllMixedContent: true, // Block HTTP in HTTPS page
    };

    res.setHeader('Content-Security-Policy', createCspHeader(cspOptions));

    // X-Content-Type-Options: Prevent MIME type sniffing
    // Forces browser to respect Content-Type header
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // X-Frame-Options: Prevent clickjacking
    // Prevents page from being embedded in frames
    res.setHeader('X-Frame-Options', 'DENY');

    // X-XSS-Protection: Legacy XSS protection
    // Modern browsers ignore this, but helps older browsers
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Referrer-Policy: Control referrer information
    // 'strict-no-referrer': Never send referrer
    res.setHeader('Referrer-Policy', 'strict-no-referrer');

    // Permissions-Policy (formerly Feature-Policy): Restrict browser APIs
    // Disable potentially dangerous APIs
    res.setHeader(
      'Permissions-Policy',
      [
        'accelerometer=()',
        'ambient-light-sensor=()',
        'autoplay=()',
        'battery=()',
        'camera=()',
        'cross-origin-isolated=()',
        'display-capture=()',
        'document-domain=()',
        'encrypted-media=()',
        'execution-while-not-rendered=()',
        'execution-while-out-of-viewport=()',
        'fullscreen=()',
        'geolocation=()',
        'gyroscope=()',
        'magnetometer=()',
        'microphone=()',
        'midi=()',
        'navigation-override=()',
        'payment=()',
        'picture-in-picture=()',
        'publickey-credentials-get=()',
        'sync-xhr=()',
        'usb=()',
        'vr=()',
        'wake-lock=()',
        'xr-spatial-tracking=()',
      ].join(', ')
    );

    // Strict-Transport-Security (HSTS): Force HTTPS
    // max-age in seconds (one year = 31536000)
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

    // Expect-CT: Certificate Transparency (optional)
    // Helps detect misissued SSL certificates
    res.setHeader('Expect-CT', 'max-age=86400, enforce');

    next();
  };
}

/**
 * Middleware to prevent CORS-based XSS attacks
 * Validates and enforces CORS policies
 * 
 * @param {string[]} allowedOrigins - List of allowed origins
 * @returns {Function} Express middleware
 */
function corsXssProtection(allowedOrigins = []) {
  return (req, res, next) => {
    const origin = req.get('origin');

    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }

    // Preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    next();
  };
}

/**
 * Middleware to prevent clickjacking attacks
 * Multiple layers of protection
 * 
 * @returns {Function} Express middleware
 */
function preventClickjacking() {
  return (req, res, next) => {
    // X-Frame-Options (already set in addSecurityHeaders)
    // Additional protection: Set framebust header
    res.setHeader('X-Frame-Options', 'DENY');

    // Frame-Ancestors (already in CSP)
    // Additional safety

    next();
  };
}

/**
 * Middleware to add safe default headers
 * Combines multiple security header middlewares
 * 
 * @returns {Function} Express middleware
 */
function createSecurityHeadersMiddleware(options = {}) {
  const {
    enableCsp = true,
    enableHsts = true,
    enableXssProtection = true,
    enableClickjacking = true,
    corsOrigins = [],
  } = options;

  return (req, res, next) => {
    // Add CSP headers
    if (enableCsp) {
      const cspOptions = {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'https:', 'data:'],
        fontSrc: ["'self'", 'https:'],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
      };

      res.setHeader('Content-Security-Policy', createCspHeader(cspOptions));
    }

    // Add HSTS header
    if (enableHsts) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    // Add XSS protection headers
    if (enableXssProtection) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-XSS-Protection', '1; mode=block');
    }

    // Add clickjacking protection
    if (enableClickjacking) {
      res.setHeader('X-Frame-Options', 'DENY');
    }

    // Add Referrer-Policy
    res.setHeader('Referrer-Policy', 'strict-no-referrer');

    // Add Permissions-Policy
    res.setHeader(
      'Permissions-Policy',
      [
        'geolocation=()',
        'microphone=()',
        'camera=()',
        'payment=()',
        'usb=()',
        'magnetometer=()',
        'gyroscope=()',
        'accelerometer=()',
      ].join(', ')
    );

    // Handle CORS if origins provided
    if (corsOrigins.length > 0) {
      const origin = req.get('origin');
      if (origin && corsOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }
    }

    next();
  };
}

/**
 * Nonce generation for CSP inline scripts
 * Allows specific inline scripts while blocking others
 * 
 * @returns {string} Random nonce value
 */
function generateCspNonce() {
  const crypto = require('crypto');
  return crypto.randomBytes(16).toString('base64');
}

/**
 * Create CSP header with nonce for inline scripts
 * Use when inline scripts are necessary
 * 
 * @param {string} nonce - Nonce value
 * @returns {string} CSP header value with nonce
 */
function createCspHeaderWithNonce(nonce) {
  return `default-src 'self'; script-src 'self' 'nonce-${nonce}'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; upgrade-insecure-requests; block-all-mixed-content`;
}

/**
 * Middleware to attach nonce to response locals
 * Makes nonce available in views/templates
 * 
 * @returns {Function} Express middleware
 */
function attachCspNonce() {
  return (req, res, next) => {
    res.locals.cspNonce = generateCspNonce();
    res.setHeader('Content-Security-Policy', createCspHeaderWithNonce(res.locals.cspNonce));
    next();
  };
}

/**
 * Validate and sanitize response headers
 * Prevents response header injection
 * 
 * @param {string} headerName - Header name
 * @param {string} headerValue - Header value
 * @returns {boolean} Whether header is safe
 */
function isHeaderSafe(headerName, headerValue) {
  // Check for CRLF injection
  if (headerName.includes('\r') || headerName.includes('\n')) {
    return false;
  }

  if (headerValue.includes('\r') || headerValue.includes('\n')) {
    return false;
  }

  // Check for null bytes
  if (headerName.includes('\0') || headerValue.includes('\0')) {
    return false;
  }

  return true;
}

/**
 * Prevent HTTP response splitting attacks
 * Sanitizes response headers before sending
 * 
 * @returns {Function} Express middleware
 */
function preventResponseSplitting() {
  return (req, res, next) => {
    const originalSet = res.setHeader;

    res.setHeader = function (name, value) {
      if (!isHeaderSafe(name, value)) {
        console.warn(`Blocked unsafe header: ${name}`);
        return res;
      }

      return originalSet.call(this, name, value);
    };

    next();
  };
}

module.exports = {
  addSecurityHeaders,
  corsXssProtection,
  preventClickjacking,
  createSecurityHeadersMiddleware,
  generateCspNonce,
  createCspHeaderWithNonce,
  attachCspNonce,
  isHeaderSafe,
  preventResponseSplitting,
};
