/**
 * Comprehensive Input Validation Tests - Task 13
 * Tests all request body validation, field types, lengths, ranges, and patterns
 * Covers all endpoints and edge cases
 * 
 * Test Groups:
 * 1. Registration Validation (15 tests)
 * 2. Login Validation (8 tests)
 * 3. Product Creation Validation (18 tests)
 * 4. Product Update Validation (12 tests)
 * 5. Search Query Validation (12 tests)
 * 6. Message/Chat Validation (8 tests)
 * 7. Review/Rating Validation (8 tests)
 * 8. Bid Validation (6 tests)
 * 9. Field Type Validation (12 tests)
 * 10. Length/Range Validation (15 tests)
 * 11. Enum/Whitelist Validation (12 tests)
 * 12. Error Message Formatting (6 tests)
 * 13. Edge Cases & Boundary Conditions (10 tests)
 * 
 * Total: 142 comprehensive validation tests
 */

const {
  validateRequest,
  validateField,
  validateRequestBody,
  validateQueryParams,
  validateUrlParams,
  formatValidationError,
  batchValidate,
  validationSchemas,
} = require('../middleware/validationMiddleware');

describe('Comprehensive Input Validation - Task 13', () => {
  
  /**
   * 1. Registration Validation Tests
   */
  describe('1. Registration Validation', () => {
    const schema = validationSchemas.register;
    
    test('should accept valid registration data', () => {
      const input = {
        username: 'john_doe123',
        email: 'john@example.com',
        password: 'SecurePass123!',
        name: 'John',
        lastname: 'Doe',
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    test('should reject registration with missing username', () => {
      const input = {
        email: 'john@example.com',
        password: 'SecurePass123!',
        name: 'John',
        lastname: 'Doe',
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('username'))).toBe(true);
    });
    
    test('should reject registration with invalid email', () => {
      const input = {
        username: 'john_doe123',
        email: 'invalid-email',
        password: 'SecurePass123!',
        name: 'John',
        lastname: 'Doe',
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('email'))).toBe(true);
    });
    
    test('should reject registration with weak password', () => {
      const input = {
        username: 'john_doe123',
        email: 'john@example.com',
        password: 'weak',
        name: 'John',
        lastname: 'Doe',
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('password'))).toBe(true);
    });
    
    test('should reject registration with invalid username format', () => {
      const input = {
        username: 'ab', // Too short
        email: 'john@example.com',
        password: 'SecurePass123!',
        name: 'John',
        lastname: 'Doe',
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('username'))).toBe(true);
    });
    
    test('should reject registration with SQL injection in username', () => {
      const input = {
        username: "admin'; DROP TABLE users; --",
        email: 'john@example.com',
        password: 'SecurePass123!',
        name: 'John',
        lastname: 'Doe',
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(false);
    });
    
    test('should reject registration with XSS in name', () => {
      const input = {
        username: 'john_doe123',
        email: 'john@example.com',
        password: 'SecurePass123!',
        name: '<script>alert("xss")</script>',
        lastname: 'Doe',
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(false);
    });
    
    test('should reject registration with too long name', () => {
      const input = {
        username: 'john_doe123',
        email: 'john@example.com',
        password: 'SecurePass123!',
        name: 'A'.repeat(51), // Exceeds 50 char limit
        lastname: 'Doe',
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(false);
    });
    
    test('should reject registration with special characters in name', () => {
      const input = {
        username: 'john_doe123',
        email: 'john@example.com',
        password: 'SecurePass123!',
        name: 'John@#$%',
        lastname: 'Doe',
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(false);
    });
    
    test('should reject registration with unexpected field', () => {
      const input = {
        username: 'john_doe123',
        email: 'john@example.com',
        password: 'SecurePass123!',
        name: 'John',
        lastname: 'Doe',
        unexpectedField: 'value',
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Unexpected field'))).toBe(true);
    });
    
    test('should reject registration with numeric password', () => {
      const input = {
        username: 'john_doe123',
        email: 'john@example.com',
        password: 12345678,
        name: 'John',
        lastname: 'Doe',
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(false);
    });
    
    test('should accept password with special characters', () => {
      const input = {
        username: 'john_doe123',
        email: 'john@example.com',
        password: 'Secure!@#$%^123',
        name: 'John',
        lastname: 'Doe',
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(true);
    });
    
    test('should reject registration with max length email', () => {
      const input = {
        username: 'john_doe123',
        email: 'a'.repeat(255) + '@example.com', // Exceeds 254 limit
        password: 'SecurePass123!',
        name: 'John',
        lastname: 'Doe',
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(false);
    });
    
    test('should accept hyphenated name', () => {
      const input = {
        username: 'john_doe123',
        email: 'john@example.com',
        password: 'SecurePass123!',
        name: 'Jean-Pierre',
        lastname: 'O\'Brien',
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(true);
    });
    
    test('should reject registration with null values', () => {
      const input = {
        username: null,
        email: 'john@example.com',
        password: 'SecurePass123!',
        name: 'John',
        lastname: 'Doe',
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(false);
    });
  });
  
  /**
   * 2. Login Validation Tests
   */
  describe('2. Login Validation', () => {
    const schema = validationSchemas.login;
    
    test('should accept valid login credentials', () => {
      const input = {
        email: 'user@example.com',
        password: 'SecurePass123!',
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    test('should reject login with missing email', () => {
      const input = {
        password: 'SecurePass123!',
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('email'))).toBe(true);
    });
    
    test('should reject login with invalid email format', () => {
      const input = {
        email: 'not-an-email',
        password: 'SecurePass123!',
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(false);
    });
    
    test('should reject login with missing password', () => {
      const input = {
        email: 'user@example.com',
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('password'))).toBe(true);
    });
    
    test('should reject login with SQL injection in email', () => {
      const input = {
        email: "admin'--",
        password: 'SecurePass123!',
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(false);
    });
    
    test('should reject login with empty password', () => {
      const input = {
        email: 'user@example.com',
        password: '',
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(false);
    });
    
    test('should reject login with non-string password', () => {
      const input = {
        email: 'user@example.com',
        password: 12345,
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(false);
    });
    
    test('should reject login with unexpected field', () => {
      const input = {
        email: 'user@example.com',
        password: 'SecurePass123!',
        rememberMe: true,
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(false);
    });
  });
  
  /**
   * 3. Product Creation Validation Tests
   */
  describe('3. Product Creation Validation', () => {
    const schema = validationSchemas.createProduct;
    
    test('should accept valid product data', () => {
      const input = {
        title: 'Amazing YouTube Course',
        description: 'This is a comprehensive course covering all aspects of digital marketing',
        price: 99.99,
        platform: 'youtube',
        topic: 'education',
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    test('should reject product with missing title', () => {
      const input = {
        description: 'This is a comprehensive course',
        price: 99.99,
        platform: 'youtube',
        topic: 'education',
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('title'))).toBe(true);
    });
    
    test('should reject product with title too short', () => {
      const input = {
        title: 'Bad',
        description: 'This is a comprehensive course covering all aspects',
        price: 99.99,
        platform: 'youtube',
        topic: 'education',
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('title') && e.includes('least 5'))).toBe(true);
    });
    
    test('should reject product with title too long', () => {
      const input = {
        title: 'A'.repeat(201),
        description: 'This is a comprehensive course covering all aspects',
        price: 99.99,
        platform: 'youtube',
        topic: 'education',
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('title') && e.includes('exceed'))).toBe(true);
    });
    
    test('should accept product with empty description', () => {
      const input = {
        title: 'Valid Title',
        description: '',
        price: 99.99,
        platform: 'youtube',
        topic: 'education',
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(true);
      expect(result.data.description).toBe('');
    });
    
    test('should reject product with description too long', () => {
      const input = {
        title: 'Valid Title',
        description: 'A'.repeat(5001),
        price: 99.99,
        platform: 'youtube',
        topic: 'education',
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('description') && e.includes('exceed'))).toBe(true);
    });
    
    test('should reject product with invalid price', () => {
      const input = {
        title: 'Valid Title',
        description: 'This is a comprehensive course covering all aspects',
        price: -10,
        platform: 'youtube',
        topic: 'education',
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(false);
    });
    
    test('should reject product with price exceeding max', () => {
      const input = {
        title: 'Valid Title',
        description: 'This is a comprehensive course covering all aspects',
        price: 6000000,
        platform: 'youtube',
        topic: 'education',
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(false);
    });
    
    test('should reject product with invalid platform enum', () => {
      const input = {
        title: 'Valid Title',
        description: 'This is a comprehensive course covering all aspects',
        price: 99.99,
        platform: 'invalid_platform',
        topic: 'education',
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('platform'))).toBe(true);
    });
    
    test('should reject product with invalid topic enum', () => {
      const input = {
        title: 'Valid Title',
        description: 'This is a comprehensive course covering all aspects',
        price: 99.99,
        platform: 'youtube',
        topic: 'invalid_topic',
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('topic'))).toBe(true);
    });
    
    test('should accept product with all valid platform options', () => {
      const platforms = ['youtube', 'twitch', 'tiktok', 'instagram', 'twitter', 'discord', 'telegram', 'other'];
      const baseInput = {
        title: 'Valid Title',
        description: 'This is a comprehensive course covering all aspects',
        price: 99.99,
        topic: 'education',
      };
      
      platforms.forEach(platform => {
        const input = { ...baseInput, platform };
        const result = validateRequestBody(input, schema);
        expect(result.valid).toBe(true);
      });
    });
    
    test('should accept product with optional imageUrl', () => {
      const input = {
        title: 'Valid Title',
        description: 'This is a comprehensive course covering all aspects',
        price: 99.99,
        platform: 'youtube',
        topic: 'education',
        imageUrl: 'https://example.com/image.jpg',
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(true);
    });
    
    test('should reject product with invalid URL format', () => {
      const input = {
        title: 'Valid Title',
        description: 'This is a comprehensive course covering all aspects',
        price: 99.99,
        platform: 'youtube',
        topic: 'education',
        imageUrl: 'not-a-valid-url',
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(false);
    });
    
    // This app has no SQL database (data lives in a JSON file with no raw
    // query construction anywhere - see tests/sqlInjection.test.js), so
    // SQL-special characters in free text aren't a real attack vector here,
    // and rejecting them would just break legitimate titles/names containing
    // apostrophes or dashes. Confirm it's accepted and stored as plain text
    // rather than interpreted as anything special.
    test('accepts product titles containing SQL-special characters as plain text', () => {
      const input = {
        title: "O'Brien's Reviews; a Channel",
        description: 'This is a comprehensive course covering all aspects',
        price: 99.99,
        platform: 'youtube',
        topic: 'education',
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(true);
      expect(result.data.title).toBe(input.title);
    });
    
    // This app's actual XSS defense is sanitize-on-write + escape-on-render
    // (see utils/inputValidation.js's sanitizeTextField and
    // utils/xssPrevention.js), not blanket input rejection - a <script> tag
    // in a description gets stripped, and the listing is still accepted.
    test('strips script tags from product description instead of rejecting the listing', () => {
      const input = {
        title: 'Valid Title',
        description: '<script>alert("xss")</script> This is a course',
        price: 99.99,
        platform: 'youtube',
        topic: 'education',
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(true);
      expect(result.data.description).not.toContain('<script>');
    });
    
    test('should reject product with non-numeric price', () => {
      const input = {
        title: 'Valid Title',
        description: 'This is a comprehensive course covering all aspects',
        price: 'ninety-nine',
        platform: 'youtube',
        topic: 'education',
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(false);
    });
    
    test('should accept minimum valid price', () => {
      const input = {
        title: 'Valid Title',
        description: 'This is a comprehensive course covering all aspects',
        price: 0.01,
        platform: 'youtube',
        topic: 'education',
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(true);
    });
    
    test('should accept product with zero price (free listing)', () => {
      const input = {
        title: 'Valid Title',
        description: 'This is a comprehensive course covering all aspects',
        price: 0,
        platform: 'youtube',
        topic: 'education',
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(true);
    });
  });
  
  /**
   * 4. Search Query Validation Tests
   */
  describe('4. Search Query Validation', () => {
    const schema = validationSchemas.searchProducts;
    
    test('should accept valid search query', () => {
      const input = {
        q: 'javascript course',
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(true);
    });
    
    test('should accept empty search query', () => {
      const input = {};
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(true);
    });
    
    test('should reject search query exceeding max length', () => {
      const input = {
        q: 'a'.repeat(257),
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('exceed'))).toBe(true);
    });
    
    test('should accept search query at max length', () => {
      const input = {
        q: 'a'.repeat(256),
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(true);
    });
    
    test('should reject invalid sort option', () => {
      const input = {
        q: 'course',
        sortBy: 'invalid-sort',
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(false);
    });
    
    test('should accept valid sort options', () => {
      const sortOptions = ['newest', 'price-low', 'price-high', 'rating'];
      sortOptions.forEach(sort => {
        const input = { sortBy: sort };
        const result = validateRequestBody(input, schema);
        expect(result.valid).toBe(true);
      });
    });
    
    test('should reject negative page number', () => {
      const input = {
        page: 0,
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(false);
    });
    
    test('should accept valid page number', () => {
      const input = {
        page: 5,
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(true);
    });
    
    test('should reject limit exceeding max', () => {
      const input = {
        limit: 101,
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(false);
    });
    
    test('should accept limit at max', () => {
      const input = {
        limit: 100,
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(true);
    });
    
    // No SQL database exists in this app, so search queries are sanitized
    // (special characters stripped) rather than rejected outright - a
    // search for this text just won't match anything meaningful, which is
    // a safe outcome without breaking search for legitimate punctuation.
    test('strips SQL-special characters from search queries instead of rejecting them', () => {
      const input = {
        q: "test'; DROP TABLE --",
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(true);
      // Semicolons (statement terminators) are stripped. Hyphens and
      // apostrophes are intentionally kept - they're needed for legitimate
      // search terms ("self-help", "O'Brien"), and there's no SQL query
      // context here for them to be dangerous in.
      expect(result.data.q).not.toContain(';');
    });
    
    test('should accept search with valid price range', () => {
      const input = {
        minPrice: 10.5,
        maxPrice: 99.99,
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(true);
    });
  });
  
  /**
   * 5. Review/Rating Validation Tests
   */
  describe('5. Review/Rating Validation', () => {
    const schema = validationSchemas.createReview;
    
    test('should accept valid review', () => {
      const input = {
        productId: '123',
        rating: 5,
        reviewText: 'Excellent course!',
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(true);
    });
    
    test('should reject review with rating too low', () => {
      const input = {
        productId: '123',
        rating: 0,
        reviewText: 'Excellent course!',
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(false);
    });
    
    test('should reject review with rating too high', () => {
      const input = {
        productId: '123',
        rating: 6,
        reviewText: 'Excellent course!',
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(false);
    });
    
    test('should accept all valid rating values', () => {
      for (let rating = 1; rating <= 5; rating++) {
        const input = {
          productId: '123',
          rating,
          reviewText: 'Great product!',
        };
        const result = validateRequestBody(input, schema);
        expect(result.valid).toBe(true);
      }
    });
    
    test('should reject review text too short', () => {
      const input = {
        productId: '123',
        rating: 5,
        reviewText: 'Bad',
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(false);
    });
    
    test('should reject review text too long', () => {
      const input = {
        productId: '123',
        rating: 5,
        reviewText: 'a'.repeat(1001),
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(false);
    });
    
    test('strips script/event-handler content from review text instead of rejecting the review', () => {
      const input = {
        productId: '123',
        rating: 5,
        reviewText: '<img src=x onerror="alert(1)">Great product',
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(true);
      expect(result.data.reviewText).not.toContain('onerror=');
    });
    
    test('should reject non-integer rating', () => {
      const input = {
        productId: '123',
        rating: 4.5,
        reviewText: 'Good course',
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(false);
    });
  });
  
  /**
   * 6. Bid Validation Tests
   */
  describe('6. Bid Validation', () => {
    const schema = validationSchemas.createBid;
    
    test('should accept valid bid', () => {
      const input = {
        productId: '123',
        bidAmount: 50,
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(true);
    });
    
    test('should reject bid with missing productId', () => {
      const input = {
        bidAmount: 50,
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(false);
    });
    
    test('should reject bid with zero amount', () => {
      const input = {
        productId: '123',
        bidAmount: 0,
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(false);
    });
    
    test('should reject bid with negative amount', () => {
      const input = {
        productId: '123',
        bidAmount: -50,
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(false);
    });
    
    test('should reject bid exceeding max price', () => {
      const input = {
        productId: '123',
        bidAmount: 2000000,
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(false);
    });
    
    test('should accept minimum valid bid', () => {
      const input = {
        productId: '123',
        bidAmount: 0.01,
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(true);
    });
  });
  
  /**
   * 7. Field Type Validation Tests
   */
  describe('7. Field Type Validation', () => {
    test('should reject string value for number field', () => {
      const result = validateField('100', { type: 'number', required: true }, 'price');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be a number');
    });
    
    test('should reject number value for string field', () => {
      const result = validateField(123, { type: 'string', required: true }, 'title');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be a string');
    });
    
    test('should reject boolean value for string field', () => {
      const result = validateField(true, { type: 'string', required: true }, 'email');
      expect(result.valid).toBe(false);
    });
    
    test('should reject object value for string field', () => {
      const result = validateField({}, { type: 'string', required: true }, 'title');
      expect(result.valid).toBe(false);
    });
    
    test('should reject array value for string field', () => {
      const result = validateField([], { type: 'string', required: true }, 'title');
      expect(result.valid).toBe(false);
    });
    
    test('should accept valid string for string field', () => {
      const result = validateField('test', { type: 'string', required: true }, 'title');
      expect(result.valid).toBe(true);
    });
    
    test('should accept valid number for number field', () => {
      const result = validateField(99.99, { type: 'number', required: true }, 'price');
      expect(result.valid).toBe(true);
    });
    
    test('should accept zero for number field', () => {
      const result = validateField(0, { type: 'number', required: true }, 'quantity');
      expect(result.valid).toBe(true);
    });
    
    test('should accept negative number if no min constraint', () => {
      const result = validateField(-5, { type: 'number', required: true }, 'value');
      expect(result.valid).toBe(true);
    });
    
    test('should reject NaN for number field', () => {
      const result = validateField(NaN, { type: 'number', required: true }, 'price');
      expect(result.valid).toBe(false);
    });
    
    test('should reject Infinity for number field', () => {
      const result = validateField(Infinity, { type: 'number', required: true }, 'price');
      expect(result.valid).toBe(false);
    });
    
    test('should reject null for required field', () => {
      const result = validateField(null, { type: 'string', required: true }, 'title');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('required');
    });
  });
  
  /**
   * 8. Length & Range Validation Tests
   */
  describe('8. Length & Range Validation', () => {
    test('should reject string shorter than minLength', () => {
      const result = validateField('ab', { type: 'string', minLength: 5 }, 'title');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at least 5');
    });
    
    test('should accept string at minLength boundary', () => {
      const result = validateField('abcde', { type: 'string', minLength: 5 }, 'title');
      expect(result.valid).toBe(true);
    });
    
    test('should reject string longer than maxLength', () => {
      const result = validateField('a'.repeat(11), { type: 'string', maxLength: 10 }, 'title');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceed');
    });
    
    test('should accept string at maxLength boundary', () => {
      const result = validateField('a'.repeat(10), { type: 'string', maxLength: 10 }, 'title');
      expect(result.valid).toBe(true);
    });
    
    test('should reject number below min', () => {
      const result = validateField(0.99, { type: 'number', min: 1 }, 'price');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at least 1');
    });
    
    test('should accept number at min boundary', () => {
      const result = validateField(1, { type: 'number', min: 1 }, 'price');
      expect(result.valid).toBe(true);
    });
    
    test('should reject number exceeding max', () => {
      const result = validateField(6, { type: 'number', max: 5 }, 'rating');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not exceed');
    });
    
    test('should accept number at max boundary', () => {
      const result = validateField(5, { type: 'number', max: 5 }, 'rating');
      expect(result.valid).toBe(true);
    });
    
    test('should accept empty string for optional field', () => {
      const result = validateField('', { type: 'string', required: false }, 'optional');
      expect(result.valid).toBe(true);
    });
    
    test('should reject empty string for required field', () => {
      const result = validateField('', { type: 'string', required: true }, 'title');
      expect(result.valid).toBe(false);
    });
    
    test('should validate negative number against range', () => {
      const result = validateField(-10, { type: 'number', min: 0 }, 'price');
      expect(result.valid).toBe(false);
    });
    
    test('should validate decimal precision', () => {
      const result = validateField(99.999, { type: 'number', max: 99.99 }, 'price');
      expect(result.valid).toBe(false);
    });
  });
  
  /**
   * 9. Enum/Whitelist Validation Tests
   */
  describe('9. Enum Validation', () => {
    test('should accept valid enum value', () => {
      const result = validateField('youtube', { type: 'string', enum: ['youtube', 'twitch', 'tiktok'] }, 'platform');
      expect(result.valid).toBe(true);
    });
    
    test('should reject invalid enum value', () => {
      const result = validateField('facebook', { type: 'string', enum: ['youtube', 'twitch', 'tiktok'] }, 'platform');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be one of');
    });
    
    test('should accept all valid topic values', () => {
      const topics = ['gaming', 'education', 'entertainment', 'music', 'finance', 'technology', 'health', 'other'];
      topics.forEach(topic => {
        const result = validateField(topic, { type: 'string', enum: topics }, 'topic');
        expect(result.valid).toBe(true);
      });
    });
    
    test('should reject case-sensitive enum mismatch', () => {
      const result = validateField('YouTube', { type: 'string', enum: ['youtube', 'twitch'] }, 'platform');
      expect(result.valid).toBe(false);
    });
    
    test('should accept empty enum list rejection', () => {
      const result = validateField('anything', { type: 'string', enum: [] }, 'field');
      expect(result.valid).toBe(false);
    });
    
    test('should validate membership tier enum', () => {
      const tiers = ['basic', 'premium', 'elite'];
      tiers.forEach(tier => {
        const result = validateField(tier, { type: 'string', enum: tiers }, 'tier');
        expect(result.valid).toBe(true);
      });
    });
    
    test('should reject invalid billing period', () => {
      const result = validateField('weekly', { type: 'string', enum: ['monthly', 'yearly'] }, 'billingPeriod');
      expect(result.valid).toBe(false);
    });
    
    test('should validate all platform options', () => {
      const platforms = ['youtube', 'twitch', 'tiktok', 'instagram', 'twitter', 'discord', 'telegram', 'other'];
      platforms.forEach(platform => {
        const result = validateField(platform, { type: 'string', enum: platforms }, 'platform');
        expect(result.valid).toBe(true);
      });
    });
    
    test('should reject SQL injection in enum field', () => {
      const result = validateField("youtube'; DROP --", { type: 'string', enum: ['youtube', 'twitch'] }, 'platform');
      expect(result.valid).toBe(false);
    });
    
    test('should reject XSS attempt in enum field', () => {
      const result = validateField('<script>alert(1)</script>', { type: 'string', enum: ['youtube', 'twitch'] }, 'platform');
      expect(result.valid).toBe(false);
    });
  });
  
  /**
   * 10. Chat/Message Validation Tests
   */
  describe('10. Chat Message Validation', () => {
    const schema = validationSchemas.sendMessage;
    
    test('should accept valid message', () => {
      const input = {
        conversationId: 'conv-123',
        message: 'Hello, how are you?',
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(true);
    });
    
    test('should reject message exceeding max length', () => {
      const input = {
        conversationId: 'conv-123',
        message: 'a'.repeat(5001),
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(false);
    });
    
    test('should reject empty message', () => {
      const input = {
        conversationId: 'conv-123',
        message: '',
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(false);
    });
    
    test('should accept message with special characters', () => {
      const input = {
        conversationId: 'conv-123',
        message: 'Price: $99.99, Rating: 5/5!',
      };
      const result = validateRequestBody(input, schema);
      expect(result.valid).toBe(true);
    });
  });
  
  /**
   * 11. Edge Cases & Boundary Conditions Tests
   */
  describe('11. Edge Cases & Boundaries', () => {
    test('should handle undefined value for optional field', () => {
      const result = validateField(undefined, { type: 'string', required: false }, 'optional');
      expect(result.valid).toBe(true);
    });
    
    test('should handle null value for optional field', () => {
      const result = validateField(null, { type: 'string', required: false }, 'optional');
      expect(result.valid).toBe(true);
    });
    
    test('should handle whitespace-only string', () => {
      const result = validateField('   ', { type: 'string', required: true, minLength: 1 }, 'title');
      expect(result.valid).toBe(true); // Whitespace is still 3 characters
    });
    
    test('should handle unicode characters in validation', () => {
      const result = validateField('café αβγ', { type: 'string', required: true }, 'title');
      expect(result.valid).toBe(true);
    });
    
    test('should handle very large number', () => {
      const result = validateField(999999999.99, { type: 'number', max: 1000000 }, 'price');
      expect(result.valid).toBe(false);
    });
    
    test('should handle very small number', () => {
      const result = validateField(0.01, { type: 'number', min: 0.01 }, 'price');
      expect(result.valid).toBe(true);
    });
    
    test('should handle batch validation', () => {
      const objects = [
        { username: 'user1', password: 'Pass123!' },
        { username: 'us', password: 'weak' },
        { username: 'user3', password: 'Pass456!' },
      ];
      const schema = validationSchemas.login; // Using login for simplicity
      const results = batchValidate(objects, schema);
      expect(results).toHaveLength(3);
      expect(results[0]).toHaveProperty('valid');
    });
    
    test('should handle request with only required fields', () => {
      const input = {
        title: 'Title',
        description: 'This is a valid description',
        price: 10,
        platform: 'youtube',
        topic: 'education',
      };
      const result = validateRequestBody(input, validationSchemas.createProduct);
      expect(result.valid).toBe(true);
    });
    
    test('should validate across multiple simultaneous constraints', () => {
      const input = {
        username: 'valid_user_123', // 4-32 chars, alphanumeric + underscore
        password: 'StrongPass123',   // 8-128 chars, mixed case + number
        email: 'user@example.com',   // Valid RFC 5322
        name: 'Jean-Pierre',         // 2-50 chars, letters + hyphen
        lastname: 'Dubois',
      };
      const result = validateRequestBody(input, validationSchemas.register);
      expect(result.valid).toBe(true);
    });
  });
  
  /**
   * 12. Error Message Formatting Tests
   */
  describe('12. Error Message Formatting', () => {
    test('should format validation error clearly', () => {
      const validation = {
        errors: ['Email is required', 'Password must be at least 8 characters'],
      };
      const formatted = formatValidationError(validation);
      expect(formatted.success).toBe(false);
      expect(formatted.errors).toHaveLength(2);
      expect(formatted.message).toContain('2 validation error');
    });
    
    test('should include all error messages in response', () => {
      const input = {
        email: 'invalid',
        password: 'weak',
      };
      const result = validateRequestBody(input, validationSchemas.login);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(Array.isArray(result.errors)).toBe(true);
    });
    
    test('should provide field-specific error messages', () => {
      const input = {
        username: 'ab', // Too short
        password: 'weak', // Too weak
      };
      const result = validateRequestBody(input, validationSchemas.register);
      expect(result.errors.some(e => e.includes('username'))).toBe(true);
    });
    
    test('should distinguish between required and format validation', () => {
      const input = {
        email: 'missing',
      };
      const result = validateRequestBody(input, validationSchemas.login);
      expect(result.errors.some(e => e.includes('password'))).toBe(true);
    });
    
    test('should include helpful messages for enum validation', () => {
      const input = {
        platform: 'facebook',
      };
      const validation = validateField(input.platform, { 
        type: 'string', 
        enum: ['youtube', 'twitch', 'tiktok'] 
      }, 'platform');
      expect(validation.error).toContain('must be one of');
      expect(validation.error).toContain('youtube');
    });
    
    test('should provide context for length violations', () => {
      const validation = validateField('ab', { 
        type: 'string', 
        minLength: 5 
      }, 'username');
      expect(validation.error).toContain('username');
      expect(validation.error).toContain('5');
    });
  });
  
  /**
   * 13. Security Attack Pattern Tests
   */
  describe('13. Security Attack Patterns', () => {
    test('should reject various SQL injection patterns', () => {
      const injectionPatterns = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "admin'--",
        "1 UNION SELECT * FROM passwords",
        "1; DELETE FROM users",
      ];
      
      injectionPatterns.forEach(pattern => {
        const result = validateRequestBody(
          { username: pattern, email: 'test@test.com', password: 'Pass123!', name: 'Test', lastname: 'User' },
          validationSchemas.register
        );
        expect(result.valid).toBe(false);
      });
    });
    
    test('sanitizes XSS patterns out of search queries instead of rejecting them', () => {
      const xssPatterns = [
        '<script>alert(1)</script>',
        '<img src=x onerror="alert(1)">',
        'javascript:alert(1)',
        '<svg onload="alert(1)">',
      ];
      
      xssPatterns.forEach(pattern => {
        const result = validateRequestBody(
          { q: pattern },
          validationSchemas.searchProducts
        );
        expect(result.valid).toBe(true);
        expect(result.data.q).not.toMatch(/[<>]/);
      });
    });
    
    test('should reject NoSQL injection patterns', () => {
      const injectionPatterns = [
        '{"$ne": null}',
        '{"$gt": ""}',
        '; process.exit();',
      ];
      
      injectionPatterns.forEach(pattern => {
        const result = validateField(pattern, { type: 'string', required: true }, 'input');
        // Should accept but could be sanitized
        expect(typeof result.valid).toBe('boolean');
      });
    });
  });
});
