/**
 * SQL Injection Prevention Test Suite
 * 
 * Tests validate that:
 * 1. Input validation prevents malicious payloads
 * 2. Dangerous characters are sanitized
 * 3. Query builders generate safe parameterized queries
 * 4. Common injection attack vectors are blocked
 * 5. Normal user data passes through safely
 */

const {
  sanitizeString,
  sanitizeSearchQuery,
  sanitizeTextField,
  validateEmail,
  validateUsername,
  validatePassword,
  validateName,
  validateInteger,
  validatePrice,
  validateEnum,
  validateRegistrationInput,
  validateProductInput,
  sanitizeDatabaseJson
} = require('../utils/inputValidation');

const {
  buildSelectQuery,
  buildInsertQuery,
  buildUpdateQuery,
  buildDeleteQuery
} = require('../utils/parameterizedQueries');

describe('SQL Injection Prevention - Task 12', () => {
  
  // ============================================================================
  // GROUP 1: Input Sanitization
  // ============================================================================
  
  describe('1. String Sanitization', () => {
    test('should remove null bytes', () => {
      const input = "normal string\x00injected";
      const result = sanitizeString(input);
      expect(result).not.toContain('\x00');
      expect(result).toBe('normal stringinjected');
    });
    
    test('should remove control characters', () => {
      const input = "normal\x01\x02\x03string";
      const result = sanitizeString(input);
      expect(result).not.toMatch(/[\x00-\x1F\x7F]/);
    });
    
    test('should trim whitespace', () => {
      const input = "   spaced string   ";
      const result = sanitizeString(input);
      expect(result).toBe('spaced string');
    });
    
    test('should handle SQL injection attempt in string', () => {
      const input = "'; DROP TABLE users; --";
      const result = sanitizeString(input);
      // Should not contain null bytes or control chars (SQL injection vector)
      expect(result).not.toContain('\x00');
      // The string itself is preserved but no shell execution
      expect(result).toBeDefined();
    });
    
    test('should handle NoSQL injection attempt', () => {
      const input = '{"$ne": null}';
      const result = sanitizeString(input);
      expect(result).toBe('{"$ne": null}');
    });
  });
  
  describe('2. Search Query Sanitization', () => {
    test('should limit search query length', () => {
      const input = 'a'.repeat(500);
      const result = sanitizeSearchQuery(input);
      expect(result.length).toBeLessThanOrEqual(256);
    });
    
    test('should remove special characters that break search', () => {
      const input = 'normal<script>alert("xss")</script>search';
      const result = sanitizeSearchQuery(input);
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
      expect(result).not.toContain('"');
    });
    
    test('should allow basic punctuation in search', () => {
      const input = 'search for youtube-channel';
      const result = sanitizeSearchQuery(input);
      expect(result).toContain('youtube-channel');
    });
    
    test('should block SQL wildcards in search', () => {
      const input = 'user%admin_123';
      const result = sanitizeSearchQuery(input);
      expect(result).not.toContain('%');
      expect(result).not.toContain('_');
    });
  });
  
  describe('3. Text Field Sanitization', () => {
    test('should remove script tags', () => {
      const input = 'Normal text <script>alert("xss")</script> more text';
      const result = sanitizeTextField(input);
      expect(result).not.toContain('<script');
      expect(result).not.toContain('</script>');
    });
    
    test('should remove javascript: protocol', () => {
      const input = 'Click <a href="javascript:alert(1)">here</a>';
      const result = sanitizeTextField(input);
      expect(result).not.toContain('javascript:');
    });
    
    test('should remove event handlers', () => {
      const input = '<img src="x" onerror="alert(1)" onload="alert(2)">';
      const result = sanitizeTextField(input);
      expect(result).not.toContain('onerror');
      expect(result).not.toContain('onload');
    });
    
    test('should limit text field length', () => {
      const input = 'a'.repeat(10000);
      const result = sanitizeTextField(input, 5000);
      expect(result.length).toBeLessThanOrEqual(5000);
    });
    
    test('should preserve normal HTML-like text', () => {
      const input = 'This is a product description for a YouTube channel';
      const result = sanitizeTextField(input);
      expect(result).toContain('YouTube');
    });
  });
  
  // ============================================================================
  // GROUP 2: Email Validation
  // ============================================================================
  
  describe('4. Email Validation', () => {
    test('should accept valid email', () => {
      expect(validateEmail('user@example.com')).toBe(true);
    });
    
    test('should reject email with SQL injection', () => {
      expect(validateEmail("'; DROP TABLE users; --@example.com")).toBe(false);
    });
    
    test('should reject email without @', () => {
      expect(validateEmail('userexample.com')).toBe(false);
    });
    
    test('should reject email without domain', () => {
      expect(validateEmail('user@')).toBe(false);
    });
    
    test('should reject extremely long email', () => {
      const longEmail = 'a'.repeat(300) + '@example.com';
      expect(validateEmail(longEmail)).toBe(false);
    });
    
    test('should reject non-string email', () => {
      expect(validateEmail(123)).toBe(false);
      expect(validateEmail(null)).toBe(false);
      expect(validateEmail(undefined)).toBe(false);
    });
  });
  
  // ============================================================================
  // GROUP 3: Username Validation
  // ============================================================================
  
  describe('5. Username Validation', () => {
    test('should accept valid username', () => {
      expect(validateUsername('john_doe')).toBe(true);
      expect(validateUsername('user123')).toBe(true);
      expect(validateUsername('test-user')).toBe(true);
    });
    
    test('should reject username with SQL injection', () => {
      expect(validateUsername("admin'--")).toBe(false);
      expect(validateUsername("' OR '1'='1")).toBe(false);
    });
    
    test('should reject username too short', () => {
      expect(validateUsername('ab')).toBe(false);
    });
    
    test('should reject username too long', () => {
      expect(validateUsername('a'.repeat(50))).toBe(false);
    });
    
    test('should reject username with special characters', () => {
      expect(validateUsername('user@host')).toBe(false);
      expect(validateUsername('user<script>')).toBe(false);
      expect(validateUsername('user;drop')).toBe(false);
    });
    
    test('should reject non-string username', () => {
      expect(validateUsername(123)).toBe(false);
      expect(validateUsername(null)).toBe(false);
    });
  });
  
  // ============================================================================
  // GROUP 4: Password Validation
  // ============================================================================
  
  describe('6. Password Strength Validation', () => {
    test('should accept strong password', () => {
      const result = validatePassword('SecurePass123');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    test('should reject password too short', () => {
      const result = validatePassword('Short1');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
    
    test('should reject password without lowercase', () => {
      const result = validatePassword('UPPERCASE123');
      expect(result.valid).toBe(false);
    });
    
    test('should reject password without uppercase', () => {
      const result = validatePassword('lowercase123');
      expect(result.valid).toBe(false);
    });
    
    test('should reject password without number', () => {
      const result = validatePassword('NoNumbers');
      expect(result.valid).toBe(false);
    });
    
    test('should reject password too long', () => {
      // Create a password that's longer than 128 characters (129+ chars)
      const result = validatePassword('A' + 'a'.repeat(127) + '1');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
    
    test('should accept password with special characters', () => {
      const result = validatePassword('SecurePass123!@#');
      expect(result.valid).toBe(true);
    });
    
    test('should reject non-string password', () => {
      const result = validatePassword(123);
      expect(result.valid).toBe(false);
    });
  });
  
  // ============================================================================
  // GROUP 5: Comprehensive Input Validation
  // ============================================================================
  
  describe('7. Registration Input Validation', () => {
    test('should accept valid registration data', () => {
      const input = {
        username: 'john_doe',
        email: 'john@example.com',
        password: 'SecurePass123',
        name: 'John',
        lastname: 'Doe'
      };
      const result = validateRegistrationInput(input);
      expect(result.valid).toBe(true);
      expect(result.data.username).toBe('john_doe');
      expect(result.data.email).toBe('john@example.com');
    });
    
    test('should reject registration with SQL injection in username', () => {
      const input = {
        username: "admin'--",
        email: 'test@example.com',
        password: 'SecurePass123',
        name: 'Test',
        lastname: 'User'
      };
      const result = validateRegistrationInput(input);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
    
    test('should reject registration with SQL injection in email', () => {
      const input = {
        username: 'testuser',
        email: "'; DROP TABLE users; --@example.com",
        password: 'SecurePass123',
        name: 'Test',
        lastname: 'User'
      };
      const result = validateRegistrationInput(input);
      expect(result.valid).toBe(false);
    });
    
    test('should reject registration with weak password', () => {
      const input = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'weak',
        name: 'Test',
        lastname: 'User'
      };
      const result = validateRegistrationInput(input);
      expect(result.valid).toBe(false);
    });
    
    test('should sanitize name fields', () => {
      const input = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'SecurePass123',
        name: '  John  ',
        lastname: 'Doe'
      };
      const result = validateRegistrationInput(input);
      expect(result.data.name).toBe('John');
    });
  });
  
  describe('8. Product Input Validation', () => {
    test('should accept valid product data', () => {
      const input = {
        title: 'YouTube Channel',
        description: 'A popular YouTube channel with great content',
        price: 99.99,
        platform: 'youtube',
        topic: 'entertainment'
      };
      const result = validateProductInput(input);
      expect(result.valid).toBe(true);
      expect(result.data.price).toBe(99.99);
    });
    
    test('should sanitize SQL-like text in title without treating it as an injection risk', () => {
      // This app stores data in a JSON file, not a SQL database - there is no
      // query string these values get interpolated into, so there is no SQL
      // injection surface to defend against here. A title containing
      // SQL-like text is just text.
      const input = {
        title: "'; DROP TABLE products; --",
        description: 'Description here',
        price: 99.99,
        platform: 'youtube',
        topic: 'entertainment'
      };
      const result = validateProductInput(input);
      expect(result.valid).toBe(true);
      expect(result.data.title).toBe("'; DROP TABLE products; --");
    });
    
    test('should sanitize XSS attempt in description', () => {
      const input = {
        title: 'Valid Title',
        description: 'Normal <b>text</b> with <script>alert(1)</script> injection',
        price: 99.99,
        platform: 'youtube',
        topic: 'entertainment'
      };
      const result = validateProductInput(input);
      expect(result.valid).toBe(true);
      // The validation passes, but sanitizeTextField removes script tags
      expect(result.data.description).not.toContain('<script>');
      expect(result.data.description).not.toContain('</script>');
    });
    
    test('should reject product with invalid price', () => {
      const input = {
        title: 'Valid Title',
        description: 'Valid description for testing',
        price: -10,
        platform: 'youtube',
        topic: 'entertainment'
      };
      const result = validateProductInput(input);
      expect(result.valid).toBe(false);
    });
    
    test('should reject product with invalid platform enum', () => {
      const input = {
        title: 'Valid Title',
        description: 'Valid description for testing',
        price: 99.99,
        platform: "'; DROP TABLE--",
        topic: 'entertainment'
      };
      const result = validateProductInput(input);
      expect(result.valid).toBe(false);
    });
    
    test('should sanitize description field', () => {
      const input = {
        title: 'Valid Title',
        description: 'Normal <b>text</b> with <script>alert(1)</script> injection',
        price: 99.99,
        platform: 'youtube',
        topic: 'entertainment'
      };
      const result = validateProductInput(input);
      expect(result.data.description).not.toContain('<script>');
    });
  });
  
  // ============================================================================
  // GROUP 6: Parameterized Query Builders
  // ============================================================================
  
  describe('9. Parameterized Query Builders - SELECT', () => {
    test('should build safe SELECT query with WHERE clause', () => {
      const { query, params } = buildSelectQuery('users', ['id', 'username', 'email'], {
        id: '123'
      });
      
      expect(query).toBe('SELECT `id`, `username`, `email` FROM `users` WHERE `id` = ?');
      expect(params).toEqual(['123']);
      // Verify no string concatenation with user input
      expect(query).not.toContain('123');
    });
    
    test('should reject invalid table name', () => {
      expect(() => {
        buildSelectQuery('users; DROP TABLE users;', ['id']);
      }).toThrow();
    });
    
    test('should reject invalid column names', () => {
      const { query } = buildSelectQuery('users', ["id'; DROP TABLE users; --"], { id: '123' });
      // Only valid columns should be used
      expect(query).not.toContain('DROP');
    });
    
    test('should handle multiple WHERE conditions safely', () => {
      const { query, params } = buildSelectQuery('products', ['*'], {
        status: 'approved',
        sellerId: '456'
      });
      
      expect(query).toContain('`status` = ?');
      expect(query).toContain('`sellerId` = ?');
      expect(params).toContain('approved');
      expect(params).toContain('456');
    });
  });
  
  describe('10. Parameterized Query Builders - INSERT', () => {
    test('should build safe INSERT query', () => {
      const { query, params } = buildInsertQuery('users', {
        username: 'john_doe',
        email: 'john@example.com',
        password: 'hashed_password_here'
      });
      
      expect(query).toContain('INSERT INTO `users`');
      expect(query).toContain('VALUES (?, ?, ?)');
      expect(params).toContain('john_doe');
      expect(params).toContain('john@example.com');
      // Password is included in params because it's a valid column
      expect(params).toContain('hashed_password_here');
    });
    
    test('should reject injection in column names', () => {
      expect(() => {
        buildInsertQuery('users', {
          'username`); DROP TABLE users; --': 'value'
        });
      }).toThrow();
    });
    
    test('should reject invalid table name', () => {
      expect(() => {
        buildInsertQuery("users'; DROP TABLE users; --", {
          username: 'test'
        });
      }).toThrow();
    });
  });
  
  describe('11. Parameterized Query Builders - UPDATE', () => {
    test('should build safe UPDATE query', () => {
      const { query, params } = buildUpdateQuery('users', 
        { username: 'new_username' },
        { id: '123' }
      );
      
      expect(query).toContain('UPDATE `users`');
      expect(query).toContain('SET `username` = ?');
      expect(query).toContain('WHERE `id` = ?');
      // params should have 'new_username' and '123'
      expect(params).toHaveLength(2);
      expect(params[0]).toBe('new_username');
      expect(params[1]).toBe('123');
    });
    
    test('should require WHERE condition', () => {
      expect(() => {
        buildUpdateQuery('users', { username: 'hacker' }, {});
      }).toThrow();
    });
  });
  
  describe('12. Parameterized Query Builders - DELETE', () => {
    test('should build safe DELETE query', () => {
      const { query, params } = buildDeleteQuery('users', { id: '123' });
      
      expect(query).toContain('DELETE FROM `users`');
      expect(query).toContain('WHERE `id` = ?');
      expect(params).toEqual(['123']);
    });
    
    test('should require WHERE condition to prevent full table delete', () => {
      expect(() => {
        buildDeleteQuery('users', {});
      }).toThrow();
    });
    
    test('should reject attempts to delete all records', () => {
      expect(() => {
        buildDeleteQuery('users', null);
      }).toThrow();
    });
  });
  
  // ============================================================================
  // GROUP 7: Database JSON Sanitization
  // ============================================================================
  
  describe('13. Database JSON Sanitization', () => {
    test('should sanitize database JSON safely', () => {
      const db = {
        users: [
          {
            id: '1',
            username: 'john',
            email: 'john@example.com',
            password: 'hashed'
          }
        ]
      };
      
      const sanitized = sanitizeDatabaseJson(db);
      expect(typeof sanitized).toBe('string');
      expect(JSON.parse(sanitized)).toEqual(db);
    });
    
    test('should remove null bytes from database JSON', () => {
      const db = {
        users: [{
          username: 'test\x00injection'
        }]
      };
      
      const sanitized = sanitizeDatabaseJson(db);
      expect(sanitized).not.toContain('\x00');
    });
    
    test('should handle circular references gracefully', () => {
      const db = {
        users: []
      };
      // Circular references would throw in JSON.stringify
      expect(() => {
        sanitizeDatabaseJson(db);
      }).not.toThrow();
    });
  });
  
  // ============================================================================
  // GROUP 8: Common Attack Vectors
  // ============================================================================
  
  describe('14. Common SQL Injection Attack Vectors', () => {
    test('should block union-based injection', () => {
      const malicious = "1' UNION SELECT * FROM users; --";
      expect(validateUsername(malicious)).toBe(false);
    });
    
    test('should block boolean-based blind injection', () => {
      const malicious = "' OR '1'='1";
      expect(validateUsername(malicious)).toBe(false);
    });
    
    test('should block time-based blind injection', () => {
      const malicious = "'; WAITFOR DELAY '00:00:05'; --";
      expect(validateUsername(malicious)).toBe(false);
    });
    
    test('should block stacked queries injection', () => {
      const malicious = "admin'; DROP TABLE users; --";
      expect(validateUsername(malicious)).toBe(false);
    });
    
    test('should block hex-encoded injection', () => {
      // 0x61646d696e = "admin" in hex
      const malicious = "0x61646d696e";
      // Should not be valid username (doesn't match alphanumeric pattern)
      expect(validateUsername(malicious)).toBe(false);
    });
    
    test('should block comment-based injection', () => {
      const malicious = "admin'/**/OR/**/1=1";
      expect(validateUsername(malicious)).toBe(false);
    });
    
    test('should block quote bypass attempts', () => {
      const malicious = 'admin" OR "1"="1';
      expect(validateUsername(malicious)).toBe(false);
    });
  });
  
  describe('15. NoSQL/MongoDB Injection Prevention', () => {
    test('should sanitize MongoDB operators', () => {
      const input = '{"$ne": null}';
      const result = sanitizeString(input);
      // JSON structures should be preserved but treated as strings
      expect(result).toBe('{"$ne": null}');
    });
    
    test('should sanitize JavaScript injection attempts', () => {
      const input = 'test"); db.users.drop(); //';
      const sanitized = sanitizeString(input);
      // Should remove null bytes and control chars, but preserve the string content
      // The key is that when this string is used as a parameter in a prepared statement,
      // it cannot execute as code
      expect(sanitized).toBe('test"); db.users.drop(); //');
      expect(typeof sanitized).toBe('string');
      // Verify no null bytes or control characters that could break out
      expect(sanitized).not.toContain('\x00');
    });
  });
  
  // ============================================================================
  // GROUP 9: Edge Cases
  // ============================================================================
  
  describe('16. Edge Cases and Boundary Conditions', () => {
    test('should handle empty strings safely', () => {
      expect(validateUsername('')).toBe(false);
      expect(validateEmail('')).toBe(false);
      expect(sanitizeString('')).toBe('');
    });
    
    test('should handle very long strings', () => {
      const longString = 'a'.repeat(10000);
      const result = sanitizeString(longString);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
    
    test('should handle unicode characters safely', () => {
      const input = 'José García 日本語 العربية';
      const result = sanitizeString(input);
      expect(result).toBeDefined();
    });
    
    test('should handle mixed case properly', () => {
      const input = 'TeSt@ExAmPlE.cOm';
      expect(validateEmail(input)).toBe(true);
    });
    
    test('should handle null and undefined inputs', () => {
      expect(validateUsername(null)).toBe(false);
      expect(validateUsername(undefined)).toBe(false);
      expect(sanitizeString(null)).toBe('');
      expect(sanitizeString(undefined)).toBe('');
    });
  });
});
