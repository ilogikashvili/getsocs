const cacheService = require('../services/cacheService');
const { cacheKeys } = require('../utils/cacheKeys');
const META_TTL = Math.max(60, Number(process.env.CACHE_METADATA_TTL_SECONDS || 900));

async function getPlatforms(req, res) {
  try {
    const cached = await cacheService.getOrSet(cacheKeys.metaPlatforms(), META_TTL, async () => ({
      success: true,
      data: {
        platforms: ['YouTube', 'Telegram', 'TikTok'],
        tiers: ['VIP', 'VIP+', 'Basic', 'Truth++'],
        topics: ['Gaming', 'Fashion', 'Tech', 'Education', 'Business', 'Other']
      }
    }));
    res.setHeader('X-Cache', cached.cache);
    res.json(cached.value);
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
}
async function getLanguages(req, res) {
  try {
    const cached = await cacheService.getOrSet(cacheKeys.metaLanguages(), META_TTL, async () => ({
      success: true,
      data: [
        { code: 'en', name: 'English' },
        { code: 'ru', name: 'Русский' },
        { code: 'es', name: 'Español' }
      ]
    }));
    res.setHeader('X-Cache', cached.cache);
    res.json(cached.value);
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
}
module.exports = { getPlatforms, getLanguages };
