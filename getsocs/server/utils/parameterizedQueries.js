/**
 * Parameterized Query Builder for SQL Operations
 * Prevents SQL Injection through proper parameterization
 * 
 * IMPORTANT: These utilities demonstrate secure SQL patterns.
 * The actual GetSOCS application uses file-based JSON database,
 * but these are available if transitioning to relational databases.
 * 
 * Core Principle: NEVER concatenate user input into SQL strings.
 * Always use parameterized queries or prepared statements.
 */

// mysql2/promise is optional - only required if using MySQL backend
// Lazy loaded when needed

/**
 * Create a parameterized SELECT query builder
 * @param {string} table - Table name (should be whitelisted)
 * @param {array} columns - Columns to select (should be whitelisted)
 * @param {object} whereConditions - Conditions { column: value, ... }
 * @returns {object} - { query: string, params: array }
 */
function buildSelectQuery(table, columns = ['*'], whereConditions = {}) {
  // Whitelist tables and columns to prevent SQL injection via identifiers
  const ALLOWED_TABLES = ['users', 'products', 'transactions', 'chats', 'comments', 'reviews'];
  const ALLOWED_COLUMNS = {
    users: ['id', 'username', 'email', 'name', 'lastname', 'role', 'verified', 'banned', 'createdAt'],
    products: ['id', 'title', 'description', 'price', 'platform', 'topic', 'sellerId', 'status', 'createdAt'],
    transactions: ['id', 'buyerId', 'sellerId', 'productId', 'status', 'amount', 'createdAt'],
    comments: ['id', 'productId', 'authorId', 'text', 'createdAt'],
    reviews: ['id', 'targetId', 'authorId', 'rating', 'text', 'createdAt'],
    chats: ['id', 'txId', 'participants', 'createdAt']
  };
  
  // Validate table name
  if (!ALLOWED_TABLES.includes(table)) {
    throw new Error(`Invalid table name: ${table}`);
  }
  
  // Validate and sanitize columns
  let selectColumns = '*';
  if (Array.isArray(columns) && columns.length > 0) {
    const validColumns = columns.filter(col => {
      return ALLOWED_COLUMNS[table]?.includes(col) || col === '*';
    });
    if (validColumns.length === 0) {
      validColumns.push('*');
    }
    selectColumns = validColumns.map(col => `\`${col}\``).join(', ');
  }
  
  // Build WHERE clause
  let whereClause = '';
  const params = [];
  
  if (Object.keys(whereConditions).length > 0) {
    const conditions = [];
    for (const [column, value] of Object.entries(whereConditions)) {
      // Validate column name against whitelist
      if (!ALLOWED_COLUMNS[table]?.includes(column)) {
        continue;
      }
      
      if (value === null) {
        conditions.push(`\`${column}\` IS NULL`);
      } else if (Array.isArray(value)) {
        conditions.push(`\`${column}\` IN (${value.map(() => '?').join(', ')})`);
        params.push(...value);
      } else {
        conditions.push(`\`${column}\` = ?`);
        params.push(value);
      }
    }
    
    if (conditions.length > 0) {
      whereClause = ' WHERE ' + conditions.join(' AND ');
    }
  }
  
  const query = `SELECT ${selectColumns} FROM \`${table}\`${whereClause}`;
  return { query, params };
}

/**
 * Create a parameterized INSERT query builder
 * @param {string} table - Table name (should be whitelisted)
 * @param {object} data - Data to insert { column: value, ... }
 * @returns {object} - { query: string, params: array }
 */
function buildInsertQuery(table, data) {
  const ALLOWED_TABLES = ['users', 'products', 'transactions', 'chats', 'comments', 'reviews'];
  const ALLOWED_COLUMNS = {
    users: ['username', 'email', 'name', 'lastname', 'password', 'role', 'createdAt'],
    products: ['title', 'description', 'price', 'platform', 'topic', 'sellerId', 'status', 'createdAt'],
    transactions: ['buyerId', 'sellerId', 'productId', 'status', 'amount', 'createdAt'],
    comments: ['productId', 'authorId', 'text', 'createdAt'],
    reviews: ['targetId', 'authorId', 'rating', 'text', 'createdAt'],
    chats: ['txId', 'participants', 'createdAt']
  };
  
  // Validate table
  if (!ALLOWED_TABLES.includes(table)) {
    throw new Error(`Invalid table name: ${table}`);
  }
  
  // Validate and filter data
  const columns = [];
  const values = [];
  const params = [];
  
  for (const [column, value] of Object.entries(data)) {
    if (!ALLOWED_COLUMNS[table]?.includes(column)) {
      continue; // Skip unknown columns
    }
    
    columns.push(`\`${column}\``);
    values.push('?');
    params.push(value);
  }
  
  if (columns.length === 0) {
    throw new Error('No valid columns provided for insert');
  }
  
  const query = `INSERT INTO \`${table}\` (${columns.join(', ')}) VALUES (${values.join(', ')})`;
  return { query, params };
}

/**
 * Create a parameterized UPDATE query builder
 * @param {string} table - Table name
 * @param {object} data - Data to update { column: value, ... }
 * @param {object} whereConditions - WHERE conditions
 * @returns {object} - { query: string, params: array }
 */
function buildUpdateQuery(table, data, whereConditions = {}) {
  const ALLOWED_TABLES = ['users', 'products', 'transactions', 'chats', 'comments', 'reviews'];
  const ALLOWED_COLUMNS = {
    users: ['id', 'username', 'email', 'name', 'lastname', 'password', 'role', 'verified', 'banned', 'updatedAt'],
    products: ['id', 'title', 'description', 'price', 'platform', 'topic', 'status', 'updatedAt'],
    transactions: ['id', 'status', 'updatedAt'],
    comments: ['id', 'text', 'updatedAt'],
    reviews: ['id', 'rating', 'text', 'updatedAt'],
    chats: ['id', 'updatedAt']
  };
  
  // Validate table
  if (!ALLOWED_TABLES.includes(table)) {
    throw new Error(`Invalid table name: ${table}`);
  }
  
  // Build SET clause
  const setClause = [];
  const params = [];
  
  for (const [column, value] of Object.entries(data)) {
    if (!ALLOWED_COLUMNS[table]?.includes(column)) {
      continue; // Skip unknown columns
    }
    
    setClause.push(`\`${column}\` = ?`);
    params.push(value);
  }
  
  if (setClause.length === 0) {
    throw new Error('No valid columns provided for update');
  }
  
  // Build WHERE clause
  let whereClause = '';
  
  for (const [column, value] of Object.entries(whereConditions)) {
    if (!ALLOWED_COLUMNS[table]?.includes(column)) {
      continue;
    }
    
    if (value === null) {
      whereClause = ` WHERE \`${column}\` IS NULL`;
    } else {
      whereClause = ` WHERE \`${column}\` = ?`;
      params.push(value);
    }
    break; // Only support single WHERE condition for safety
  }
  
  if (!whereClause) {
    throw new Error('WHERE condition is required for UPDATE');
  }
  
  const query = `UPDATE \`${table}\` SET ${setClause.join(', ')}${whereClause}`;
  return { query, params };
}

/**
 * Create a parameterized DELETE query builder
 * @param {string} table - Table name
 * @param {object} whereConditions - WHERE conditions (required)
 * @returns {object} - { query: string, params: array }
 */
function buildDeleteQuery(table, whereConditions) {
  const ALLOWED_TABLES = ['users', 'products', 'transactions', 'chats', 'comments', 'reviews'];
  const ALLOWED_COLUMNS = {
    users: ['id'],
    products: ['id'],
    transactions: ['id'],
    comments: ['id'],
    reviews: ['id'],
    chats: ['id']
  };
  
  // Validate table
  if (!ALLOWED_TABLES.includes(table)) {
    throw new Error(`Invalid table name: ${table}`);
  }
  
  // Require WHERE condition (prevent accidental full table delete)
  if (!whereConditions || Object.keys(whereConditions).length === 0) {
    throw new Error('WHERE condition is required for DELETE');
  }
  
  // Build WHERE clause
  const whereList = [];
  const params = [];
  
  for (const [column, value] of Object.entries(whereConditions)) {
    if (!ALLOWED_COLUMNS[table]?.includes(column)) {
      continue;
    }
    
    if (value === null) {
      whereList.push(`\`${column}\` IS NULL`);
    } else {
      whereList.push(`\`${column}\` = ?`);
      params.push(value);
    }
  }
  
  if (whereList.length === 0) {
    throw new Error('No valid WHERE conditions provided');
  }
  
  const query = `DELETE FROM \`${table}\` WHERE ${whereList.join(' AND ')}`;
  return { query, params };
}

/**
 * Execute a parameterized query (for MySQL connections)
 * @param {object} connection - MySQL connection object
 * @param {string} query - Query string with ? placeholders
 * @param {array} params - Parameter values
 * @returns {Promise<array>} - Query results
 */
async function executeQuery(connection, query, params = []) {
  if (!connection) {
    throw new Error('Database connection is required');
  }
  
  if (typeof query !== 'string') {
    throw new Error('Query must be a string');
  }
  
  if (!Array.isArray(params)) {
    throw new Error('Parameters must be an array');
  }
  
  try {
    const [rows] = await connection.query(query, params);
    return rows;
  } catch (error) {
    // Log error but don't expose internal details to user
    console.error('Database query error:', error.message);
    throw new Error('Database operation failed');
  }
}

/**
 * Batch query results (pagination)
 * @param {array} results - Query results
 * @param {number} page - Page number (1-indexed)
 * @param {number} pageSize - Items per page
 * @returns {object} - { data: array, page: number, pageSize: number, total: number }
 */
function paginateResults(results, page = 1, pageSize = 20) {
  if (!Array.isArray(results)) {
    return { data: [], page, pageSize, total: 0 };
  }
  
  // Validate page and pageSize
  const validatedPage = Math.max(1, Math.floor(page));
  const validatedPageSize = Math.max(1, Math.min(100, Math.floor(pageSize))); // Cap at 100
  
  const total = results.length;
  const startIndex = (validatedPage - 1) * validatedPageSize;
  const endIndex = startIndex + validatedPageSize;
  
  return {
    data: results.slice(startIndex, endIndex),
    page: validatedPage,
    pageSize: validatedPageSize,
    total,
    totalPages: Math.ceil(total / validatedPageSize)
  };
}

/**
 * Safely extract query parameters for filtering
 * Only allows whitelisted parameters
 * @param {object} queryParams - Query parameters from request
 * @param {array} allowedParams - Whitelisted parameter names
 * @returns {object} - Sanitized parameters
 */
function extractWhitelistedParams(queryParams, allowedParams = []) {
  if (typeof queryParams !== 'object' || queryParams === null) {
    return {};
  }
  
  if (!Array.isArray(allowedParams)) {
    return {};
  }
  
  const result = {};
  
  for (const param of allowedParams) {
    if (param in queryParams) {
      result[param] = queryParams[param];
    }
  }
  
  return result;
}

module.exports = {
  // Query builders
  buildSelectQuery,
  buildInsertQuery,
  buildUpdateQuery,
  buildDeleteQuery,
  
  // Execution
  executeQuery,
  
  // Utilities
  paginateResults,
  extractWhitelistedParams
};
