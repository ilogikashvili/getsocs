import React, { useEffect, useState, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import * as supportService from '../services/supportService';
import '../css/AdminChat.css';

export default function AdminChat() {
  const { chatId } = useParams();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);

  function senderLabel(message) {
    const role = message.senderRole || message.role;
    if (role === 'admin') return `Admin${message.senderName ? ` · ${message.senderName}` : ''}`;
    if (role === 'escrow') return `Escrow${message.senderName ? ` · ${message.senderName}` : ''}`;
    return message.senderName || 'Customer';
  }

  useEffect(() => {
    let mounted = true;
    let initialLoad = true;
    async function load() {
      try {
        if (mounted && initialLoad) setLoading(true);
        const sc = await supportService.getSupportChat(chatId);
        if (mounted) {
          setChat(sc);
          setMessages(sc.messages || []);
        }
      } catch (e) {
        // If not a support chat, try transaction chat route (handled elsewhere)
        console.error('Failed to load support chat', e);
      } finally {
        if (mounted && initialLoad) setLoading(false);
        initialLoad = false;
      }
    }
    load();
    const interval = setInterval(load, 5000);
    return () => { mounted = false; clearInterval(interval); };
  }, [chatId]);

  async function send() {
    if (!text.trim()) return;
    try {
      const m = await supportService.postSupportMessage(chat.id, text.trim());
      setMessages(prev => [...prev, m]);
      setText('');
    } catch (e) {
      console.error(e);
      alert('Failed to send message');
    }
  }

  if (!user) return null;

  return (
    <div className="admin-chat-page">
      <aside className="admin-chat-left">
        <h3>Conversations</h3>
        {/* For now, navigation back to admin */}
        <button className="back-to-admin" onClick={() => navigate('/admin')}>← Back to Admin</button>
      </aside>

      <main className="admin-chat-main">
        <div className="chat-header">{chat ? `Chat — ${chat.userName || chat.userId || chat.id}` : 'Chat'}</div>
        <div className="chat-messages">
          {loading ? <div className="loading">Loading...</div> : (
            messages.length === 0 ? <div className="no-messages">No messages yet</div> : (
              messages.map(m => (
                <div key={m.id} className={`message ${m.userId === user.id ? 'mine' : 'theirs'}`}>
                  {(m.senderRole === 'admin' || m.senderRole === 'escrow' || m.escrow) && <div className="message-author-tag">{senderLabel(m)}</div>}
                  <div className="message-text">{m.text}</div>
                  <div className="message-time">{new Date(m.ts).toLocaleString()}</div>
                </div>
              ))
            )
          )}
        </div>

        <div className="chat-input-row">
          <input value={text} onChange={e => setText(e.target.value)} placeholder="Enter your message" />
          <button onClick={send}>Send</button>
        </div>
      </main>

      <aside className="admin-chat-right">
        <div className="user-card">
          <div className="avatar-circle">{((chat?.userName || chat?.userId) || '').slice(0,2).toUpperCase()}</div>
          <div className="user-meta">
            <h4>{chat?.userName || chat?.userId || 'User'}</h4>
            <p className="sub">Support conversation</p>
          </div>
        </div>
      </aside>
    </div>
  );
}
