const { getYoutubeChannelMetadata, validateVerificationCodeInBio } = require('../controllers/youtubeController');

/**
 * Unified "prove you own this channel, then pull real stats automatically"
 * flow for every platform we support. Each verifier returns the same shape:
 *   { ok: true, data: { title, followerCount, avgViews, thumbnail, channelId, description } }
 *   { ok: false, error: 'human readable reason' }
 *
 * IMPORTANT: whatever this returns is what gets locked onto the listing
 * server-side (see productController.createProduct) - the browser's own
 * followers/avgViews fields are ignored once a channel verifies here.
 */

function decodeHtmlEntities(str) {
  return String(str || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function extractMeta(html, property) {
  const re = new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']*)["']`, 'i');
  const match = html.match(re) || html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${property}["']`, 'i'));
  return match ? decodeHtmlEntities(match[1]) : '';
}

function parseCompactNumber(raw) {
  if (!raw) return 0;
  const cleaned = String(raw).trim().replace(/,/g, '');
  const match = cleaned.match(/^([\d.]+)\s*([kKmMbB]?)/);
  if (!match) return Number(cleaned) || 0;
  const num = parseFloat(match[1]);
  const suffix = match[2].toLowerCase();
  if (suffix === 'k') return Math.round(num * 1000);
  if (suffix === 'm') return Math.round(num * 1000000);
  if (suffix === 'b') return Math.round(num * 1000000000);
  return Math.round(num);
}

/* ---------------------------- YouTube ---------------------------- */

async function verifyYoutube(url, verificationCode) {
  const result = await getYoutubeChannelMetadata(url, verificationCode);
  if (!result.ok) return result;
  return {
    ok: true,
    data: {
      title: result.data.title,
      followerCount: result.data.subscriberCount,
      avgViews: result.data.avgViews,
      thumbnail: result.data.thumbnail,
      channelId: result.data.channelId,
      description: result.data.description
    }
  };
}

/* ---------------------------- Telegram ---------------------------- */
// Telegram serves a lightweight, unauthenticated HTML preview of any public
// channel at t.me/s/<username> - no bot token needed. It includes the
// channel's bio (og:description) and a "N subscribers" line we can parse.

function extractTelegramUsername(rawUrl) {
  if (!rawUrl) return null;
  let value = String(rawUrl).trim();
  if (/^@?[\w.]+$/.test(value)) return value.replace(/^@/, '');
  try {
    const url = new URL(value.startsWith('http') ? value : `https://${value}`);
    const parts = url.pathname.split('/').filter(Boolean);
    const seg = parts[0] === 's' ? parts[1] : parts[0];
    return seg ? seg.replace(/^@/, '') : null;
  } catch (e) {
    return null;
  }
}

async function verifyTelegram(url, verificationCode) {
  const username = extractTelegramUsername(url);
  if (!username) return { ok: false, error: 'Could not read a channel username from that link.' };

  let html;
  try {
    const res = await fetch(`https://t.me/s/${encodeURIComponent(username)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GetsocsVerifier/1.0)' }
    });
    if (!res.ok) return { ok: false, error: 'Telegram channel not found or is private.' };
    html = await res.text();
  } catch (e) {
    console.error('Telegram verification error:', e.message);
    return { ok: false, error: 'Could not reach Telegram to verify this channel right now.' };
  }

  if (/tgme_page_status_recover|tgme_channel_missing/i.test(html) || !/tgme_page_title/i.test(html)) {
    return { ok: false, error: 'Telegram channel not found. It may be private or the username is wrong.' };
  }

  const title = extractMeta(html, 'og:title') || decodeHtmlEntities((html.match(/<div class="tgme_page_title"[^>]*>\s*<span[^>]*>([^<]*)<\/span>/i) || [])[1] || '');
  const description = extractMeta(html, 'og:description');
  const thumbnail = extractMeta(html, 'og:image');

  const validation = validateVerificationCodeInBio(description, verificationCode);
  if (!validation.valid) return { ok: false, error: validation.error };

  const membersMatch = html.match(/<div class="tgme_page_extra">([^<]*(?:subscribers|members)[^<]*)<\/div>/i);
  const followerCount = membersMatch ? parseCompactNumber(membersMatch[1]) : 0;

  return {
    ok: true,
    data: {
      title: title || username,
      followerCount,
      avgViews: 0, // Telegram's public preview does not expose per-post view averages
      thumbnail,
      channelId: username,
      description
    }
  };
}

/* ---------------------------- TikTok ---------------------------- */
// TikTok has no free official API. We fetch the public profile page and
// pull the embedded JSON state TikTok renders server-side for the page
// itself. This is inherently more fragile than an official API (TikTok can
// change this markup at any time) - if it stops matching, this verifier
// starts returning a clear "unavailable" error rather than silently failing.

async function verifyTiktok(url, verificationCode) {
  let username = String(url || '').trim();
  const handleMatch = username.match(/tiktok\.com\/@([\w.-]+)/i) || username.match(/^@?([\w.-]+)$/);
  username = handleMatch ? handleMatch[1] : null;
  if (!username) return { ok: false, error: 'Could not read a username from that TikTok link.' };

  let html;
  try {
    const res = await fetch(`https://www.tiktok.com/@${encodeURIComponent(username)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    if (!res.ok) return { ok: false, error: 'TikTok profile not found.' };
    html = await res.text();
  } catch (e) {
    console.error('TikTok verification error:', e.message);
    return { ok: false, error: 'Could not reach TikTok to verify this account right now.' };
  }

  const dataMatch = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
  if (!dataMatch) {
    return { ok: false, error: 'TikTok verification is temporarily unavailable. You can try again later, or ask an admin to verify manually.' };
  }

  let userInfo;
  try {
    const json = JSON.parse(dataMatch[1]);
    userInfo = json?.__DEFAULT_SCOPE__?.['webapp.user-detail']?.userInfo;
  } catch (e) {
    return { ok: false, error: 'TikTok verification is temporarily unavailable. You can try again later, or ask an admin to verify manually.' };
  }

  if (!userInfo) return { ok: false, error: 'TikTok account not found or is private.' };

  const description = userInfo.user?.signature || '';
  const validation = validateVerificationCodeInBio(description, verificationCode);
  if (!validation.valid) return { ok: false, error: validation.error };

  return {
    ok: true,
    data: {
      title: userInfo.user?.nickname || username,
      followerCount: Number(userInfo.stats?.followerCount || 0),
      avgViews: Number(userInfo.stats?.heartCount && userInfo.stats?.videoCount
        ? Math.round(userInfo.stats.heartCount / Math.max(1, userInfo.stats.videoCount))
        : 0),
      thumbnail: userInfo.user?.avatarMedium || userInfo.user?.avatarThumb || '',
      channelId: userInfo.user?.id || username,
      description
    }
  };
}

/* ---------------------------- dispatcher ---------------------------- */

const VERIFIERS = {
  youtube: verifyYoutube,
  telegram: verifyTelegram,
  tiktok: verifyTiktok
};

function supportsAutoVerification(platform) {
  return Object.prototype.hasOwnProperty.call(VERIFIERS, String(platform || '').toLowerCase());
}

async function verifyChannel(platform, url, verificationCode) {
  const key = String(platform || '').toLowerCase();
  const verifier = VERIFIERS[key];
  if (!verifier) return { ok: false, error: `Automatic verification is not available for ${platform}.` };
  if (!url) return { ok: false, error: 'A channel link is required.' };
  return verifier(url, verificationCode);
}

module.exports = { verifyChannel, supportsAutoVerification };
