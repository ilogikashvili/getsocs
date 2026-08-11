import React, { useEffect, useState } from 'react';
import { getSupportChat, postSupportMessage } from '../../services/supportService';
import { getDirectChat, postDirectMessage } from '../../services/chatService';
import { getChat, postMessage } from '../../services/chatService';
import { listTransactions } from '../../services/transactionService';
import axios from '../../api/axios';

export default function ChatPanel({ type = 'support', id, onClose }) {
  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [userInfo, setUserInfo] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [txHistory, setTxHistory] = useState([]);
  const [txData, setTxData] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const me = await axios.get('/auth/me');
        setCurrentUser(me.data.user || null);
        if (type === 'support') {
          const res = await getSupportChat(id);
          setChat(res);
          setMessages(res.messages || []);
          if (mounted) setUserInfo(null); // we show user info from chat data instead
          if (res.userId) {
            const publicRes = await axios.get(`/auth/profile/${res.userId}`);
            if (mounted) setUserInfo(publicRes.data.data || null);
          }
        } else if (type === 'direct') {
          const res = await getDirectChat(id);
          setChat(res.data.chat);
          setMessages(res.data.chat.messages || []);
          const meId = me.data.user?.id;
          const otherId = res.data.chat.participants.find(pid => pid !== meId);
          if (otherId) {
            const publicRes = await axios.get(`/auth/profile/${otherId}`);
            setUserInfo(publicRes.data.data || null);
          }
        } else if (type === 'tx') {
          const res = await getChat(id);
          setChat(res.data);
          setMessages(res.data.messages || []);
          // fetch transaction and participants
          const txRes = await axios.get(`/transactions/${id}`);
          setTxData(txRes.data.data);
          setUserInfo({ tx: txRes.data.data });
          // get history between buyer and seller
          const allTx = await listTransactions();
          const list = (allTx.data || []).filter(t => t.buyerId === txRes.data.data.buyerId || t.sellerId === txRes.data.data.sellerId);
          setTxHistory(list);
        }
      } catch (e) {
        console.error(e);
      }
    }
    load();
    return () => { mounted = false; };
  }, [type, id]);

  async function handleSend() {
    if (!text.trim()) return;
    try {
      let sent = null;
      if (type === 'support') {
        sent = await postSupportMessage(id, text.trim());
      } else if (type === 'direct') {
        const res = await postDirectMessage(id, text.trim());
        sent = res?.data?.message;
      } else if (type === 'tx') {
        const res = await postMessage(id, text.trim());
        sent = res?.data?.message;
      }

      if (sent && sent.id) {
        setMessages(prev => [...prev, sent]);
      } else {
        // fallback optimistic append
        setMessages(prev => [...prev, { id: Date.now().toString(), userId: currentUser?.id || 'me', text: text.trim(), ts: new Date().toISOString() }]);
      }
      setText('');
    } catch (e) {
      console.error(e);
      alert('Unable to send message');
    }
  }

  async function handleAssign() {
    try {
      const { assignSupportChat } = await import('../../services/supportService');
      const updated = await assignSupportChat(id);
      setChat(updated);
      setMessages(updated?.messages || []);
    } catch (e) { console.error(e); alert('Unable to assign chat'); }
  }

  async function handleAssignTxEscrow() {
    try {
      await axios.post(`/transactions/${id}/assign-escrow`);
      const txRes = await axios.get(`/transactions/${id}`);
      setTxData(txRes.data.data);
      // reload tx chat messages after assignment
      const chatRes = await getChat(id);
      const msgs = chatRes?.data?.messages || chatRes?.messages || [];
      setMessages(msgs);
    } catch (e) { console.error(e); alert('Unable to assign escrow to transaction'); }
  }

  return (
    <div className="admin-chat-panel">
      <div className="chat-left">
        {userInfo ? (
          <div className="chat-user-info">
            <div className="user-photo">{userInfo.profilePhoto ? <img src={`/uploads/${userInfo.profilePhoto}`} alt="avatar" /> : <div className="avatar-placeholder">{(userInfo.username||'')[0]}</div>}</div>
            <div className="user-meta">
              <strong>{userInfo.username}</strong>
              {userInfo.name && <div className="small">{userInfo.name} {userInfo.lastname || ''}</div>}
              {userInfo.sellerInfo && <div className="small">Listings: {userInfo.sellerInfo.pointsSold || 0}</div>}
            </div>
          </div>
        ) : (
          <div className="chat-user-info">No user info</div>
        )}

        {txHistory.length > 0 && (
          <div className="tx-history">
            <h4>Transaction history</h4>
            {txHistory.map(tx => (
              <div key={tx.id} className="tx-item">
                <div>{tx.id}</div>
                <div>{tx.amount || tx.price || '—'}</div>
                <div className={`badge badge-${tx.status === 'completed' ? 'success' : 'warning'}`}>{tx.status}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="chat-main">
        <div className="chat-header">
          <div style={{display:'flex',gap:12,alignItems:'center'}}>
            <strong>Chat</strong>
            {type === 'support' && currentUser && (currentUser.role === 'admin' || currentUser.role === 'escrow') && (
              <>
                <button className="btn btn-secondary" onClick={handleAssign}>{chat && chat.assignedTo ? 'Assigned' : 'Join as escrow'}</button>
                {chat && chat.assignedToName && <span style={{marginLeft:8,color:'#cbd5e1'}}>Assigned: {chat.assignedToName}</span>}
              </>
            )}
            {type === 'tx' && currentUser && (currentUser.role === 'admin' || currentUser.role === 'escrow') && txData && !txData.escrowId && (
              <button className="btn btn-secondary" onClick={handleAssignTxEscrow}>Assign to me as escrow</button>
            )}
          </div>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
        <div className="chat-messages">
          {messages.filter(m => {
            if (!m) return false;
            // hide escrow messages if chat not assigned/joined (for support chats)
            if (m.escrow && type === 'support' && chat && !chat.assignedTo) return false;
            // hide escrow messages in tx chat unless tx has escrow assigned
            if (m.escrow && type === 'tx' && txData && !txData.escrowId) return false;
            return true;
          }).map(m => (
            <div key={m.id} className={`chat-message ${m.userId === currentUser?.id ? 'mine' : ''} ${m.escrow ? 'escrow' : ''}`}>
              <div className="chat-message-text">{m.text}</div>
              <div className="chat-message-ts">{new Date(m.ts).toLocaleString()}</div>
            </div>
          ))}
        </div>
        <div className="chat-input-row">
          <input value={text} onChange={e => setText(e.target.value)} placeholder="Write a message..." />
          <button className="btn btn-primary" onClick={handleSend}>Send</button>
        </div>
      </div>
    </div>
  );
}
