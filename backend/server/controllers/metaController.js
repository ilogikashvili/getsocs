const { readDB } = require('../config/db');

function getPlatforms(req, res) {
  try {
    const platforms = ['YouTube', 'Telegram', 'TikTok'];
    const tiers = ['VIP', 'VIP+', 'Basic', 'Truth++'];
    const topics = ['Gaming', 'Fashion', 'Tech', 'Education', 'Business', 'Other'];
    res.json({ success: true, data: { platforms, tiers, topics } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

function getLanguages(req, res) {
  try {
    const languages = [
      { code: 'en', name: 'English' },
      { code: 'ru', name: 'Русский' },
      { code: 'es', name: 'Español' }
    ];
    res.json({ success: true, data: languages });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

module.exports = { getPlatforms, getLanguages };
