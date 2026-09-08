const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

function extractChannelRef(rawUrl) {
  if (!rawUrl) return null;
  let value = String(rawUrl).trim();
  // Allow bare handles like "@mkbhd" as well as full URLs
  if (/^@[\w.-]+$/.test(value)) return { type: 'handle', value: value.slice(1) };

  try {
    const url = new URL(value.startsWith('http') ? value : `https://${value}`);
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] === 'channel' && parts[1]) return { type: 'id', value: parts[1] };
    if (parts[0]?.startsWith('@')) return { type: 'handle', value: parts[0].slice(1) };
    if (parts[0] === 'c' && parts[1]) return { type: 'custom', value: parts[1] };
    if (parts[0] === 'user' && parts[1]) return { type: 'user', value: parts[1] };
    if (parts[0]) return { type: 'custom', value: parts[0] };
    return null;
  } catch (e) {
    return null;
  }
}

async function resolveChannelId(ref, apiKey = YOUTUBE_API_KEY) {
  if (ref.type === 'id') return ref.value;

  if (ref.type === 'handle') {
    const res = await fetch(`${YOUTUBE_API_BASE}/channels?part=id&forHandle=${encodeURIComponent(ref.value)}&key=${apiKey}`);
    const json = await res.json();
    if (json.items && json.items.length) return json.items[0].id;
  }

  if (ref.type === 'user') {
    const res = await fetch(`${YOUTUBE_API_BASE}/channels?part=id&forUsername=${encodeURIComponent(ref.value)}&key=${apiKey}`);
    const json = await res.json();
    if (json.items && json.items.length) return json.items[0].id;
  }

  // Fall back to a general search for custom URLs / anything unresolved above
  const searchRes = await fetch(`${YOUTUBE_API_BASE}/search?part=snippet&type=channel&q=${encodeURIComponent(ref.value)}&maxResults=1&key=${apiKey}`);
  const searchJson = await searchRes.json();
  if (searchJson.items && searchJson.items.length) return searchJson.items[0].snippet.channelId || searchJson.items[0].id.channelId;

  return null;
}

function validateVerificationCodeInBio(description, verificationCode) {
  const cleanDescription = String(description || '').trim();
  const cleanVerificationCode = String(verificationCode || '').trim();

  if (!cleanVerificationCode) {
    return { valid: false, error: 'A verification code is required.' };
  }

  if (!cleanDescription) {
    return { valid: false, error: `The verification code "${cleanVerificationCode}" was not found in the channel bio.` };
  }

  const includesCode = cleanDescription.toLowerCase().includes(cleanVerificationCode.toLowerCase());
  if (!includesCode) {
    return { valid: false, error: `The verification code "${cleanVerificationCode}" was not found in the channel bio.` };
  }

  return { valid: true };
}

async function getYoutubeChannelMetadata(url, verificationCode, apiKey = YOUTUBE_API_KEY) {
  if (!apiKey) {
    const ref = extractChannelRef(url);
    return {
      ok: false,
      error: ref
        ? 'YouTube lookup is unavailable because the server is not configured with a YouTube API key.'
        : 'Please provide a valid YouTube channel link.'
    };
  }

  const ref = extractChannelRef(url);
  if (!ref) return { ok: false, error: 'Could not read a channel from that link.' };

  const channelId = await resolveChannelId(ref, apiKey);
  if (!channelId) return { ok: false, error: 'Channel not found.' };

  const channelRes = await fetch(`${YOUTUBE_API_BASE}/channels?part=snippet,statistics,contentDetails&id=${channelId}&key=${apiKey}`);
  const channelJson = await channelRes.json();
  const channel = channelJson.items && channelJson.items[0];
  if (!channel) return { ok: false, error: 'Channel not found.' };

  const description = channel.snippet.description || '';
  const validation = validateVerificationCodeInBio(description, verificationCode);
  if (!validation.valid) return { ok: false, error: validation.error };

  const title = channel.snippet.title;
  const subscriberCount = channel.statistics.hiddenSubscriberCount ? 0 : Number(channel.statistics.subscriberCount || 0);
  const thumbnail = channel.snippet.thumbnails?.medium?.url || channel.snippet.thumbnails?.default?.url || '';
  const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads;

  let avgViews = 0;
  if (uploadsPlaylistId) {
    const playlistRes = await fetch(`${YOUTUBE_API_BASE}/playlistItems?part=contentDetails&playlistId=${uploadsPlaylistId}&maxResults=10&key=${apiKey}`);
    const playlistJson = await playlistRes.json();
    const videoIds = (playlistJson.items || []).map(item => item.contentDetails.videoId).filter(Boolean);
    if (videoIds.length) {
      const videosRes = await fetch(`${YOUTUBE_API_BASE}/videos?part=statistics&id=${videoIds.join(',')}&key=${apiKey}`);
      const videosJson = await videosRes.json();
      const views = (videosJson.items || []).map(item => Number(item.statistics.viewCount || 0));
      if (views.length) avgViews = Math.round(views.reduce((sum, v) => sum + v, 0) / views.length);
    }
  }

  return {
    ok: true,
    data: {
      title,
      subscriberCount,
      avgViews,
      thumbnail,
      channelId,
      description
    }
  };
}

async function lookupYoutubeChannel(req, res) {
  try {
    const { url, verificationCode } = req.query;
    const result = await getYoutubeChannelMetadata(url, verificationCode);
    if (!result.ok) {
      return res.status(200).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: result.data });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to fetch channel info from YouTube.' });
  }
}

module.exports = { lookupYoutubeChannel, getYoutubeChannelMetadata, validateVerificationCodeInBio };
