export const NOTIFICATION_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread', badge: 8 },
  { id: 'orders', label: 'Orders' },
  { id: 'messages', label: 'Messages' },
  { id: 'escrow', label: 'Escrow' },
  { id: 'offers', label: 'Offers' },
  { id: 'system', label: 'System' }
];

export const NOTIFICATIONS = [
  {
    id: 'new-order-created',
    category: 'orders',
    icon: 'basket',
    tone: 'purple',
    title: 'New order created',
    text: 'Someone purchased your listing "VIP Instagram Growth Page".',
    time: '2m ago',
    unread: true,
    priority: true
  },
  {
    id: 'escrow-payment-received',
    category: 'escrow',
    icon: 'shield',
    tone: 'blue',
    title: 'Escrow payment received',
    text: 'Escrow payment of \u00a3250.00 has been received for order #GS-7842.',
    time: '15m ago',
    unread: true,
    priority: true
  },
  {
    id: 'new-message',
    category: 'messages',
    icon: 'message',
    tone: 'green',
    title: 'New message',
    text: 'You have a new message from @buyerguy about your listing.',
    time: '1h ago',
    unread: true,
    priority: true
  },
  {
    id: 'offer-received',
    category: 'offers',
    icon: 'tag',
    tone: 'amber',
    title: 'Offer received',
    text: 'You received a new offer of \u00a3200 for "YouTube Creator Channel".',
    time: '2h ago',
    unread: true,
    priority: true
  },
  {
    id: 'order-completed',
    category: 'orders',
    icon: 'checkCircle',
    tone: 'violet',
    title: 'Order completed',
    text: 'Order #GS-7812 has been completed successfully.',
    time: '5h ago',
    unread: true
  },
  {
    id: 'security-alert',
    category: 'system',
    icon: 'bell',
    tone: 'cyan',
    title: 'Security alert',
    text: 'New login detected on Chrome, Windows from Tbilisi, Georgia.',
    time: '1d ago',
    unread: true,
    priority: true
  },
  {
    id: 'payout-sent',
    category: 'orders',
    icon: 'money',
    tone: 'mint',
    title: 'Payout sent',
    text: '\u00a3180.00 has been sent to your payment method ending in 4242.',
    time: '2d ago',
    unread: true
  },
  {
    id: 'system-update',
    category: 'system',
    icon: 'gear',
    tone: 'slate',
    title: 'System update',
    text: "We've updated our Terms of Service. Please review the changes.",
    time: '3d ago',
    unread: true
  }
];

export const NOTIFICATION_PREFERENCES = [
  { id: 'email', icon: 'mail', title: 'Email Notifications', text: 'Receive updates via email', enabled: true },
  { id: 'push', icon: 'bell', title: 'Push Notifications', text: 'Receive push notifications', enabled: true },
  { id: 'browser', icon: 'bell', title: 'Browser Notifications', text: 'Show notifications in browser', enabled: true },
  { id: 'marketing', icon: 'clock', title: 'Marketing & Offers', text: 'Updates about offers and news', enabled: false },
  { id: 'sound', icon: 'volume', title: 'Sound Alerts', text: 'Play sound for notifications', enabled: true }
];

export const NOTIFICATION_TIPS = [
  { id: 'stay-updated', icon: 'bell', tone: 'cyan', title: 'Stay updated', text: 'Enable important notifications to never miss an order or message.' },
  { id: 'secure-account', icon: 'shield', tone: 'mint', title: 'Secure your account', text: 'Turn on security alerts to protect your account from suspicious activity.' },
  { id: 'customize-way', icon: 'gear', tone: 'purple', title: 'Customize your way', text: 'Choose your preferred channels and quiet hours for a better experience.' }
];

export function getUnreadNotificationCount(items = NOTIFICATIONS) {
  return items.filter(item => item.unread).length;
}
