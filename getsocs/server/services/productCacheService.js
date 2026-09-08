const cacheService = require('./cacheService');
const { cacheKeys } = require('../utils/cacheKeys');
const logger = require('../utils/logger');

/**
 * Invalidate product-derived public caches after any mutation that can change
 * listing visibility, availability, price, metadata, search results, or detail.
 * Redis failures are intentionally non-fatal because cache is an optimization.
 */
async function invalidateProductCaches(productId) {
  const tasks = [
    cacheService.deleteByPattern('products:list:*'),
    cacheService.deleteByPattern('products:search:*')
  ];
  if (productId) tasks.push(cacheService.delete(cacheKeys.productDetail(productId)));

  const results = await Promise.allSettled(tasks);
  const failures = results.filter(result => result.status === 'rejected');
  if (failures.length) {
    logger.warn('Product cache invalidation partially failed', {
      productId: productId || null,
      failures: failures.length
    });
  }
}

module.exports = { invalidateProductCaches };
