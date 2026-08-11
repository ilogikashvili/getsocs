import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import * as supportService from '../services/supportService';
import '../css/Chat.css';

const POLL_INTERVAL_MS = 8000;

export default function SupportChatPage() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const isStaff = user?.role === 'admin' || user?.role === 'escrow';

  function senderLabel(msg) {
    const role = msg.senderRole || msg.role;
    if (role === 'admin') return `Admin${msg.senderName ? ` · ${msg.senderName}` : ''}`;
    if (role === 'escrow') return `Escrow${msg.senderName ? ` · ${msg.senderName}` : ''}`;
    return msg.senderName || 'Customer';
  }

  const openOwnChat = useCallback(async () => {
    const chat = await supportService.createSupportChat();
    setActiveChat(chat);
    return chat;
  }, []);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      if (isStaff) {
        const list = await supportService.getSupportChats();
        setChats(list);
        if (list.length) {
          const fresh = await supportService.getSupportChat(list[0].id);
          setActiveChat(fresh);
        }
      } else {
        const chat = await openOwnChat();
        setChats([chat]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [isStaff, openOwnChat]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (!activeChat) return undefined;
    const interval = setInterval(async () => {
      try {
        const fresh = await supportService.getSupportChat(activeChat.id);
        setActiveChat(fresh);
      } catch (e) { /* ignore, retry next tick */ }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [activeChat?.id]);

  async function selectChat(chatId) {
    const chat = await supportService.getSupportChat(chatId);
    setActiveChat(chat);
  }

  async function handleSend() {
    if (!newMessage.trim() || !activeChat) return;
    await supportService.postSupportMessage(activeChat.id, newMessage.trim());
    const fresh = await supportService.getSupportChat(activeChat.id);
    setActiveChat(fresh);
    setNewMessage('');
  }

  if (loading) {
    return <div className="chat-page"><div className="chat-loading">Loading escrow support...</div></div>;
  }

  return (
    <div className="chat-page">
      <div className="chat-container">
        <div className="chat-sidebar">
          <div className="chat-sidebar-header">
            <h3>Escrow Support</h3>
          </div>
          <div className="chat-list">
            {isStaff ? (
              chats.length === 0 ? (
                <div className="no-chats">No support tickets yet</div>
              ) : (
                chats.map(c => (
                  <div
                    key={c.id}
                    className={`chat-item ${activeChat?.id === c.id ? 'active' : ''}`}
                    onClick={() => selectChat(c.id)}
                  >
                    <div className="chat-item-header">
                      <strong>{c.userName || `User ${c.userId?.slice(0, 6)}`}</strong>
                      {c.banned && <span className="banned-badge">BANNED</span>}
                    </div>
                    <div className="chat-item-ids"><span>Ticket #{c.id}</span></div>
                    <div className="chat-item-product">
                      {c.assignedToName ? `Handled by ${c.assignedToName}` : 'Unassigned'}
                    </div>
                  </div>
                ))
              )
            ) : (
              <div className="chat-item active">
                <div className="chat-item-header">
                  <strong><span className="presence-dot online" />Escrow team</strong>
                </div>
                <div className="chat-item-product">We usually reply within a few minutes.</div>
              </div>
            )}
          </div>
          <button type="button" className="btn secondary" style={{ margin: 12 }} onClick={() => navigate('/messages')}>
            ← Back to my deals
          </button>
        </div>

        <div className="chat-main">
          {activeChat ? (
            <>
              <div className="chat-header">
                <div className="chat-header-info">
                  <h3><span className="presence-dot online" />{isStaff ? (activeChat.userName || 'Customer') : 'Escrow team'}</h3>
                  <p className="chat-product-info">Support ticket #{activeChat.id}</p>
                </div>
              </div>

              <div className="chat-messages">
                {(!activeChat.messages || activeChat.messages.length === 0) ? (
                  <div className="no-messages">Start the conversation!</div>
                ) : (
                  activeChat.messages.map(msg => (
                    <div key={msg.id} className={`message-row ${msg.userId === user.id ? 'sent' : 'received'} ${msg.escrow ? 'escrow-message' : ''}`}>
                      <div className="message-bubble">
                        {(msg.senderRole === 'admin' || msg.senderRole === 'escrow' || msg.escrow) && <div className="message-author-tag">{senderLabel(msg)}</div>}
                        <div className="message-text">{msg.text}</div>
                        <div className="message-time">
                          {new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="chat-input-area">
                <input
                  type="text"
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyPress={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="Type a message..."
                  className="chat-input"
                />
                <button onClick={handleSend} disabled={!newMessage.trim()} className="chat-send-btn">Send</button>
              </div>
            </>
          ) : (
            <div className="no-transaction-selected"><div>Select a ticket to start chatting</div></div>
          )}
        </div>
      </div>
    </div>
  );
}
