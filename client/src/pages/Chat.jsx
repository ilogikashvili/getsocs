import React, { useCallback, useState, useEffect, useContext } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import axios from '../api/axios';
import * as chatService from '../services/chatService';
import * as transactionService from '../services/transactionService';
import { getProducts } from '../services/productService';
import ReviewsSection from '../components/reviews/ReviewsSection';

const POLL_INTERVAL_MS = 8000;

const PAYMENT_METHOD_LABELS = {
  card: 'Debit / Credit Card',
  paypal: 'PayPal',
  crypto: 'Crypto (USDT / Binance)',
  bank_transfer: 'Bank Transfer'
};

function formatCurrency(value) {
  const amount = Number(value) || 0;
  return `₾${amount.toLocaleString()}`;
}

function CredentialCountdown({ holdUntil }) {
  const [remainingMs, setRemainingMs] = useState(() => new Date(holdUntil).getTime() - Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setRemainingMs(new Date(holdUntil).getTime() - Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [holdUntil]);

  if (remainingMs <= 0) {
    return <div className="credential-countdown expired">7-day holding period has ended.</div>;
  }

  const totalSeconds = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalSeconds / (24 * 60 * 60));
  const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return (
    <div className="credential-countdown">
      <span>Ownership transfer window:</span>
      <strong>{days}d {String(hours).padStart(2, '0')}h {String(minutes).padStart(2, '0')}m {String(seconds).padStart(2, '0')}s</strong>
    </div>
  );
}

export default function Chat() {
  const { user } = useContext(AuthContext);
  const { txId } = useParams();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [selectedTx, setSelectedTx] = useState(null);
  const [messages, setMessages] = useState([]);
  const [readAt, setReadAt] = useState({});
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [otherProfile, setOtherProfile] = useState(null);
  const [otherListings, setOtherListings] = useState([]);

  const selectTransaction = useCallback(async (tx) => {
    try {
      setChatLoading(true);
      setSelectedTx(tx);
      const response = await chatService.getChat(tx.id);
      if (response.data.success) {
        setMessages(response.data.messages || []);
        setReadAt(response.data.chat?.readAt || {});
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load chat');
    } finally {
      setChatLoading(false);
    }
  }, []);

  const loadTransactions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await transactionService.listTransactions();
      if (response.data.success) {
        const loadedTransactions = response.data.data || [];
        setTransactions(loadedTransactions);
        if (loadedTransactions.length > 0) {
          const routeTransaction = txId ? loadedTransactions.find(tx => tx.id === txId) : null;
          await selectTransaction(routeTransaction || loadedTransactions[0]);
        }
      }
    } catch (err) {
      setError('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [selectTransaction, txId]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  // Poll the open chat for new messages / presence / read receipts
  useEffect(() => {
    if (!selectedTx) return undefined;
    const interval = setInterval(async () => {
      try {
        const response = await chatService.getChat(selectedTx.id);
        if (response.data.success) {
          setMessages(response.data.messages || []);
          setReadAt(response.data.chat?.readAt || {});
          if (response.data.presence) {
            setSelectedTx(prev => (prev ? {
              ...prev,
              buyerOnline: response.data.presence.buyerOnline,
              sellerOnline: response.data.presence.sellerOnline,
              escrowOnline: response.data.presence.escrowOnline,
              escrowName: response.data.presence.escrowName || prev.escrowName
            } : prev));
          }
        }
      } catch (err) {
        // silent - next poll will retry
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTx?.id]);

  function handleSelectTransaction(tx) {
    navigate(`/messages/${tx.id}`);
    selectTransaction(tx);
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedTx) return;

    try {
      const response = await chatService.postMessage(selectedTx.id, newMessage);
      if (response.data.success) {
        setMessages(prev => [...prev, response.data.message]);
        setNewMessage('');
        if (response.data.tx) {
          setSelectedTx(prev => ({ ...prev, ...response.data.tx }));
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send message');
    }
  };

  function handleTagEscrow() {
    setNewMessage(prev => (prev.trim() ? `${prev.trim()} @escrow ` : '@escrow '));
  }

  const getOtherPartyName = (tx) => {
    if (tx.buyerId === user.id) {
      return tx.sellerName || 'Seller';
    } else {
      return tx.buyerName || 'Buyer';
    }
  };

  const getOtherPartyOnline = (tx) => {
    if (!tx) return false;
    return tx.buyerId === user.id ? !!tx.sellerOnline : !!tx.buyerOnline;
  };

  const getOtherPartyId = (tx) => {
    if (!tx) return null;
    return tx.buyerId === user.id ? tx.sellerId : tx.buyerId;
  };

  useEffect(() => {
    const otherId = getOtherPartyId(selectedTx);
    if (!otherId) {
      setOtherProfile(null);
      setOtherListings([]);
      return undefined;
    }
    let mounted = true;
    (async () => {
      try {
        const [profileRes, productsRes] = await Promise.all([
          axios.get(`/auth/profile/${otherId}`),
          getProducts()
        ]);
        if (!mounted) return;
        setOtherProfile(profileRes.data.success ? profileRes.data.data : null);
        const allProducts = Array.isArray(productsRes.data?.data) ? productsRes.data.data : (productsRes.data || []);
        setOtherListings(allProducts.filter(p => p.sellerId === otherId && p.id !== selectedTx.productId).slice(0, 4));
      } catch (e) {
        if (mounted) { setOtherProfile(null); setOtherListings([]); }
      }
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTx?.id]);

  function messageTicks(msg) {
    if (msg.userId !== user.id) return null;
    const otherId = getOtherPartyId(selectedTx);
    const escrowId = selectedTx?.escrowId;
    const seenByOther = otherId && readAt[otherId] && readAt[otherId] >= msg.ts;
    const seenByEscrow = escrowId && escrowId !== otherId && readAt[escrowId] && readAt[escrowId] >= msg.ts;
    return (
      <span className="message-ticks">
        <span className={`tick ${seenByOther ? 'tick-seen' : ''}`}>✓</span>
        {escrowId && <span className={`tick tick-escrow ${seenByEscrow ? 'tick-seen' : ''}`}>✓</span>}
      </span>
    );
  }

  function senderLabel(msg) {
    const role = msg.senderRole || msg.role;
    if (role === 'admin') return `Admin${msg.senderName ? ` · ${msg.senderName}` : ''}`;
    if (role === 'escrow') return `Escrow${msg.senderName ? ` · ${msg.senderName}` : ''}`;
    return msg.senderName || 'Customer';
  }

  if (loading) {
    return (
      <div className="chat-page">
        <div className="chat-loading">Loading chats...</div>
      </div>
    );
  }

  return (
    <div className="chat-page">
      <div className="chat-container">
        {/* Contacts/Transactions List - Left Panel */}
        <div className="chat-sidebar">
          <div className="chat-sidebar-header">
            <h3>Messages</h3>
          </div>

          {error && <div className="chat-error">{error}</div>}

          <div className="chat-list">
            {transactions.length === 0 ? (
              <div className="no-chats">No transactions yet</div>
            ) : (
              transactions.map(tx => (
                <div
                  key={tx.id}
                  className={`chat-item ${selectedTx?.id === tx.id ? 'active' : ''}`}
                  onClick={() => handleSelectTransaction(tx)}
                >
                  <div className="chat-item-header">
                    <strong>
                      <span className={`presence-dot ${getOtherPartyOnline(tx) ? 'online' : 'offline'}`} />
                      {getOtherPartyName(tx)}
                    </strong>
                    <span className="chat-status-badge">{tx.status}</span>
                  </div>
                  <div className="chat-item-ids">
                    <span>Order #{tx.id}</span>
                  </div>
                  <div className="chat-item-product">
                    {tx.productTitle || 'Product'}
                  </div>
                  <div className="chat-item-price">
                    ₾{tx.productPrice || 0}
                  </div>
                </div>
              ))
            )}
          </div>

          <button type="button" className="chat-escrow-quicklink" onClick={() => navigate('/support')}>
            <span className="presence-dot online" />
            <span>Escrow agent</span>
          </button>
        </div>

        {/* Chat View - Right Panel */}
        <div className="chat-main">
          {selectedTx ? (
            <>
              {selectedTx.escrowName && (
                <div className="escrow-pinned-card">
                  <span className="presence-dot online" />
                  <div>
                    <strong>{selectedTx.escrowName}</strong>
                    <small>Escrow agent handling this deal</small>
                  </div>
                </div>
              )}

              <div className="deal-specs-card">
                <div className="deal-specs-title">
                  Request to purchase &quot;{selectedTx.productTitle}&quot;
                </div>
                <div className="deal-specs-grid">
                  <div><span>Deal ID</span><strong>{selectedTx.id}</strong></div>
                  <div><span>Price</span><strong>{formatCurrency(selectedTx.productPrice)}</strong></div>
                  <div><span>Service fee</span><strong>{formatCurrency(selectedTx.serviceFee)}</strong></div>
                  <div><span>Total</span><strong>{formatCurrency(selectedTx.totalPrice || selectedTx.productPrice)}</strong></div>
                  <div><span>Payment method</span><strong>{PAYMENT_METHOD_LABELS[selectedTx.paymentMethod] || 'Card'}</strong></div>
                  <div><span>Status</span><strong className={`status-pill status-${selectedTx.status}`}>{selectedTx.status}</strong></div>
                </div>
                <ol className="deal-specs-steps">
                  <li>The buyer pays the cost of the channel plus the escrow service fee.</li>
                  <li>The seller designates the escrow agent as owner.</li>
                  <li>The escrow agent verifies everything and assigns manager rights to the buyer.</li>
                  <li>After 7 days, the escrow agent removes other managers and assigns primary ownership to the buyer.</li>
                  <li>Funds are released to the seller once the transfer is confirmed.</li>
                </ol>
                {selectedTx.credentialsHoldUntil && (
                  <CredentialCountdown holdUntil={selectedTx.credentialsHoldUntil} />
                )}
              </div>

              {/* Chat Header */}
              <div className="chat-header">
                <div className="chat-header-info">
                  <h3>
                    <span className={`presence-dot ${getOtherPartyOnline(selectedTx) ? 'online' : 'offline'}`} />
                    {getOtherPartyName(selectedTx)}
                  </h3>
                  <p className="chat-product-info">{selectedTx.productTitle} · ₾{selectedTx.productPrice}</p>
                  <p className="chat-deal-ids">
                    <span>Order ID: {selectedTx.id}</span>
                    <span>Deal ID: {selectedTx.id}</span>
                  </p>
                </div>
                <div className="chat-header-status">
                  <span className={`status-badge status-${selectedTx.status}`}>
                    {selectedTx.status.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Messages */}
              <div className="chat-messages">
                {chatLoading ? (
                  <div className="loading-chat">Loading messages...</div>
                ) : messages.length === 0 ? (
                  <div className="no-messages">Start the conversation!</div>
                ) : (
                  messages.map(msg => (
                    <div
                      key={msg.id}
                      className={`message-row ${msg.userId === user.id ? 'sent' : 'received'} ${msg.escrow ? 'escrow-message' : ''} ${msg.taggedEscrow ? 'tagged-escrow' : ''}`}
                    >
                      <div className="message-bubble">
                        {(msg.senderRole === 'admin' || msg.senderRole === 'escrow' || msg.escrow) && <div className="message-author-tag">{senderLabel(msg)}</div>}
                        <div className="message-text">{msg.text}</div>
                        <div className="message-time">
                          {new Date(msg.ts).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                          {messageTicks(msg)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Message Input */}
              <div className="chat-input-area">
                <button
                  type="button"
                  className="chat-tag-escrow-btn"
                  onClick={handleTagEscrow}
                  title="Tag escrow into this chat"
                >
                  @Escrow
                </button>
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Type a message..."
                  className="chat-input"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                  className="chat-send-btn"
                >
                  Send
                </button>
              </div>
            </>
          ) : (
            <div className="no-transaction-selected">
              <div>Select a conversation to start chatting</div>
            </div>
          )}
        </div>

        {selectedTx && (
          <aside className="chat-info-panel">
            <div className="chat-info-avatar-block">
              <div className="chat-info-avatar">
                {getOtherPartyName(selectedTx).slice(0, 2).toUpperCase()}
              </div>
              <strong>{getOtherPartyName(selectedTx)}</strong>
              <span className={`chat-info-presence ${getOtherPartyOnline(selectedTx) ? 'online' : 'offline'}`}>
                {getOtherPartyOnline(selectedTx) ? 'Online now' : 'Offline'}
              </span>
            </div>

            {otherProfile && !otherProfile.hidden && (
              <div className="chat-info-rows">
                <div className="chat-info-row">
                  <span>Verified seller</span>
                  <span>{otherProfile.verified ? '✅ Yes' : '— No'}</span>
                </div>
                <div className="chat-info-row">
                  <span>Verified buyer</span>
                  <span>{otherProfile.buyerVerified ? '✅ Yes' : '— No'}</span>
                </div>
                <div className="chat-info-row">
                  <span>Channels sold</span>
                  <span>{otherProfile.sellerInfo?.pointsSold || 0}</span>
                </div>
                <div className="chat-info-row">
                  <span>Channels bought</span>
                  <span>{otherProfile.sellerInfo?.pointsBought || 0}</span>
                </div>
              </div>
            )}

            <div className="chat-info-listings">
              <h4>Other listings from this user</h4>
              {otherListings.length ? (
                <div className="chat-info-listing-grid">
                  {otherListings.map(item => (
                    <Link key={item.id} className="chat-info-listing-card" to={`/product/${item.id}`}>
                      <strong>{item.title}</strong>
                      <small>{formatCurrency(item.price)}</small>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="chat-info-empty">No other active listings right now.</p>
              )}
            </div>

            {selectedTx.status === 'completed' && (
              <>
                <ReviewsSection
                  targetId={getOtherPartyId(selectedTx)}
                  type={selectedTx.buyerId === user.id ? 'seller' : 'buyer'}
                  currentUserId={user.id}
                  canReview={true}
                  transactionId={selectedTx.id}
                  title={`Review ${getOtherPartyName(selectedTx)}`}
                />
                {selectedTx.escrowId && (
                  <ReviewsSection
                    targetId={selectedTx.escrowId}
                    type="escrow"
                    currentUserId={user.id}
                    canReview={true}
                    transactionId={selectedTx.id}
                    title={`Review ${selectedTx.escrowName || 'the escrow agent'}`}
                  />
                )}
              </>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
