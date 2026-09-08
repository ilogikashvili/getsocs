import React from 'react';

export default function NotificationIcon({ name, size = 18 }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    'aria-hidden': 'true'
  };

  const icons = {
    basket: <path d="M7 10 9 5m8 5-2-5M5 10h14l-1.4 9H6.4L5 10Zm5 4v2m4-2v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
    shield: <path d="M12 3 19 6v5c0 4.4-2.8 7.3-7 10-4.2-2.7-7-5.6-7-10V6l7-3Zm-3 9 2 2 4-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
    message: <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6A2.5 2.5 0 0 1 16.5 15H10l-5 4V6.5Zm4 2.5h6m-6 3h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
    tag: <path d="M4 5.5V11l8.2 8.2a2.2 2.2 0 0 0 3.1 0l4-4a2.2 2.2 0 0 0 0-3.1L11 4H5.5A1.5 1.5 0 0 0 4 5.5Zm4 2.5h.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
    checkCircle: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-4-9 2.4 2.4L16 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
    bell: <path d="M18 8a6 6 0 1 0-12 0c0 7-3 6-3 9h18c0-3-3-2-3-9Zm-8 12a2.3 2.3 0 0 0 4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
    money: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-14v10m3-7.5c-.6-.8-1.6-1.2-3-1.2-1.7 0-2.7.7-2.7 1.8 0 2.7 5.4 1 5.4 3.8 0 1.1-1 1.8-2.7 1.8-1.4 0-2.5-.4-3.2-1.3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />,
    gear: (
      <>
        <path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" stroke="currentColor" strokeWidth="1.7" />
        <path d="m19 13 .8 1.9-1.8 3.1-2-.2a8 8 0 0 1-1.6.9L13.2 21H9.8l-.8-2.3a8 8 0 0 1-1.6-.9l-2 .2-1.8-3.1.8-1.9a8 8 0 0 1 0-2L3.6 9.1 5.4 6l2 .2A8 8 0 0 1 9 5.3L9.8 3h3.4l.8 2.3a8 8 0 0 1 1.6.9l2-.2 1.8 3.1-.8 1.9a8 8 0 0 1 0 2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      </>
    ),
    mail: <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-9Zm2-.5 6 5 6-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
    clock: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v5l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />,
    volume: <path d="M4 9v6h4l5 4V5L8 9H4Zm13.5-.5a5 5 0 0 1 0 7m2.5-9.5a8 8 0 0 1 0 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
    check: <path d="m5 12.5 4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
    chevron: <path d="m8 5 7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  };

  return <svg {...common}>{icons[name] || icons.bell}</svg>;
}
