import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { getUploadUrl } from '../api/axios';


export const PLATFORMS = ['All', 'YouTube', 'TikTok', 'Telegram'];
export const VISIBLE_PLATFORMS = PLATFORMS.filter(platform => platform !== 'All');
export const CATEGORIES = ['All', 'Gaming', 'Fashion', 'Tech', 'Education', 'Business', 'Other', 'Photography'];
export const SORT_OPTIONS = ['Newest first', 'Price: Low to High', 'Price: High to Low', 'Most followers'];

const PLATFORM_INITIALS = {
  Telegram: 'TG',
  YouTube: 'YT',
  TikTok: 'TK'
};

const PLATFORM_THEME = {
  YouTube: 'youtube',
  TikTok: 'tiktok',
  Telegram: 'telegram'
};

export function formatPrice(value = 0) {
  const numeric = Number(value) || 0;
  return `₾${numeric.toLocaleString()}`;
}

export function formatFollowers(value = 0) {
  const numeric = Number(value) || 0;
  if (numeric >= 1000000) return `${(numeric / 1000000).toFixed(1)}M followers`;
  if (numeric >= 1000) return `${Math.round(numeric / 1000)}k followers`;
  return `${numeric} followers`;
}

export function extractProductList(response) {
  const payload = response?.data;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.products)) return payload.data.products;
  if (Array.isArray(payload?.products)) return payload.products;
  return [];
}

export function ShieldCheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3 19 6v5c0 4.4-2.8 7.3-7 10-4.2-2.7-7-5.6-7-10V6l7-3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BadgeCheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m9 12 2 2 4-4M12 3l2.2 1.3 2.6-.2 1 2.4 2.3 1.2-.6 2.5.6 2.5-2.3 1.2-1 2.4-2.6-.2L12 18l-2.2-1.3-2.6.2-1-2.4L3.9 13.3l.6-2.5-.6-2.5 2.3-1.2 1-2.4 2.6.2L12 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

export function PlatformGlyph({ platform }) {
  const common = { width: 26, height: 26, viewBox: '0 0 24 24', 'aria-hidden': 'true' };
  if (platform === 'YouTube') {
    return (
      <svg {...common} fill="currentColor"><path d="M21.6 7.2s-.2-1.5-.8-2.1c-.8-.8-1.7-.8-2.1-.9C15.9 4 12 4 12 4h0s-3.9 0-6.7.2c-.4 0-1.3.1-2.1.9-.6.6-.8 2.1-.8 2.1S2.2 9 2.2 10.7v1.5c0 1.8.2 3.5.2 3.5s.2 1.5.8 2.1c.8.8 1.9.8 2.3.9C7 19 12 19 12 19s3.9 0 6.7-.2c.4-.1 1.3-.1 2.1-.9.6-.6.8-2.1.8-2.1s.2-1.7.2-3.5v-1.5c0-1.8-.2-3.5-.2-3.5ZM9.9 14.5V8.9l5.4 2.8-5.4 2.8Z" /></svg>
    );
  }
  if (platform === 'TikTok') {
    return (
      <svg {...common} fill="currentColor"><path d="M16.6 3.8c.6 1.7 1.9 3 3.6 3.4v2.7a6.7 6.7 0 0 1-3.6-1.1v6.3a5.3 5.3 0 1 1-5.3-5.3c.2 0 .4 0 .6.03v2.8a2.5 2.5 0 1 0 1.9 2.5V3.8h2.8Z" /></svg>
    );
  }
  if (platform === 'Telegram') {
    return (
      <svg {...common} fill="currentColor"><path d="M21.4 4.5 2.9 11.7c-.9.4-.9 1.6.1 1.9l4.5 1.4 1.7 5.4c.3.9 1.4 1.1 2 .4l2.6-2.9 4.6 3.4c.8.6 2 .2 2.2-.8L23.5 5.7c.3-1-.7-1.9-2.1-1.2ZM8.9 14.4l9-6.9c.3-.2.6.1.3.4l-7.5 7.2-.3 3.5-1.5-4.2Z" /></svg>
    );
  }
  return <span>{PLATFORM_INITIALS[platform] || 'GS'}</span>;
}

function HeartIcon({ filled }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} aria-hidden="true">
      <path d="M20 8.8c0 5-8 10.2-8 10.2S4 13.8 4 8.8A4.2 4.2 0 0 1 11.7 6 4.2 4.2 0 0 1 20 8.8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

export function getListingImage(item) {
  return item.image || item.imageUrl || item.screenshot || item.thumbnail || item.images?.[0] || '';
}

export function ListingCard({ item }) {
  const seller = item.seller || {};
  const handle = seller.username ? `@${seller.username}` : (item.handle || '');
  const platform = item.platform || 'Marketplace';
  const theme = PLATFORM_THEME[platform] || 'default';
  const logoUrl = item.channelLogo || item.logo || item.logoUrl || item.seller?.profilePhoto || item.sellerProfilePhoto || item.avatar || '';
  const rawImage = getListingImage(item) || logoUrl;
  const imageUrl = rawImage ? getUploadUrl(rawImage) : '';
  const [imageFailed, setImageFailed] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const showImage = imageUrl && !imageFailed;
  const badge = item.verified !== false ? 'VERIFIED' : (item.isNew ? 'NEW' : '');

  return (
    <article className={`target-listing-card platform-${theme}`}>
      <Link className="target-listing-link" to={`/product/${item.id}`}>
        <div className="target-listing-media">
          {showImage && (
            <img src={imageUrl} alt={item.title || platform} onError={() => setImageFailed(true)} />
          )}
          {!showImage && (
            <span className="target-platform-mark"><PlatformGlyph platform={platform} /></span>
          )}
          {badge && <span className={`target-status-badge ${badge === 'VERIFIED' ? 'is-verified' : 'is-new'}`}>{badge}</span>}
          <button
            type="button"
            className={`target-favorite-btn ${favorited ? 'active' : ''}`}
            aria-label="Save to favorites"
            aria-pressed={favorited}
            onClick={event => { event.preventDefault(); setFavorited(fav => !fav); }}
          >
            <HeartIcon filled={favorited} />
          </button>
          {(logoUrl || seller.profilePhoto) && (
            <div className="target-listing-logo-wrap">
              <img src={getUploadUrl(logoUrl || seller.profilePhoto)} alt={`${platform} logo`} className="target-listing-logo" />
            </div>
          )}
        </div>
        <div className="target-listing-body">
          <h3>{item.title || `${platform} account`}</h3>
          {handle && <span className="target-listing-handle">{handle}</span>}
          <span className="target-listing-followers">{formatFollowers(item.followers)}</span>
        </div>
      </Link>
      <div className="target-card-action">
        <strong className="target-listing-price">{formatPrice(item.price)}</strong>
        <Link className="view-details-btn" to={`/product/${item.id}`}>View Details</Link>
      </div>
    </article>
  );
}
