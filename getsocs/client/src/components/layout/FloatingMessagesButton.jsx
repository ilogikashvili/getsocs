import React from 'react';
import { useNavigate } from 'react-router-dom';

function ChatBubbleIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M8 6h16a5 5 0 0 1 5 5v6a5 5 0 0 1-5 5h-3l-5 5v-5H8a5 5 0 0 1-5-5v-6a5 5 0 0 1 5-5Z" fill="#7fb3ff" opacity=".55" />
      <path d="M11 10h13a4 4 0 0 1 4 4v4a4 4 0 0 1-4 4h-2.4L17 26.5V22h-6a4 4 0 0 1-4-4v-4a4 4 0 0 1 4-4Z" fill="#1a73e8" />
    </svg>
  );
}

export default function FloatingMessagesButton() {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      className="floating-messages-btn"
      onClick={() => navigate('/messages')}
      title="Messages"
      aria-label="Go to messages"
    >
      <span className="floating-messages-halo" aria-hidden="true" />
      <ChatBubbleIcon />
    </button>
  );
}
