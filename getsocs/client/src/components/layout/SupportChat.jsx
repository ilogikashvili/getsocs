import React, { useState, useEffect, useContext } from 'react';
import { useLocation } from 'react-router-dom';
import AuthContext from '../../context/AuthContext';
import * as supportService from '../../services/supportService';
import '../../css/SupportChat.css';
import { useNavigate } from 'react-router-dom';

const NOTIFICATION_POLL_MS = 20000;

function SupportChat() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return undefined;
    let mounted = true;
    async function poll() {
      const count = await supportService.getUnreadCount();
      if (mounted) setUnreadCount(count);
    }
    poll();
    const interval = setInterval(poll, NOTIFICATION_POLL_MS);
    return () => { mounted = false; clearInterval(interval); };
  }, [user]);

  if (!user) return null;

  // Hide support chat floating button when already on the messages page
  if (location && location.pathname && location.pathname.startsWith('/messages')) return null;

  return (
    <button
      type="button"
      className="support-chat-button support-chat-icon"
      onClick={() => navigate('/messages', { state: { openSupportChatId: 'new' } })}
      title={unreadCount > 0 ? `${unreadCount} chat${unreadCount > 1 ? 's' : ''} need your attention` : 'Escrow chat'}
    >
      {unreadCount > 0 && <span className="chat-notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      <span className="chat-icon">💬</span>
    </button>
  );
}

export default SupportChat;
