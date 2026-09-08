import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import { listTransactions } from '../services/transactionService';
import * as chatService from '../services/chatService';
import * as supportService from '../services/supportService';
import './MessagesPage.css';

const POLL_INTERVAL_MS = 5000;

function initials(value) {
  return String(value || 'GS').slice(0, 2).toUpperCase();
}

function lastMessageText(chat) {
  const message = chat?.messages?.[chat.messages.length - 1];
  return message?.text || message?.message || message?.body || '';
}

function lastMessageTime(chat, fallback) {
  const message = chat?.messages?.[chat.messages.length - 1];
  return message?.ts || message?.time || message?.sentAt || fallback || '';
}

function formatConversationTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const diffMs = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diffMs < minute) return 'Now';
  if (diffMs < hour) return `${Math.floor(diffMs / minute)}m`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}h`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function renderMessageContent(text) {
  const source = String(text || '');
  const nodes = [];
  const pattern = /(\*\*([^*]+)\*\*)|(\[([^\]]+)\]\((https?:\/\/[^)\s]+)\))/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(source))) {
    if (match.index > lastIndex) nodes.push(source.slice(lastIndex, match.index));
    if (match[2]) {
      nodes.push(<strong key={`b-${match.index}`}>{match[2]}</strong>);
    } else if (match[4] && match[5]) {
      nodes.push(
        <a key={`a-${match.index}`} href={match[5]} target="_blank" rel="noreferrer">
          {match[4]}
        </a>
      );
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < source.length) nodes.push(source.slice(lastIndex));
  return nodes;
}

export default function Messages() {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const [transactions, setTransactions] = useState([]);
  const [directChats, setDirectChats] = useState([]);
  const [supportChats, setSupportChats] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadError, setLoadError] = useState('');
  const [conversationError, setConversationError] = useState('');

  const loadData = useCallback(async () => {
    setLoadError('');
    const [txResult, directResult, supportResult] = await Promise.allSettled([
      listTransactions(),
      chatService.getDirectChats(),
      supportService.getSupportChats()
    ]);
    if ([txResult, directResult, supportResult].every(result => result.status === 'rejected')) {
      setLoadError('Unable to load conversations right now. Please try again.');
    }

    if (txResult.status === 'fulfilled' && txResult.value.data.success) {
      setTransactions(txResult.value.data.data || []);
    }
    if (directResult.status === 'fulfilled' && directResult.value.data.success) {
      setDirectChats(directResult.value.data.data || []);
    }
    if (supportResult.status === 'fulfilled') {
      setSupportChats(supportResult.value || []);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const conversations = useMemo(() => {
    const txConversations = (transactions || []).map(tx => ({
      id: tx.id,
      type: 'tx',
      title: tx.productTitle || tx.listingTitle || tx.productId || tx.id,
      meta: `${tx.buyerName || tx.buyerId || 'Buyer'} -> ${tx.sellerName || tx.sellerId || 'Seller'}`,
      updatedAt: tx.updatedAt || tx.createdAt || '',
      badge: 'Tx',
      unreadCount: tx.unreadCount || tx.unread || 0,
      online: tx.buyerOnline || tx.sellerOnline || tx.escrowOnline
    }));

    const directConversations = (directChats || []).map(chat => ({
      id: chat.id,
      type: 'direct',
      title: chat.participantName || 'Direct chat',
      meta: chat.lastMessage || lastMessageText(chat) || 'No messages yet',
      updatedAt: chat.updatedAt || lastMessageTime(chat, chat.createdAt),
      badge: 'DM',
      unreadCount: chat.unreadCount || chat.unread || 0,
      online: chat.online || chat.participantOnline
    }));

    const supportConversations = (supportChats || []).map(chat => ({
      id: chat.id,
      type: 'support',
      title: chat.userName ? `Support: ${chat.userName}` : 'Escrow agent',
      meta: lastMessageText(chat) || (chat.closed ? 'Closed support chat' : 'Support conversation'),
      updatedAt: lastMessageTime(chat, chat.createdAt),
      badge: 'Live',
      unreadCount: chat.unreadCount || chat.unread || 0,
      online: !chat.closed
    }));

    return [...txConversations, ...directConversations, ...supportConversations]
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  }, [transactions, directChats, supportChats]);

  const visibleConversations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter(conversation => (
      `${conversation.title} ${conversation.meta} ${conversation.badge}`
        .toLowerCase()
        .includes(query)
    ));
  }, [conversations, searchQuery]);

  const openTransactionChat = useCallback(async (txId) => {
    setConversationError('');
    try {
      const response = await chatService.getChat(txId);
      setSelectedConv({ id: txId, type: 'tx' });
      setMessages(response.data?.messages || response.data?.chat?.messages || []);
    } catch (e) {
      console.error(e);
      setConversationError('Unable to open this conversation right now.');
      setMessages([]);
    }
  }, []);

  const openDirectChat = useCallback(async (chatId) => {
    setConversationError('');
    try {
      const response = await chatService.getDirectChat(chatId);
      const chat = response.data?.chat || response.data?.data;
      setSelectedConv({ id: chatId, type: 'direct' });
      setMessages(chat?.messages || []);
    } catch (e) {
      console.error(e);
      setConversationError('Unable to open this conversation right now.');
      setMessages([]);
    }
  }, []);

  const openSupportChat = useCallback(async (chatId) => {
    setConversationError('');
    try {
      const chat = chatId === 'new'
        ? await supportService.createSupportChat()
        : await supportService.getSupportChat(chatId);
      if (!chat) {
        setMessages([]);
        return;
      }
      setSelectedConv({ id: chat.id, type: 'support' });
      setMessages(chat.messages || []);
      await loadData();
    } catch (e) {
      console.error(e);
      setConversationError('Unable to open this conversation right now.');
      setMessages([]);
    }
  }, [loadData]);

  const openConversation = useCallback((conversation) => {
    if (conversation.type === 'support') return openSupportChat(conversation.id);
    if (conversation.type === 'direct') return openDirectChat(conversation.id);
    return openTransactionChat(conversation.id);
  }, [openDirectChat, openSupportChat, openTransactionChat]);

  useEffect(() => {
    const openTransactionId = location.state?.openTransactionId;
    const openSupportChatId = location.state?.openSupportChatId;
    if (openTransactionId) openTransactionChat(openTransactionId);
    if (openSupportChatId) openSupportChat(openSupportChatId);
  }, [location.state, openSupportChat, openTransactionChat]);

  const selectedConvId = selectedConv?.id;
  const selectedConvType = selectedConv?.type;

  useEffect(() => {
    if (!selectedConvId || !selectedConvType) return undefined;

    const refreshMessages = async () => {
      try {
        if (selectedConvType === 'support') {
          const chat = await supportService.getSupportChat(selectedConvId);
          setMessages(chat?.messages || []);
        } else if (selectedConvType === 'direct') {
          const response = await chatService.getDirectChat(selectedConvId);
          setMessages(response.data?.chat?.messages || response.data?.data?.messages || []);
        } else {
          const response = await chatService.getChat(selectedConvId);
          setMessages(response.data?.messages || response.data?.chat?.messages || []);
        }
      } catch (e) {}
    };

    const interval = setInterval(refreshMessages, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [selectedConvId, selectedConvType]);

  async function sendMessage() {
    if (!draft.trim() || !selectedConv) return;
    try {
      if (selectedConv.type === 'support') {
        await supportService.postSupportMessage(selectedConv.id, draft.trim());
        await openSupportChat(selectedConv.id);
      } else if (selectedConv.type === 'direct') {
        await chatService.postDirectMessage(selectedConv.id, draft.trim());
        await openDirectChat(selectedConv.id);
      } else {
        await chatService.postMessage(selectedConv.id, draft.trim());
        await openTransactionChat(selectedConv.id);
      }
      setDraft('');
      await loadData();
    } catch (e) {
      console.error(e);
    }
  }

  function senderLabel(message, isMine) {
    const role = message.senderRole || message.role;
    const name = message.senderName;
    if (role === 'admin') return `Admin${name ? ` - ${name}` : ''}`;
    if (role === 'escrow') return `Escrow${name ? ` - ${name}` : ''}`;
    return isMine ? 'You' : (name || 'Customer');
  }

  function handleCloseChat() {
    window.location.href = '/';
  }

  const selectedConversation = conversations.find(c => c.id === selectedConv?.id && c.type === selectedConv?.type);
  const selectedTransaction = selectedConv?.type === 'tx' ? transactions.find(t => t.id === selectedConv.id) : null;
  const chatTitle = selectedConv
    ? selectedConversation?.title || (selectedConv.type === 'tx' ? `Transaction ${selectedConv.id}` : 'Conversation')
    : 'No conversation selected';
  const chatSubtitle = selectedConv
    ? selectedConv.type === 'support'
      ? 'Customer support conversation'
      : selectedConv.type === 'direct'
        ? 'Direct message'
        : `${selectedTransaction?.buyerName || selectedTransaction?.buyerId || 'Buyer'} -> ${selectedTransaction?.sellerName || selectedTransaction?.sellerId || 'Seller'}`
    : 'Choose a conversation from the left panel';
  const selectedInitials = selectedConv ? initials(chatTitle) : 'GS';

  return (
    <div className="gs-app messages-page">
      <div className="gs-main">
        <div className={`gs-messages-layout ${selectedConv ? 'has-active-thread' : ''}`}>
          <section className="gs-panel gs-conversations">
            <div className="gs-panel-header">
              <div>
                <h2>Conversations</h2>
                <p className="gs-conv-preview">Recent support tickets and transaction chats.</p>
              </div>
              <button className="gs-circle-btn" type="button" title="New support chat" onClick={() => openSupportChat('new')}>+</button>
            </div>

            <div className="gs-conv-search">
              <input
                className="gs-search-input"
                aria-label="Search conversations"
                placeholder="Search chat"
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
              />
            </div>

            <div className="gs-conv-list">
              {loadError && <div className="gs-day-divider" role="alert">{loadError}</div>}
              {visibleConversations.map(conversation => (
                <button
                  key={`${conversation.type}-${conversation.id}`}
                  className={`gs-conv-item ${selectedConv?.id === conversation.id && selectedConv?.type === conversation.type ? 'active' : ''}`}
                  onClick={() => openConversation(conversation)}
                  type="button"
                >
                  <div className="gs-avatar">
                    {initials(conversation.title)}
                    {conversation.online && <span className="gs-online-dot" />}
                  </div>
                  <div className="gs-conv-info">
                    <div className="gs-conv-top">
                      <span className="gs-conv-name">{conversation.title}</span>
                      <span className="gs-conv-time">{formatConversationTime(conversation.updatedAt) || conversation.badge}</span>
                    </div>
                    <div className="gs-conv-bottom">
                      <div className="gs-conv-preview">{conversation.meta}</div>
                      {Number(conversation.unreadCount) > 0 && (
                        <span className="gs-unread-badge">{conversation.unreadCount}</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
              {visibleConversations.length === 0 && (
                <div className="gs-day-divider">No conversations found</div>
              )}
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
                  <small>Support chat</small>
                </div>
                <span className="gs-escrow-status">Live</span>
              </button>
            </div>
          </section>

          <section className="gs-panel gs-thread-panel">
            <div className="gs-thread-header">
              <div className="gs-thread-avatar gs-avatar">{selectedInitials}</div>
              <div className="gs-thread-header-info">
                <h3 className="gs-thread-name">{chatTitle}</h3>
                <p className="gs-thread-status">{chatSubtitle}</p>
              </div>
              <div className="gs-thread-header-actions">
                <button className="gs-circle-btn" type="button" title="Refresh" aria-label="Refresh" onClick={loadData}>R</button>
                <button
                  className="gs-thread-back"
                  type="button"
                  aria-label="Back to conversations"
                  title="Back to conversations"
                  onClick={() => {
                    setSelectedConv(null);
                    setMessages([]);
                  }}
                >
                  List
                </button>
                <button className="gs-circle-btn close-chat-btn" type="button" title="Close chat" aria-label="Close chat" onClick={handleCloseChat}>X</button>
              </div>
            </div>

            <div className="gs-thread-body">
              {conversationError && <div className="gs-day-divider" role="alert">{conversationError}</div>}
              {!selectedConv && <div className="gs-day-divider">Select a conversation to begin</div>}
              {messages.length === 0 && selectedConv && (
                <div className="gs-day-divider">No messages yet. Send the first message.</div>
              )}

              {messages.map((message, index) => {
                const isMine = message.userId === (user?.id || user?._id);
                return (
                  <div key={message.id || index} className={`gs-msg-row ${isMine ? 'mine' : 'theirs'}`}>
                    <div className={`gs-msg-bubble ${isMine ? 'mine' : 'theirs'}`}>
                      <div className="gs-msg-text">{renderMessageContent(message.text || message.message || message.body)}</div>
                      <div className="gs-msg-meta">
                        <span>{new Date(message.ts || message.time || message.sentAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <span>{senderLabel(message, isMine)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="gs-composer">
              <input
                className="gs-composer-input"
                aria-label="Message"
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
              <button className="gs-send-btn" type="button" onClick={sendMessage}>Send</button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
