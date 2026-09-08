/**
 * Comprehensive Request Body Validation Middleware
 * Validates all incoming request bodies against defined schemas
 * Enforces field types, lengths, ranges, and patterns
 * Returns detailed validation error messages
 * 
 * OWASP A07:2021 - Cross-Site Request Forgery (CSRF) Prevention
 * CWE-352: Cross-Site Request Forgery (CSRF)
 */

const {
  validateRegistrationInput,
  validateProductInput,
  validateEmail,
  validateUsername,
  validatePassword,
  validateName,
  validatePrice,
  validateBidAmount,
  sanitizeString,
  sanitizeSearchQuery,
  sanitizeTextField,
} = require('../utils/inputValidation');

/**
 * Validation schema definitions for all endpoints
 * Each schema defines required fields, types, and validation rules
 */
const validationSchemas = {
  // Authentication endpoints
  register: {
    fields: {
      username: { type: 'string', required: true, validator: validateUsername },
      email: { type: 'string', required: true, validator: validateEmail },
      password: { type: 'string', required: true, validator: validatePassword },
      name: { type: 'string', required: true, validator: validateName },
      lastname: { type: 'string', required: true, validator: validateName },
    },
    compositeValidator: validateRegistrationInput,
  },
  
  login: {
    fields: {
      email: { type: 'string', required: true, validator: validateEmail },
      password: { type: 'string', required: true, minLength: 1 },
    },
  },
  
  passwordReset: {
    fields: {
      email: { type: 'string', required: true, validator: validateEmail },
    },
  },
  
  updatePassword: {
    fields: {
      currentPassword: { type: 'string', required: true, minLength: 1 },
      newPassword: { type: 'string', required: true, validator: validatePassword },
      confirmPassword: { type: 'string', required: true, validator: validatePassword },
    },
  },
  
  // Product endpoints
  createProduct: {
    fields: {
      title: { type: 'string', required: true, minLength: 5, maxLength: 200 },
      description: { type: 'string', required: false, minLength: 0, maxLength: 5000 },
      price: { type: 'number', required: true, validator: validatePrice },
      platform: { type: 'string', required: true, enum: ['youtube', 'twitch', 'tiktok', 'instagram', 'twitter', 'discord', 'telegram', 'other'] },
      topic: { type: 'string', required: true, enum: ['gaming', 'education', 'entertainment', 'music', 'finance', 'technology', 'health', 'other'] },
      imageUrl: { type: 'string', required: false, maxLength: 500, pattern: 'url' },
    },
    compositeValidator: validateProductInput,
  },
  
  updateProduct: {
    fields: {
      id: { type: 'string', required: true, minLength: 1 },
      title: { type: 'string', required: false, minLength: 5, maxLength: 200 },
      description: { type: 'string', required: false, minLength: 0, maxLength: 5000 },
      price: { type: 'number', required: false, validator: validatePrice },
      platform: { type: 'string', required: false, enum: ['youtube', 'twitch', 'tiktok', 'instagram', 'twitter', 'discord', 'telegram', 'other'] },
      topic: { type: 'string', required: false, enum: ['gaming', 'education', 'entertainment', 'music', 'finance', 'technology', 'health', 'other'] },
      imageUrl: { type: 'string', required: false, maxLength: 500, pattern: 'url' },
    },
  },
  
  deleteProduct: {
    fields: {
      id: { type: 'string', required: true, minLength: 1 },
    },
  },
  
  // Chat endpoints
  sendMessage: {
    fields: {
      conversationId: { type: 'string', required: true, minLength: 1 },
      message: { type: 'string', required: true, minLength: 1, maxLength: 5000, sanitizer: sanitizeTextField },
    },
  },
  
  createConversation: {
    fields: {
      recipientId: { type: 'string', required: true, minLength: 1 },
    },
  },
  
  // Review/Rating endpoints
  createReview: {
    fields: {
      productId: { type: 'string', required: true, minLength: 1 },
      rating: { type: 'number', required: true, integer: true, min: 1, max: 5 },
      reviewText: { type: 'string', required: true, minLength: 5, maxLength: 1000, sanitizer: sanitizeTextField },
    },
  },
  
  // Bid endpoints
  createBid: {
    fields: {
      productId: { type: 'string', required: true, minLength: 1 },
      bidAmount: { type: 'number', required: true, validator: validateBidAmount },
    },
  },
  
  // Search endpoints
  searchProducts: {
    fields: {
      q: { type: 'string', required: false, maxLength: 256, sanitizer: sanitizeSearchQuery },
      platform: { type: 'string', required: false, enum: ['youtube', 'twitch', 'tiktok', 'instagram', 'twitter', 'discord', 'telegram', 'other'] },
      topic: { type: 'string', required: false, enum: ['gaming', 'education', 'entertainment', 'music', 'finance', 'technology', 'health', 'other'] },
      minPrice: { type: 'number', required: false, min: 0, max: 1000000 },
      maxPrice: { type: 'number', required: false, min: 0, max: 1000000 },
      sortBy: { type: 'string', required: false, enum: ['newest', 'price-low', 'price-high', 'rating'] },
      page: { type: 'number', required: false, min: 1, max: 1000 },
      limit: { type: 'number', required: false, min: 1, max: 100 },
    },
  },
  
  // Badge endpoints
  createBadge: {
    fields: {
      userId: { type: 'string', required: true, minLength: 1 },
      badgeType: { type: 'string', required: true, enum: ['seller', 'buyer', 'trusted', 'verified', 'power_seller', 'premium'] },
      reason: { type: 'string', required: false, maxLength: 500, sanitizer: sanitizeTextField },
    },
  },
  
  // Membership endpoints
  upgradeMembership: {
    fields: {
      tier: { type: 'string', required: true, enum: ['basic', 'premium', 'elite'] },
      billingPeriod: { type: 'string', required: true, enum: ['monthly', 'yearly'] },
    },
  },
  
  // Escrow endpoints
  createEscrow: {
    fields: {
      buyerId: { type: 'string', required: true, minLength: 1 },
      sellerId: { type: 'string', required: true, minLength: 1 },
      productId: { type: 'string', required: true, minLength: 1 },
      amount: { type: 'number', required: true, validator: validatePrice },
    },
  },
};

/**
 * Validate a single field against its schema definition
 * @param {*} value - The value to validate
 * @param {Object} fieldSchema - The field's schema definition
 * @param {string} fieldName - The field name (for error messages)
 * @returns {Object} - { valid: boolean, error: string | null }
 */
function validateField(value, fieldSchema, fieldName) {
  // Check required fields
  if (fieldSchema.required && (value === undefined || value === null || value === '')) {
    return { valid: false, error: `${fieldName} is required` };
  }
  
  // Allow undefined/null for optional fields
  if (!fieldSchema.required && (value === undefined || value === null)) {
    return { valid: true, error: null };
  }
  
  // Type checking
  if (fieldSchema.type && typeof value !== fieldSchema.type) {
    return { 
      valid: false, 
      error: `${fieldName} must be a ${fieldSchema.type}, got ${typeof value}` 
    };
  }
  
  // String length validation
  if (fieldSchema.type === 'string') {
    if (fieldSchema.minLength && value.length < fieldSchema.minLength) {
      return { 
        valid: false, 
        error: `${fieldName} must be at least ${fieldSchema.minLength} characters` 
      };
    }
    if (fieldSchema.maxLength && value.length > fieldSchema.maxLength) {
      return { 
        valid: false, 
        error: `${fieldName} must not exceed ${fieldSchema.maxLength} characters` 
      };
    }
  }
  
  // Number range validation
  if (fieldSchema.type === 'number') {
    if (isNaN(value) || !Number.isFinite(value)) {
      return { valid: false, error: `${fieldName} must be a valid number` };
    }
    if (fieldSchema.integer && !Number.isInteger(value)) {
      return { valid: false, error: `${fieldName} must be a whole number` };
    }
    if (fieldSchema.min !== undefined && value < fieldSchema.min) {
      return { valid: false, error: `${fieldName} must be at least ${fieldSchema.min}` };
    }
    if (fieldSchema.max !== undefined && value > fieldSchema.max) {
      return { valid: false, error: `${fieldName} must not exceed ${fieldSchema.max}` };
    }
  }
  
  // Enum validation (whitelist allowed values)
  if (fieldSchema.enum) {
    if (!fieldSchema.enum.includes(value)) {
      return { 
        valid: false, 
        error: `${fieldName} must be one of: ${fieldSchema.enum.join(', ')}` 
      };
    }
  }
  
  // URL pattern validation
  if (fieldSchema.pattern === 'url') {
    try {
      new URL(value);
    } catch (e) {
      return { valid: false, error: `${fieldName} must be a valid URL` };
    }
  }
  
  // Custom validator function
  // Validators in utils/inputValidation.js aren't consistent about their
  // return shape - some return a plain boolean (validateUsername,
  // validateEmail, validateName), others return { valid, errors }
  // (validatePassword). Normalize both here instead of assuming everything
  // returns an object, which silently made every boolean-returning
  // validator report failure on ALL input (result.valid on a boolean is
  // always undefined).
  if (fieldSchema.validator) {
    const rawResult = fieldSchema.validator(value);
    const result = typeof rawResult === 'boolean'
      ? { valid: rawResult, errors: rawResult ? [] : [`${fieldName} is invalid`] }
      : rawResult;
    if (!result.valid) {
      return { 
        valid: false, 
        error: `${fieldName}: ${result.errors ? result.errors[0] : 'Invalid value'}` 
      };
    }
  }
  
  // Sanitizer (optional - modifies value but doesn't reject)
  if (fieldSchema.sanitizer && fieldSchema.type === 'string') {
    // Note: Sanitizers clean but don't reject. Applied after validation passes.
  }
  
  return { valid: true, error: null };
}

/**
 * Validate entire request body against a schema
 * @param {Object} body - The request body to validate
 * @param {Object} schema - The validation schema
 * @returns {Object} - { valid: boolean, errors: string[], data: Object }
 */
function validateRequestBody(body, schema) {
  const errors = [];
  const sanitizedData = {};
  
  if (!schema || !schema.fields) {
    return { valid: true, errors: [], data: body };
  }
  
  // Validate each field
  for (const [fieldName, fieldSchema] of Object.entries(schema.fields)) {
    const value = body[fieldName];
    const validation = validateField(value, fieldSchema, fieldName);
    
    if (!validation.valid) {
      errors.push(validation.error);
    } else if (value !== undefined && value !== null) {
      // Apply sanitizer if available
      if (fieldSchema.sanitizer && fieldSchema.type === 'string') {
        sanitizedData[fieldName] = fieldSchema.sanitizer(value);
      } else {
        sanitizedData[fieldName] = value;
      }
    } else {
      sanitizedData[fieldName] = value;
    }
  }
  
  // Check for unexpected fields (reject fields not in schema)
  for (const key of Object.keys(body)) {
    if (!schema.fields.hasOwnProperty(key)) {
      errors.push(`Unexpected field: ${key}`);
    }
  }
  
  // Run composite validator if available
  if (schema.compositeValidator && errors.length === 0) {
    const compositeResult = schema.compositeValidator(body);
    if (!compositeResult.valid) {
      errors.push(...compositeResult.errors);
    } else if (compositeResult.data) {
      // Merge validated data from composite validator
      Object.assign(sanitizedData, compositeResult.data);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    data: errors.length === 0 ? sanitizedData : body,
  };
}

/**
 * Express middleware factory - validates request body against schema
 * @param {string} schemaName - The name of the schema to use
 * @returns {Function} Express middleware
 */
function validateRequest(schemaName) {
  return (req, res, next) => {
    const schema = validationSchemas[schemaName];
    
    if (!schema) {
      // Schema not defined - allow request through
      return next();
    }
    
    const validation = validateRequestBody(req.body, schema);
    
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        errors: validation.errors,
        message: 'Validation failed',
      });
    }
    
    // Store validated data in request for use in controllers
    req.validated = validation.data;
    
    next();
  };
}

/**
 * Middleware to validate query parameters
 * Currently supports pagination and search parameters
 * @returns {Function} Express middleware
 */
function validateQueryParams(req, res, next) {
  const { page, limit, sortBy } = req.query;
  
  if (page) {
    const pageNum = parseInt(page, 10);
    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({
        success: false,
        errors: ['page must be a positive integer'],
      });
    }
  }
  
  if (limit) {
    const limitNum = parseInt(limit, 10);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        errors: ['limit must be between 1 and 100'],
      });
    }
  }
  
  if (sortBy) {
    const validSortFields = ['newest', 'price-low', 'price-high', 'rating'];
    if (!validSortFields.includes(sortBy)) {
      return res.status(400).json({
        success: false,
        errors: [`sortBy must be one of: ${validSortFields.join(', ')}`],
      });
    }
  }
  
  next();
}

/**
 * Middleware to validate URL parameters (IDs, etc.)
 * @returns {Function} Express middleware
 */
function validateUrlParams(req, res, next) {
  const { id } = req.params;
  
  if (id) {
    // ID should be non-empty string
    if (typeof id !== 'string' || id.length === 0) {
      return res.status(400).json({
        success: false,
        errors: ['Invalid ID format'],
      });
    }
    
    // Optional: Add UUID format validation if using UUIDs
    // const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    // if (!uuidRegex.test(id)) { ... }
  }
  
  next();
}

/**
 * Validation error formatter for API responses
 * @param {Object} validation - Validation result object
 * @returns {Object} Formatted error response
 */
function formatValidationError(validation) {
  return {
    success: false,
    errors: validation.errors,
    message: `${validation.errors.length} validation error(s)`,
  };
}

/**
 * Batch validate multiple objects (used internally for testing)
 * @param {Object[]} objects - Array of objects to validate
 * @param {Object} schema - Schema to validate against
 * @returns {Object[]} Array of validation results
 */
function batchValidate(objects, schema) {
  return objects.map((obj, index) => ({
    index,
    ...validateRequestBody(obj, schema),
  }));
}

module.exports = {
  validateRequest,
  validateField,
  validateRequestBody,
  validateQueryParams,
  validateUrlParams,
  formatValidationError,
  batchValidate,
  validationSchemas,
};
