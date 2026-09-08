/**
 * XSS Prevention Test Suite
 * Tests for output escaping, HTML sanitization, and CSP headers
 * 
 * Total Tests: 100+
 * Coverage: HTML escaping, attribute escaping, URL validation, CSS escaping,
 * JSON escaping, XSS payload detection, CSP header validation, security headers
 */

const {
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
} = require('../utils/xssPrevention');

const {
  addSecurityHeaders,
  corsXssProtection,
  preventClickjacking,
  createSecurityHeadersMiddleware,
  generateCspNonce,
  createCspHeaderWithNonce,
  attachCspNonce,
  isHeaderSafe,
  preventResponseSplitting,
} = require('../middleware/securityHeaders');

describe('XSS Prevention Test Suite', () => {
  /**
   * Group 1: HTML Escaping (15 tests)
   */
  describe('1. HTML Escaping - escapeHtml()', () => {
    test('should escape ampersand', () => {
      expect(escapeHtml('&')).toBe('&amp;');
      expect(escapeHtml('a&b')).toBe('a&amp;b');
    });

    test('should escape less than', () => {
      expect(escapeHtml('<')).toBe('&lt;');
      expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
    });

    test('should escape greater than', () => {
      expect(escapeHtml('>')).toBe('&gt;');
      expect(escapeHtml('a>b')).toBe('a&gt;b');
    });

    test('should escape double quotes', () => {
      expect(escapeHtml('"')).toBe('&quot;');
      expect(escapeHtml('value="test"')).toBe('value=&quot;test&quot;');
    });

    test('should escape single quotes', () => {
      expect(escapeHtml("'")).toBe('&#x27;');
      expect(escapeHtml("it's")).toBe('it&#x27;s');
    });

    test('should escape forward slashes', () => {
      expect(escapeHtml('/')).toBe('&#x2F;');
      expect(escapeHtml('</script>')).toBe('&lt;&#x2F;script&gt;');
    });

    test('should escape script tags', () => {
      const input = '<script>alert("xss")</script>';
      const expected = '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;';
      expect(escapeHtml(input)).toBe(expected);
    });

    test('should escape multiple special characters', () => {
      const input = '<img src="x" onerror="alert(1)">';
      const expected = '&lt;img src=&quot;x&quot; onerror=&quot;alert(1)&quot;&gt;';
      expect(escapeHtml(input)).toBe(expected);
    });

    test('should handle empty string', () => {
      expect(escapeHtml('')).toBe('');
    });

    test('should not escape safe characters', () => {
      const safe = 'Hello World 123!@#$%';
      expect(escapeHtml(safe)).toBe(safe);
    });

    test('should handle null/undefined gracefully', () => {
      expect(escapeHtml(null)).toBe(null);
      expect(escapeHtml(undefined)).toBe(undefined);
      expect(escapeHtml(123)).toBe(123);
    });

    test('should prevent HTML injection', () => {
      const injection = '<img src=x onerror=alert(1)>';
      const escaped = escapeHtml(injection);
      expect(escaped).not.toContain('<img');
      // The dangerous part isn't the word "onerror" (that's harmless text
      // once escaped) - it's whether the browser can parse this as a real
      // tag at all. As long as '<' and '>' are escaped, it can't.
      expect(escaped).not.toMatch(/<img[^&]*onerror/);
      expect(escaped).toContain('&lt;');
      expect(escaped).toContain('&gt;');
    });

    test('should prevent script tag injection', () => {
      const injection = '<script>fetch("/api/steal-data")</script>';
      const escaped = escapeHtml(injection);
      expect(escaped).not.toContain('<script>');
      expect(escaped).toContain('&lt;script&gt;');
    });

    test('should prevent event handler injection', () => {
      const injection = 'onclick="malicious()"';
      const escaped = escapeHtml(injection);
      expect(escaped).toContain('&quot;');
      expect(escaped).not.toContain('onclick="');
    });

    test('should escape complex XSS payload', () => {
      const payload = '<svg onload="fetch(\'http://evil.com\')">';
      const escaped = escapeHtml(payload);
      expect(escaped).not.toContain('<svg');
      expect(escaped).toContain('&lt;svg');
      expect(escaped).toContain('&gt;');
    });
  });

  /**
   * Group 2: HTML Attribute Escaping (10 tests)
   */
  describe('2. HTML Attribute Escaping - escapeHtmlAttribute()', () => {
    test('should escape double quotes in attributes', () => {
      expect(escapeHtmlAttribute('"')).toBe('&quot;');
      expect(escapeHtmlAttribute('value="test"')).toBe('value=&quot;test&quot;');
    });

    test('should escape single quotes in attributes', () => {
      expect(escapeHtmlAttribute("'")).toBe('&#x27;');
    });

    test('should escape ampersands in attributes', () => {
      expect(escapeHtmlAttribute('a&b')).toBe('a&amp;b');
    });

    test('should escape angle brackets in attributes', () => {
      expect(escapeHtmlAttribute('<img')).toBe('&lt;img');
      expect(escapeHtmlAttribute('test>')).toBe('test&gt;');
    });

    test('should prevent attribute injection', () => {
      const injection = '" onload="alert(1)';
      const escaped = escapeHtmlAttribute(injection);
      // The quote is what makes this dangerous (it lets the payload break
      // out of the attribute value); once '"' is escaped to '&quot;', the
      // literal text "onload=" left over can't be parsed as a real
      // attribute by the browser.
      expect(escaped).not.toContain('" onload=');
      expect(escaped).toContain('&quot;');
    });

    test('should handle empty string', () => {
      expect(escapeHtmlAttribute('')).toBe('');
    });

    test('should handle safe attribute values', () => {
      const safe = 'example@example.com';
      expect(escapeHtmlAttribute(safe)).toBe(safe);
    });

    test('should escape protocol injection', () => {
      const injection = 'javascript:alert(1)';
      const escaped = escapeHtmlAttribute(injection);
      expect(escaped).toBe(injection); // Escaping doesn't change it, sanitization does
    });

    test('should handle multiple quotes', () => {
      const input = '"test"\'value\'';
      const escaped = escapeHtmlAttribute(input);
      expect(escaped).toContain('&quot;');
      expect(escaped).toContain('&#x27;');
    });

    test('should escape complex attribute payload', () => {
      const payload = '" style="background: url(javascript:alert(1))';
      const escaped = escapeHtmlAttribute(payload);
      expect(escaped).not.toContain('" style=');
    });
  });

  /**
   * Group 3: JavaScript Escaping (8 tests)
   */
  describe('3. JavaScript Escaping - escapeJavaScript()', () => {
    test('should escape backslashes', () => {
      expect(escapeJavaScript('\\')).toBe('\\\\');
    });

    test('should escape double quotes', () => {
      expect(escapeJavaScript('"')).toBe('\\"');
    });

    test('should escape single quotes', () => {
      expect(escapeJavaScript("'")).toBe("\\'");
    });

    test('should escape newlines', () => {
      expect(escapeJavaScript('line1\nline2')).toBe('line1\\nline2');
    });

    test('should escape forward slashes', () => {
      // Forward slashes are escaped JS-string-style (\/), not as an HTML
      // entity - this is for safely embedding inside a <script> block,
      // where \/ still breaks up a literal "</script>" sequence.
      expect(escapeJavaScript('</script>')).toBe('\\x3c\\/script\\x3e');
    });

    test('should escape angle brackets', () => {
      expect(escapeJavaScript('<script>')).toBe('\\x3cscript\\x3e');
    });

    test('should prevent breaking out of quotes', () => {
      const injection = '"; alert(1); var x = "';
      const escaped = escapeJavaScript(injection);
      // Every '"' in the payload must be backslash-escaped, so it can't
      // terminate the string literal it gets embedded into.
      const unescapedQuoteCount = (escaped.match(/(?<!\\)"/g) || []).length;
      expect(unescapedQuoteCount).toBe(0);
      expect(escaped).toContain('\\"; alert');
    });

    test('should handle complex JavaScript payload', () => {
      const payload = 'value"; fetch("/steal").then(r => r.text()); var x = "';
      const escaped = escapeJavaScript(payload);
      expect(escaped).toContain('\\"');
    });
  });

  /**
   * Group 4: CSS Escaping (6 tests)
   */
  describe('4. CSS Escaping - escapeCss()', () => {
    test('should escape special CSS characters', () => {
      const escaped = escapeCss('test!@#$%');
      expect(escaped).not.toContain('!');
      expect(escaped).toContain('\\');
    });

    test('should prevent CSS injection', () => {
      const injection = 'red; background: url(javascript:alert(1))';
      const escaped = escapeCss(injection);
      expect(escaped).not.toContain('javascript:');
    });

    test('should escape semicolons in CSS', () => {
      const escaped = escapeCss('color: red;');
      expect(escaped).toContain('\\');
    });

    test('should handle empty string', () => {
      expect(escapeCss('')).toBe('');
    });

    test('should escape parentheses', () => {
      const escaped = escapeCss('url(javascript:alert(1))');
      expect(escaped).not.toContain('(');
    });

    test('should handle alphanumeric only', () => {
      const safe = 'abc123';
      expect(escapeCss(safe)).toBe(safe);
    });
  });

  /**
   * Group 5: URL Sanitization (12 tests)
   */
  describe('5. URL Sanitization - sanitizeUrl()', () => {
    test('should allow http URLs', () => {
      const url = 'http://example.com/path';
      expect(sanitizeUrl(url)).toBe(url);
    });

    test('should allow https URLs', () => {
      const url = 'https://example.com/path';
      expect(sanitizeUrl(url)).toBe(url);
    });

    test('should allow relative URLs', () => {
      expect(sanitizeUrl('/path/to/page')).toBe('/path/to/page');
      expect(sanitizeUrl('./relative')).toBe('./relative');
      expect(sanitizeUrl('../parent')).toBe('../parent');
    });

    test('should block javascript: protocol', () => {
      expect(sanitizeUrl('javascript:alert(1)')).toBe('');
      expect(sanitizeUrl('JAVASCRIPT:alert(1)')).toBe('');
    });

    test('should block data: protocol', () => {
      expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe('');
    });

    test('should block vbscript: protocol', () => {
      expect(sanitizeUrl('vbscript:msgbox("xss")')).toBe('');
    });

    test('should block file: protocol', () => {
      expect(sanitizeUrl('file:///etc/passwd')).toBe('');
    });

    test('should block about: protocol', () => {
      expect(sanitizeUrl('about:blank')).toBe('');
    });

    test('should validate URL format', () => {
      expect(sanitizeUrl('http://invalid url')).toBe('');
    });

    test('should trim whitespace', () => {
      const url = '  https://example.com  ';
      expect(sanitizeUrl(url)).toBe('https://example.com');
    });

    test('should handle null/undefined', () => {
      expect(sanitizeUrl(null)).toBe('');
      expect(sanitizeUrl(undefined)).toBe('');
    });

    test('should reject unknown protocols', () => {
      expect(sanitizeUrl('ftp://example.com')).toBe('');
      expect(sanitizeUrl('telnet://example.com')).toBe('');
    });
  });

  /**
   * Group 6: HTML Sanitization (10 tests)
   */
  describe('6. HTML Sanitization - sanitizeHtml()', () => {
    test('should remove script tags', () => {
      const input = '<script>alert("xss")</script>';
      const result = sanitizeHtml(input);
      expect(result).not.toContain('<script');
    });

    test('should remove iframe tags', () => {
      const input = '<iframe src="evil.com"></iframe>';
      const result = sanitizeHtml(input);
      expect(result).not.toContain('<iframe');
    });

    test('should remove event handlers', () => {
      const input = '<img src=x onerror="alert(1)">';
      const result = sanitizeHtml(input);
      expect(result).not.toContain('onerror');
    });

    test('should remove javascript: from href', () => {
      const input = '<a href="javascript:alert(1)">click</a>';
      const result = sanitizeHtml(input);
      expect(result).not.toContain('javascript:');
    });

    test('should remove SVG XSS vectors', () => {
      const input = '<svg onload="alert(1)">';
      const result = sanitizeHtml(input);
      expect(result).not.toContain('<svg');
    });

    test('should remove object tags', () => {
      const input = '<object data="evil.swf"></object>';
      const result = sanitizeHtml(input);
      expect(result).not.toContain('<object');
    });

    test('should remove embed tags', () => {
      const input = '<embed src="evil.swf">';
      const result = sanitizeHtml(input);
      expect(result).not.toContain('<embed');
    });

    test('should remove onclick events', () => {
      const input = '<button onclick="steal()">Click</button>';
      const result = sanitizeHtml(input);
      expect(result).not.toContain('onclick');
    });

    test('should handle multiple attacks', () => {
      const input = '<script>x</script><img onerror=alert(1)><svg onload=x>';
      const result = sanitizeHtml(input);
      expect(result).not.toContain('<script');
      expect(result).not.toContain('onerror');
      expect(result).not.toContain('onload');
    });

    test('should preserve safe HTML', () => {
      const input = '<p>Safe content</p><b>Bold</b>';
      const result = sanitizeHtml(input);
      expect(result).toContain('<p>');
      expect(result).toContain('<b>');
    });
  });

  /**
   * Group 7: JSON Escaping (6 tests)
   */
  describe('7. JSON Escaping - escapeJsonForHtml()', () => {
    test('should escape JSON strings in HTML', () => {
      const obj = { user: '<script>alert(1)</script>' };
      const escaped = escapeJsonForHtml(obj);
      expect(escaped).toContain('&lt;script');
      expect(escaped).not.toContain('<script');
    });

    test('should escape special characters in JSON', () => {
      const obj = { data: 'value"with"quotes' };
      const escaped = escapeJsonForHtml(obj);
      expect(escaped).toContain('&quot;');
    });

    test('should handle arrays', () => {
      const arr = ['<img src=x onerror=alert(1)>'];
      const escaped = escapeJsonForHtml(arr);
      expect(escaped).not.toContain('<img');
    });

    test('should escape nested objects', () => {
      const obj = { nested: { xss: '<script>' } };
      const escaped = escapeJsonForHtml(obj);
      expect(escaped).toContain('&lt;script&gt;');
    });

    test('should handle null values', () => {
      const obj = { value: null };
      const escaped = escapeJsonForHtml(obj);
      expect(escaped).toContain('null');
    });

    test('should handle complex JSON', () => {
      const obj = {
        users: [
          { name: '<img src=x onerror=alert(1)>', role: 'admin' },
          { name: 'normal', role: 'user' },
        ],
      };
      const escaped = escapeJsonForHtml(obj);
      expect(escaped).not.toContain('<img');
    });
  });

  /**
   * Group 8: Email Validation (6 tests)
   */
  describe('8. Email Validation - isValidEmailFormat()', () => {
    test('should validate proper email addresses', () => {
      expect(isValidEmailFormat('user@example.com')).toBe(true);
      expect(isValidEmailFormat('test.user@sub.example.com')).toBe(true);
    });

    test('should reject emails without @', () => {
      expect(isValidEmailFormat('invalid.email')).toBe(false);
    });

    test('should reject emails with spaces', () => {
      expect(isValidEmailFormat('user @example.com')).toBe(false);
    });

    test('should reject CRLF injection attempts', () => {
      expect(isValidEmailFormat('user@example.com\r\nBcc:evil@example.com')).toBe(false);
    });

    test('should reject newline injection', () => {
      expect(isValidEmailFormat('user@example.com\nBcc:evil@example.com')).toBe(false);
    });

    test('should reject non-string inputs', () => {
      expect(isValidEmailFormat(null)).toBe(false);
      expect(isValidEmailFormat(undefined)).toBe(false);
      expect(isValidEmailFormat(123)).toBe(false);
    });
  });

  /**
   * Group 9: Null Byte Removal (5 tests)
   */
  describe('9. Null Byte Removal - removeNullBytes()', () => {
    test('should remove null bytes', () => {
      const input = 'test\x00string';
      expect(removeNullBytes(input)).toBe('teststring');
    });

    test('should handle multiple null bytes', () => {
      const input = 'a\x00b\x00c';
      expect(removeNullBytes(input)).toBe('abc');
    });

    test('should handle null/undefined', () => {
      expect(removeNullBytes(null)).toBe(null);
      expect(removeNullBytes(undefined)).toBe(undefined);
    });

    test('should preserve safe strings', () => {
      const input = 'safe string';
      expect(removeNullBytes(input)).toBe(input);
    });

    test('should prevent null byte injection', () => {
      const injection = 'file.jpg\x00.php';
      expect(removeNullBytes(injection)).toBe('file.jpg.php');
    });
  });

  /**
   * Group 10: API Response Sanitization (8 tests)
   */
  describe('10. API Response Sanitization - sanitizeApiResponse()', () => {
    test('should escape string fields by default', () => {
      const data = { name: '<script>alert(1)</script>' };
      const result = sanitizeApiResponse(data);
      expect(result.name).toContain('&lt;script');
      expect(result.name).not.toContain('<script');
    });

    test('should escape only specified fields', () => {
      const data = { name: '<img>', bio: '<script>' };
      const result = sanitizeApiResponse(data, ['name']);
      expect(result.name).toContain('&lt;');
      expect(result.bio).toContain('<script>'); // Not escaped
    });

    test('should sanitize array of objects', () => {
      const data = [
        { name: '<img>' },
        { name: '<script>' },
      ];
      const result = sanitizeApiResponse(data);
      expect(result[0].name).toContain('&lt;img');
      expect(result[1].name).toContain('&lt;script');
    });

    test('should preserve non-string fields', () => {
      const data = { id: 123, active: true, score: 9.5 };
      const result = sanitizeApiResponse(data);
      expect(result.id).toBe(123);
      expect(result.active).toBe(true);
      expect(result.score).toBe(9.5);
    });

    test('should handle nested objects', () => {
      const data = {
        user: { name: '<img src=x onerror=alert(1)>' },
      };
      const result = sanitizeApiResponse(data);
      expect(result.user.name).toContain('&lt;img');
    });

    test('should handle null values', () => {
      const data = { name: null, bio: '<script>' };
      const result = sanitizeApiResponse(data);
      expect(result.name).toBe(null);
      expect(result.bio).toContain('&lt;script');
    });

    test('should sanitize user profile data', () => {
      const userProfile = {
        id: 1,
        username: 'john_doe',
        bio: '<img src=x onerror="fetch(\'http://evil.com\')">', 
        displayName: 'John <img src=x onerror=alert(1)>',
        avatar: 'https://example.com/avatar.jpg',
      };
      const result = sanitizeApiResponse(userProfile);
      expect(result.bio).toContain('&lt;img');
      expect(result.bio).not.toContain('<img');
      expect(result.displayName).not.toContain('<img');
      expect(result.avatar).toBe('https://example.com/avatar.jpg');
    });

    test('should sanitize product data', () => {
      const product = {
        id: 1,
        title: 'Product <script>alert(1)</script>',
        description: '<img src=x onerror="alert(1)">',
        price: 99.99,
        platform: 'youtube',
      };
      const result = sanitizeApiResponse(product);
      expect(result.title).not.toContain('<script');
      expect(result.description).not.toContain('<img');
      expect(result.price).toBe(99.99);
    });
  });

  /**
   * Group 11: CSP Header Generation (8 tests)
   */
  describe('11. CSP Header Generation - createCspHeader()', () => {
    test('should create valid CSP header', () => {
      const csp = createCspHeader();
      expect(csp).toContain('default-src');
      expect(csp).toContain("'self'");
    });

    test('should include script-src directive', () => {
      const csp = createCspHeader();
      expect(csp).toContain('script-src');
    });

    test('should include style-src directive', () => {
      const csp = createCspHeader();
      expect(csp).toContain('style-src');
    });

    test('should include img-src directive', () => {
      const csp = createCspHeader();
      expect(csp).toContain('img-src');
    });

    test('should prevent object embedding', () => {
      const csp = createCspHeader();
      expect(csp).toContain("object-src 'none'");
    });

    test('should prevent frame embedding', () => {
      const csp = createCspHeader();
      expect(csp).toContain("frame-src 'none'");
    });

    test('should prevent clickjacking', () => {
      const csp = createCspHeader();
      expect(csp).toContain("frame-ancestors 'none'");
    });

    test('should allow custom directives', () => {
      const custom = {
        scriptSrc: ["'self'", 'https://cdn.example.com'],
        connectSrc: ["'self'", 'https://api.example.com'],
      };
      const csp = createCspHeader(custom);
      expect(csp).toContain('https://cdn.example.com');
      expect(csp).toContain('https://api.example.com');
    });
  });

  /**
   * Group 12: Nonce Generation (4 tests)
   */
  describe('12. Nonce Generation', () => {
    test('should generate random nonce', () => {
      const nonce1 = generateCspNonce();
      const nonce2 = generateCspNonce();
      expect(nonce1).not.toBe(nonce2);
    });

    test('should generate base64 nonce', () => {
      const nonce = generateCspNonce();
      expect(/^[A-Za-z0-9+/=]+$/.test(nonce)).toBe(true);
    });

    test('should create CSP header with nonce', () => {
      const nonce = 'test-nonce-value';
      const csp = createCspHeaderWithNonce(nonce);
      expect(csp).toContain(`nonce-${nonce}`);
      expect(csp).toContain("script-src 'self'");
    });

    test('should generate valid random nonce value', () => {
      const nonce = generateCspNonce();
      expect(nonce.length).toBeGreaterThan(0);
      expect(typeof nonce).toBe('string');
    });
  });

  /**
   * Group 13: Response Header Safety (8 tests)
   */
  describe('13. Response Header Safety - isHeaderSafe()', () => {
    test('should reject CRLF injection in header name', () => {
      expect(isHeaderSafe('X-Custom\r\nInjection', 'value')).toBe(false);
      expect(isHeaderSafe('X-Custom\nInjection', 'value')).toBe(false);
    });

    test('should reject CRLF injection in header value', () => {
      expect(isHeaderSafe('X-Custom', 'value\r\nInjection')).toBe(false);
      expect(isHeaderSafe('X-Custom', 'value\nInjection')).toBe(false);
    });

    test('should reject null bytes in header name', () => {
      expect(isHeaderSafe('X-Custom\x00', 'value')).toBe(false);
    });

    test('should reject null bytes in header value', () => {
      expect(isHeaderSafe('X-Custom', 'value\x00injected')).toBe(false);
    });

    test('should allow safe header names', () => {
      expect(isHeaderSafe('X-Custom-Header', 'value')).toBe(true);
      expect(isHeaderSafe('Content-Type', 'application/json')).toBe(true);
    });

    test('should allow safe header values', () => {
      expect(isHeaderSafe('Cache-Control', 'no-cache, no-store')).toBe(true);
    });

    test('should handle edge cases', () => {
      expect(isHeaderSafe('', '')).toBe(true);
      expect(isHeaderSafe('X-Test', '')).toBe(true);
    });

    test('should prevent HTTP response splitting', () => {
      const malicious = 'value\r\nSet-Cookie: admin=true';
      expect(isHeaderSafe('X-Custom', malicious)).toBe(false);
    });
  });

  /**
   * Group 14: XSS Payload Detection (10 tests)
   */
  describe('14. XSS Payload Detection & Prevention', () => {
    test('should detect script tag payload', () => {
      const payload = xssPayloadPatterns.scriptTag;
      expect(escapeHtml(payload)).not.toContain('<script>');
    });

    test('should detect event handler payload', () => {
      const payload = xssPayloadPatterns.eventHandler;
      expect(sanitizeHtml(payload)).not.toContain('onerror');
    });

    test('should detect javascript: protocol', () => {
      const payload = xssPayloadPatterns.javascriptProtocol;
      expect(sanitizeUrl('javascript:alert(1)')).toBe('');
    });

    test('should detect data: URI payload', () => {
      const payload = xssPayloadPatterns.datataURI;
      expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe('');
    });

    test('should detect SVG vector', () => {
      const payload = xssPayloadPatterns.svgVector;
      expect(sanitizeHtml(payload)).not.toContain('onload');
    });

    test('should detect style tag injection', () => {
      const payload = xssPayloadPatterns.styleTag;
      expect(sanitizeHtml(payload)).not.toContain('javascript:');
    });

    test('should detect iframe payload', () => {
      const payload = xssPayloadPatterns.iframeTag;
      expect(sanitizeHtml(payload)).not.toContain('<iframe');
    });

    test('should detect form injection', () => {
      const payload = xssPayloadPatterns.formTag;
      expect(sanitizeUrl('javascript:alert(1)')).toBe('');
    });

    test('should detect null byte injection', () => {
      const payload = xssPayloadPatterns.nullByteInjection;
      expect(removeNullBytes(payload)).not.toContain('\x00');
    });

    test('should detect unicode escape attempts', () => {
      const payload = xssPayloadPatterns.unicodeEscape;
      const sanitized = sanitizeHtml(payload);
      expect(sanitized).not.toContain('onerror');
    });
  });

  /**
   * Group 15: Security Headers Middleware (8 tests)
   */
  describe('15. Security Headers Middleware Integration', () => {
    test('should add CSP header to response', () => {
      const mockRes = {
        setHeader: jest.fn(),
      };
      const mockReq = {};
      const mockNext = jest.fn();

      const middleware = addSecurityHeaders();
      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Security-Policy',
        expect.any(String)
      );
      expect(mockNext).toHaveBeenCalled();
    });

    test('should add X-Frame-Options header', () => {
      const mockRes = {
        setHeader: jest.fn(),
      };
      const mockReq = {};
      const mockNext = jest.fn();

      const middleware = addSecurityHeaders();
      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-Frame-Options',
        'DENY'
      );
    });

    test('should add X-Content-Type-Options header', () => {
      const mockRes = {
        setHeader: jest.fn(),
      };
      const mockReq = {};
      const mockNext = jest.fn();

      const middleware = addSecurityHeaders();
      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-Content-Type-Options',
        'nosniff'
      );
    });

    test('should add HSTS header', () => {
      const mockRes = {
        setHeader: jest.fn(),
      };
      const mockReq = {};
      const mockNext = jest.fn();

      const middleware = addSecurityHeaders();
      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Strict-Transport-Security',
        expect.stringContaining('max-age')
      );
    });

    test('should add Referrer-Policy header', () => {
      const mockRes = {
        setHeader: jest.fn(),
      };
      const mockReq = {};
      const mockNext = jest.fn();

      const middleware = addSecurityHeaders();
      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Referrer-Policy',
        'strict-no-referrer'
      );
    });

    test('should add Permissions-Policy header', () => {
      const mockRes = {
        setHeader: jest.fn(),
      };
      const mockReq = {};
      const mockNext = jest.fn();

      const middleware = addSecurityHeaders();
      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Permissions-Policy',
        expect.any(String)
      );
    });

    test('should add X-XSS-Protection header', () => {
      const mockRes = {
        setHeader: jest.fn(),
      };
      const mockReq = {};
      const mockNext = jest.fn();

      const middleware = addSecurityHeaders();
      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-XSS-Protection',
        '1; mode=block'
      );
    });

    test('should call next middleware', () => {
      const mockRes = {
        setHeader: jest.fn(),
      };
      const mockReq = {};
      const mockNext = jest.fn();

      const middleware = addSecurityHeaders();
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });
});
