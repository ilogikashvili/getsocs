/**
 * Input Validation and Sanitization Utility
 * Prevents SQL Injection, NoSQL Injection, XSS, and other injection attacks
 * 
 * Purpose: Validate and sanitize all user inputs before database operations
 * or response to prevent injection vulnerabilities
 */

/**
 * Remove potentially dangerous characters that could be used in injection attacks
 * This is for defense-in-depth; parameterized queries/proper escaping is primary defense
 * @param {string} input - The input string to sanitize
 * @returns {string} - Sanitized string
 */
function sanitizeString(input) {
  if (typeof input !== 'string') return '';
  
  // Remove null bytes (used in some injection attacks)
  let result = input.replace(/\0/g, '');
  
  // Remove control characters
  result = result.replace(/[\x00-\x1F\x7F]/g, '');
  
  // Trim whitespace
  result = result.trim();
  
  return result;
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} - True if valid email format
 */
function validateEmail(email) {
  if (typeof email !== 'string') return false;
  const sanitized = sanitizeString(email);
  // Standard email regex pattern (RFC 5322 simplified)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(sanitized) && sanitized.length <= 254;
}

/**
 * Validate username format
 * @param {string} username - Username to validate
 * @returns {boolean} - True if valid username
 */
function validateUsername(username) {
  if (typeof username !== 'string') return false;
  const sanitized = sanitizeString(username);
  
  // Reject SQL hex patterns (0x prefix used in SQL injection)
  if (/^0x[0-9a-fA-F]+$/i.test(sanitized)) return false;
  
  // Must be 4-32 alphanumeric characters (plus underscore, hyphen, dot)
  // No special characters that could break out of SQL contexts
  const usernameRegex = /^[a-zA-Z0-9_.-]{4,32}$/;
  return usernameRegex.test(sanitized);
}

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {object} - { valid: boolean, errors: array }
 */
function validatePassword(password) {
  if (typeof password !== 'string') {
    return { valid: false, errors: ['Password must be a string'] };
  }
  
  const errors = [];
  
  // Check length FIRST to prevent buffer overflow attacks
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  } else if (password.length > 128) {
    errors.push('Password must not exceed 128 characters');
    return { valid: false, errors }; // Return early if too long
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  // Don't require special characters (some users find it restrictive)
  // but allow them
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate person name (first/last name)
 * @param {string} name - Name to validate
 * @returns {boolean} - True if valid name
 */
function validateName(name) {
  if (typeof name !== 'string') return false;
  const sanitized = sanitizeString(name);
  
  // 2-50 characters, letters and common punctuation only
  const nameRegex = /^[a-zA-Z\s'-]{2,50}$/;
  return nameRegex.test(sanitized);
}

/**
 * Validate integer value with optional min/max bounds
 * @param {any} value - Value to validate
 * @param {object} options - { min?: number, max?: number }
 * @returns {boolean} - True if valid integer
 */
function validateInteger(value, options = {}) {
  const num = Number(value);
  
  if (!Number.isInteger(num)) return false;
  if (typeof options.min === 'number' && num < options.min) return false;
  if (typeof options.max === 'number' && num > options.max) return false;
  
  return true;
}

/**
 * Validate decimal/float number
 * @param {any} value - Value to validate
 * @param {object} options - { min?: number, max?: number, decimals?: number }
 * @returns {boolean} - True if valid number
 */
function validateDecimal(value, options = {}) {
  const num = Number(value);
  
  if (isNaN(num)) return false;
  if (typeof options.min === 'number' && num < options.min) return false;
  if (typeof options.max === 'number' && num > options.max) return false;
  
  if (typeof options.decimals === 'number') {
    const decimalPlaces = (num.toString().split('.')[1] || '').length;
    if (decimalPlaces > options.decimals) return false;
  }
  
  return true;
}

/**
 * Validate price (decimal, non-negative, max 2 decimal places)
 * @param {any} price - Price to validate
 * @returns {boolean} - True if valid price
 */
function validatePrice(price) {
  return validateDecimal(price, { min: 0, max: 5000000, decimals: 2 });
}

// Bids are a separate concept from listing prices - giving them their own
// validator keeps a future change to the product price range (min/max
// above) from silently changing what counts as a valid bid too. This has
// been lost twice now in prior rounds where bidAmount was pointed back at
// validatePrice directly; restored here with the bounds this codebase has
// always used for bids. If this happens a third time, consider adding a
// lint rule or test that fails whenever bidAmount's validator === validatePrice.
function validateBidAmount(amount) {
  return validateDecimal(amount, { min: 0.01, max: 1000000, decimals: 2 });
}

/**
 * Validate string length
 * @param {string} value - String to validate
 * @param {number} minLength - Minimum allowed length
 * @param {number} maxLength - Maximum allowed length
 * @returns {boolean} - True if valid length
 */
function validateStringLength(value, minLength, maxLength) {
  if (typeof value !== 'string') return false;
  const sanitized = sanitizeString(value);
  return sanitized.length >= minLength && sanitized.length <= maxLength;
}

/**
 * Validate array of enums
 * @param {string} value - Value to validate
 * @param {array} allowedValues - Allowed enum values
 * @returns {boolean} - True if value is in allowed list
 */
function validateEnum(value, allowedValues) {
  if (!Array.isArray(allowedValues)) return false;
  if (typeof value !== 'string') return false;
  return allowedValues.includes(value.trim().toLowerCase());
}

/**
 * Validate boolean value
 * @param {any} value - Value to validate
 * @returns {boolean} - True if value can be converted to boolean
 */
function validateBoolean(value) {
  return value === true || value === false || 
         value === 'true' || value === 'false' || 
         value === '1' || value === '0' || 
         value === 'yes' || value === 'no';
}

/**
 * Sanitize and validate search query
 * @param {string} query - Search query to sanitize
 * @returns {string} - Sanitized query (max 256 chars)
 */
function sanitizeSearchQuery(query) {
  if (typeof query !== 'string') return '';
  
  let sanitized = sanitizeString(query);
  
  // Remove characters that have special meaning in search contexts
  // Allow letters, numbers, spaces, and basic punctuation
  sanitized = sanitized.replace(/[^a-zA-Z0-9\s\-'.]/g, '');
  
  // Limit to 256 characters to prevent DoS
  return sanitized.substring(0, 256);
}

/**
 * Sanitize text field (description, comments, etc)
 * Removes potentially dangerous HTML/script content
 * @param {string} text - Text to sanitize
 * @param {number} maxLength - Maximum allowed length
 * @returns {string} - Sanitized text
 */
function sanitizeTextField(text, maxLength = 5000) {
  if (typeof text !== 'string') return '';
  
  let sanitized = sanitizeString(text);
  
  // Remove script tags and dangerous patterns
  sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gi, '');
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=/gi, '');
  
  // Limit length
  return sanitized.substring(0, maxLength);
}

/**
 * Validate MongoDB ObjectId format
 * @param {string} id - ID to validate
 * @returns {boolean} - True if valid ObjectId
 */
function validateObjectId(id) {
  if (typeof id !== 'string') return false;
  // Check if it's a 24-character hex string (MongoDB ObjectId)
  return /^[a-f0-9]{24}$/.test(id.toLowerCase());
}

/**
 * Validate ISO date string
 * @param {string} dateString - Date string to validate
 * @returns {boolean} - True if valid ISO date
 */
function validateISODate(dateString) {
  if (typeof dateString !== 'string') return false;
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

/**
 * Validate array of strings
 * @param {any} value - Value to validate
 * @param {number} maxItems - Maximum array items
 * @param {number} maxItemLength - Maximum length per item
 * @returns {boolean} - True if valid string array
 */
function validateStringArray(value, maxItems = 100, maxItemLength = 255) {
  if (!Array.isArray(value)) return false;
  if (value.length > maxItems) return false;
  
  return value.every(item => {
    return typeof item === 'string' && item.length <= maxItemLength;
  });
}

/**
 * Validate file MIME type
 * @param {string} mimeType - MIME type to validate
 * @param {array} allowedTypes - Allowed MIME types
 * @returns {boolean} - True if MIME type is allowed
 */
function validateMimeType(mimeType, allowedTypes) {
  if (typeof mimeType !== 'string') return false;
  if (!Array.isArray(allowedTypes)) return false;
  
  // Normalize and check
  const normalizedType = mimeType.toLowerCase().trim();
  return allowedTypes.some(allowed => {
    // Support wildcards like "image/*"
    if (allowed.endsWith('/*')) {
      return normalizedType.startsWith(allowed.slice(0, -2));
    }
    return normalizedType === allowed.toLowerCase();
  });
}

/**
 * Validate URL format
 * @param {string} urlString - URL to validate
 * @returns {boolean} - True if valid URL
 */
function validateUrl(urlString) {
  if (typeof urlString !== 'string') return false;
  
  try {
    const url = new URL(urlString);
    // Only allow http and https
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

/**
 * Sanitize JSON input to prevent injection
 * This is AFTER JSON.parse, so we're validating the parsed object
 * @param {object} obj - Parsed JSON object
 * @param {array} allowedKeys - Keys allowed in object
 * @returns {object} - Sanitized object with only allowed keys
 */
function sanitizeJsonInput(obj, allowedKeys = []) {
  if (typeof obj !== 'object' || obj === null) return {};
  
  if (!Array.isArray(allowedKeys)) return {};
  
  const sanitized = {};
  
  for (const key of allowedKeys) {
    if (key in obj) {
      const value = obj[key];
      // Recursively sanitize strings
      if (typeof value === 'string') {
        sanitized[key] = sanitizeString(value);
      } else if (typeof value === 'number') {
        sanitized[key] = value;
      } else if (typeof value === 'boolean') {
        sanitized[key] = value;
      } else if (value === null) {
        sanitized[key] = null;
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map(v => 
          typeof v === 'string' ? sanitizeString(v) : v
        );
      }
    }
  }
  
  return sanitized;
}

/**
 * Comprehensive user registration input validation
 * @param {object} input - User input object
 * @returns {object} - { valid: boolean, errors: array, data: object }
 */
function validateRegistrationInput(input) {
  const errors = [];
  const data = {};
  
  // Username
  if (!input.username || !validateUsername(input.username)) {
    errors.push('Username must be 4-32 alphanumeric characters (with underscore, hyphen, or dot)');
  } else {
    data.username = sanitizeString(input.username);
  }
  
  // Email
  if (!input.email || !validateEmail(input.email)) {
    errors.push('Invalid email format');
  } else {
    data.email = sanitizeString(input.email).toLowerCase();
  }
  
  // Password
  const passwordValidation = validatePassword(input.password);
  if (!passwordValidation.valid) {
    errors.push(...passwordValidation.errors);
  } else {
    data.password = input.password; // Don't sanitize password
  }
  
  // Name fields
  if (!input.name || !validateName(input.name)) {
    errors.push('First name must be 2-50 characters (letters only)');
  } else {
    data.name = sanitizeString(input.name);
  }
  
  if (!input.lastname || !validateName(input.lastname)) {
    errors.push('Last name must be 2-50 characters (letters only)');
  } else {
    data.lastname = sanitizeString(input.lastname);
  }
  
  // Optional fields
  if (input.mobile) {
    if (typeof input.mobile === 'string' && input.mobile.length > 20) {
      errors.push('Mobile number is too long');
    } else {
      data.mobile = sanitizeString(input.mobile);
    }
  }
  
  if (input.dateOfBirth) {
    if (!validateISODate(input.dateOfBirth)) {
      errors.push('Invalid date of birth format');
    } else {
      data.dateOfBirth = input.dateOfBirth;
    }
  }
  
  if (input.personalNo) {
    if (typeof input.personalNo === 'string' && input.personalNo.length > 20) {
      errors.push('Personal number is too long');
    } else {
      data.personalNo = sanitizeString(input.personalNo);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    data: errors.length === 0 ? data : {}
  };
}

/**
 * Comprehensive product creation input validation
 * @param {object} input - Product input object
 * @returns {object} - { valid: boolean, errors: array, data: object }
 */
function validateProductInput(input) {
  const errors = [];
  const data = {};
  
  // Title
  if (!input.title || !validateStringLength(input.title, 5, 200)) {
    errors.push('Title must be 5-200 characters');
  } else {
    data.title = sanitizeTextField(input.title, 200);
  }
  
  // Description is optional, but cap it tightly enough to avoid oversized
  // payloads and expensive rendering.
  if (input.description !== undefined && input.description !== null && !validateStringLength(input.description, 0, 5000)) {
    errors.push('Description must be 0-5000 characters');
  } else {
    data.description = sanitizeTextField(input.description || '', 5000);
  }
  
  // Price
  if (input.price === undefined || !validatePrice(input.price)) {
    errors.push('Price must be a valid amount between 0 and 5,000,000');
  } else {
    data.price = parseFloat(input.price);
  }
  
  // Platform
  if (!input.platform || !validateEnum(input.platform, [
    'youtube', 'twitch', 'tiktok', 'instagram', 'twitter', 'discord', 'telegram', 'other'
  ])) {
    errors.push('Invalid platform');
  } else {
    data.platform = input.platform.toLowerCase();
  }
  
  // Topic
  if (input.topic && !validateEnum(input.topic, [
    'gaming', 'education', 'entertainment', 'music', 'finance', 'technology', 'health', 'other'
  ])) {
    errors.push('Invalid topic');
  } else {
    data.topic = (input.topic || 'other').toLowerCase();
  }
  
  // Followers (optional, must be valid integer)
  if (input.followers !== undefined && input.followers !== null) {
    if (!validateInteger(input.followers, { min: 0, max: 999999999 })) {
      errors.push('Followers must be a valid non-negative number');
    } else {
      data.followers = parseInt(input.followers);
    }
  }
  
  // Average Views (optional)
  if (input.avgViews !== undefined && input.avgViews !== null) {
    if (!validateInteger(input.avgViews, { min: 0, max: 999999999 })) {
      errors.push('Average views must be a valid non-negative number');
    } else {
      data.avgViews = parseInt(input.avgViews);
    }
  }
  
  // Monetized (optional boolean)
  if (input.monetized !== undefined && input.monetized !== null) {
    if (!validateBoolean(input.monetized)) {
      errors.push('Monetized must be true or false');
    } else {
      data.monetized = input.monetized === true || input.monetized === 'true' || input.monetized === '1';
    }
  }
  
  // Channel URL (optional)
  if (input.channelUrl && !validateUrl(input.channelUrl)) {
    errors.push('Invalid channel URL');
  } else if (input.channelUrl) {
    data.channelUrl = input.channelUrl;
  }
  
  return {
    valid: errors.length === 0,
    errors,
    data: errors.length === 0 ? data : {}
  };
}

/**
 * Validate password reset token format
 * @param {string} token - Token to validate
 * @returns {boolean} - True if valid token format
 */
function validatePasswordResetToken(token) {
  if (typeof token !== 'string') return false;
  // Should be a 6-digit code or hex token
  return /^[a-f0-9]{32,}$|^\d{6}$/.test(token);
}

/**
 * Validate 2FA code (usually 6 digits)
 * @param {string} code - Code to validate
 * @returns {boolean} - True if valid 2FA code
 */
function validateTwoFactorCode(code) {
  if (typeof code !== 'string') return false;
  return /^\d{6}$/.test(code.trim());
}

/**
 * Sanitize database JSON before writing to file
 * Ensures no injection vectors in stored data
 * @param {object} db - Database object
 * @returns {string} - Stringified JSON safe for storage
 */
function sanitizeDatabaseJson(db) {
  if (typeof db !== 'object' || db === null) {
    return JSON.stringify({});
  }
  
  // JSON.stringify will automatically escape dangerous characters
  // This is safe for both file-based and shell-based execution
  try {
    const jsonString = JSON.stringify(db, (key, value) => {
      // Additional sanitization of string values
      if (typeof value === 'string') {
        // Remove null bytes that could break SQL
        return value.replace(/\0/g, '');
      }
      return value;
    });
    
    return jsonString;
  } catch (e) {
    // Returning `{}` here would turn a serialization bug into silent total
    // data loss on the next write. Let the storage layer abort the write.
    const error = new Error(`Could not serialize database safely: ${e.message}`);
    error.cause = e;
    throw error;
  }
}

module.exports = {
  // Core sanitization
  sanitizeString,
  sanitizeSearchQuery,
  sanitizeTextField,
  sanitizeDatabaseJson,
  
  // Validation functions
  validateEmail,
  validateUsername,
  validatePassword,
  validateName,
  validateInteger,
  validateDecimal,
  validatePrice,
  validateBidAmount,
  validateStringLength,
  validateEnum,
  validateBoolean,
  validateObjectId,
  validateISODate,
  validateStringArray,
  validateMimeType,
  validateUrl,
  validatePasswordResetToken,
  validateTwoFactorCode,
  
  // Comprehensive validators
  validateRegistrationInput,
  validateProductInput,
  sanitizeJsonInput
};
