export const CART_ITEMS = [
  {
    id: 'vip-instagram-growth',
    platform: 'Instagram Account',
    title: 'VIP Instagram Growth Page',
    audience: '34k Followers',
    price: 250,
    badge: 'VIP',
    image: '/platform-instagram-clean.png',
    visual: 'instagram',
    tags: ['34k Followers', 'High Engagement', 'Targeted Audience'],
    trust: ['Escrow Protected', 'ID Verified']
  },
  {
    id: 'vip-creator-channel',
    platform: 'YouTube Channel',
    title: 'VIP+ Creator Channel',
    audience: '118k Subscribers',
    price: 720,
    badge: 'VIP+',
    image: '/platform-youtube-clean.png',
    visual: 'youtube',
    tags: ['118k Subscribers', 'Monetized', 'High RPM'],
    trust: ['Escrow Protected', 'Verified Seller']
  },
  {
    id: 'premium-crypto-signals',
    platform: 'Telegram Channel',
    title: 'Premium Crypto Signals',
    audience: '25k Members',
    price: 150,
    badge: 'PREMIUM',
    image: '/platform-telegram-clean.png',
    visual: 'telegram',
    tags: ['25k Members', 'Active Members', 'High Traffic'],
    trust: ['Escrow Protected', 'ID Verified']
  }
];

export function getCartTotals(items = CART_ITEMS) {
  const subtotal = items.reduce((sum, item) => sum + item.price, 0);
  const serviceFee = 22.4;
  return {
    count: items.length,
    subtotal,
    serviceFee,
    total: subtotal + serviceFee
  };
}

export function formatCartPrice(value, options = {}) {
  const { decimals = false } = options;
  return `\u00a3${Number(value).toLocaleString('en-GB', {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0
  })}`;
}
