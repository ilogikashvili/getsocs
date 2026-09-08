import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import { listTransactions } from '../services/transactionService';
import * as supportService from '../services/supportService';
import axios from '../api/axios';
import './MessagesPage.css';

const POLL_INTERVAL_MS = 5000;

export default function Messages() {
  const { user } = useContext(AuthContext);
  const [transactions, setTransactions] = useState([]);
  const location = useLocation();

  // chat view state
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [txRes] = await Promise.all([listTransactions()]);
      if (txRes.data.success) setTransactions(txRes.data.data || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    // If navigated with support or direct chat id, open it
    if (location.state && location.state.openSupportChatId) {
      openSupportChat(location.state.openSupportChatId);
    }
    if (location.state && location.state.openDirectChatId) {
      // open direct chat by id
      (async () => {
        try {
          const id = location.state.openDirectChatId;
          const res = await axios.get(`/chats/direct/chat/${id}`);
          if (res.data?.success && res.data?.chat) {
            setSelectedConv({ id: res.data.chat.id, type: 'direct' });
            setMessages(res.data.chat.messages || res.data.chat.messages || []);
          }
        } catch (e) { console.error(e); }
      })();
    }
  }, [location, selectedConv]);

  // Build transaction conversation list whenever transactions change
  useEffect(() => {
    const convs = buildConversations(transactions);
    setConversations(convs);
  }, [transactions]);

  // Conversations & chat behavior
  const buildConversations = (txs) => {
    return (txs || []).map(t => ({
      id: t.id,
      type: 'tx',
      title: t.productTitle || t.productId,
      meta: `${t.buyerName || t.buyerId} → ${t.sellerName || t.sellerId}`
    }));
  };

  async function openTransactionChat(txId) {
    try {
      const res = await axios.get(`/chats/${txId}`);
      const data = res.data;
      setSelectedConv({ id: txId, type: 'tx' });
      setMessages(Array.isArray(data) ? data : data?.messages || data?.data || []);
    } catch (e) { console.error(e); setMessages([]); }
  }

  async function openSupportChat(chatId) {
    try {
      let chat;
      if (chatId === 'new') {
        chat = await supportService.createSupportChat();
      } else {
        chat = await supportService.getSupportChat(chatId);
      }

      if (!chat) {
        setMessages([]);
        return;
      }

      setSelectedConv({ id: chat.id, type: 'support' });
      setMessages(chat.messages || []);
    } catch (e) {
      console.error(e);
      setMessages([]);
    }
  }

  async function sendMessage() {
    if (!draft.trim() || !selectedConv) return;
    try {
      if (selectedConv.type === 'support') {
        await supportService.postSupportMessage(selectedConv.id, draft.trim());
        await openSupportChat(selectedConv.id);
      } else if (selectedConv.type === 'direct') {
        await axios.post(`/chats/direct/chat/${selectedConv.id}/message`, { text: draft.trim() });
        const res = await axios.get(`/chats/direct/chat/${selectedConv.id}`);
        setMessages(res.data?.chat?.messages || []);
      } else {
        await axios.post(`/chats/${selectedConv.id}/message`, { text: draft.trim() });
        await openTransactionChat(selectedConv.id);
      }
      setDraft('');
    } catch (e) { console.error(e); }
  }

  useEffect(() => {
    if (!selectedConv) return undefined;

    const refreshMessages = async () => {
      try {
        if (selectedConv.type === 'support') {
          const chat = await supportService.getSupportChat(selectedConv.id);
          setMessages(chat.messages || []);
        } else if (selectedConv.type === 'direct') {
          const response = await axios.get(`/chats/direct/chat/${selectedConv.id}`);
          setMessages(response.data?.chat?.messages || []);
        } else {
          const response = await axios.get(`/chats/${selectedConv.id}`);
          setMessages(response.data?.messages || []);
        }
      } catch (e) {
        // Keep the last visible conversation and retry on the next interval.
      }
    };

    const interval = setInterval(refreshMessages, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [selectedConv]);

  function senderLabel(message, isMine) {
    const role = message.senderRole || message.role;
    const name = message.senderName;
    if (role === 'admin') return `Admin${name ? ` · ${name}` : ''}`;
    if (role === 'escrow') return `Escrow${name ? ` · ${name}` : ''}`;
    return isMine ? 'You' : (name || 'Customer');
  }

  function handleCloseChat() {
    window.location.href = '/';
  }

  const selectedConversation = conversations.find(c => c.id === selectedConv?.id);
  const selectedTransaction = selectedConv?.type === 'tx' ? transactions.find(t => t.id === selectedConv.id) : null;
  const chatTitle = selectedConv
    ? selectedConv.type === 'support'
      ? 'Escrow chat'
      : selectedConversation?.title || `Transaction ${selectedConv.id}`
    : 'No conversation selected';
  const chatSubtitle = selectedConv
    ? selectedConv.type === 'support'
      ? 'Customer support conversation'
      : `${selectedTransaction?.buyerName || selectedTransaction?.buyerId || 'Buyer'} → ${selectedTransaction?.sellerName || selectedTransaction?.sellerId || 'Seller'}`
    : 'Choose a conversation from the left panel';

  return (
    <div className="gs-app messages-page">
      <div className="gs-main">
        <div className="gs-messages-layout">
          <section className="gs-panel gs-conversations">
            <div className="gs-panel-header">
              <div>
                <h2>Conversations</h2>
                <p className="gs-conv-preview">Recent support tickets and transaction chats.</p>
              </div>
              <button className="gs-circle-btn" title="New chat">+</button>
            </div>

            <div className="gs-conv-search">
              <div className="gs-search-icon">🔍</div>
              <input className="gs-search-input" placeholder="Search chat" value="" readOnly />
            </div>

            <div className="gs-conv-list">
              {conversations.map(c => (
                <button
                  key={c.id}
                  className={`gs-conv-item ${selectedConv?.id === c.id ? 'active' : ''}`}
                  onClick={() => openTransactionChat(c.id)}
                >
                  <div className="gs-avatar">{c.title?.slice(0, 2).toUpperCase()}</div>
                  <div className="gs-conv-info">
                    <div className="gs-conv-top">
                      <span className="gs-conv-name">{c.title}</span>
                      <span className="gs-conv-time">{c.type === 'support' ? 'Live' : 'Tx'}</span>
                    </div>
                    <div className="gs-conv-bottom">
                      <div className="gs-conv-preview">{c.meta}</div>
                      <span className="gs-unread-badge">{c.type === 'support' ? 1 : 0}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="gs-escrow-chat-wrapper">
              <button
                className={`gs-escrow-chat-btn ${selectedConv?.type === 'support' ? 'active' : ''}`}
                type="button"
                onClick={() => openSupportChat('new')}
              >
                <span className="gs-avatar sm">E</span>
                <div className="gs-escrow-chat-copy">
                  <span>Escrow agent</span>
                  <small>Bottom support chat</small>
                </div>
                <span className="gs-escrow-status">Live</span>
              </button>
            </div>
          </section>

          <section className="gs-panel gs-thread-panel">
            <div className="gs-thread-header">
              <div className="gs-thread-header-info">
                <h3 className="gs-thread-name">{chatTitle}</h3>
                <p className="gs-thread-status">{chatSubtitle}</p>
              </div>
              <div className="gs-thread-header-actions">
                <button className="gs-circle-btn" title="Refresh">⟳</button>
                <button className="gs-circle-btn" title="More">⋯</button>
                <button className="gs-circle-btn close-chat-btn" title="Close chat" onClick={handleCloseChat}>✕</button>
              </div>
            </div>

            <div className="gs-thread-body">
              {!selectedConv && <div className="gs-day-divider">Select a conversation to begin</div>}
              {messages.length === 0 && selectedConv && (
                <div className="gs-day-divider">No messages yet. Send the first message.</div>
              )}

              {messages.map((m, index) => {
                const isMine = m.userId === (user?.id || user?._id);
                return (
                  <div key={m.id || index} className={`gs-msg-row ${isMine ? 'mine' : 'theirs'}`}>
                    <div className={`gs-msg-bubble ${isMine ? 'mine' : 'theirs'}`}>
                      <div>{m.text || m.message || m.body}</div>
                      <div className="gs-msg-meta">
                        <span>{new Date(m.ts || m.time || m.sentAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span>{senderLabel(m, isMine)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="gs-composer">
              <input
                className="gs-composer-input"
                placeholder="Write a message..."
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
              />
              <button className="gs-send-btn" onClick={sendMessage}>➤</button>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
