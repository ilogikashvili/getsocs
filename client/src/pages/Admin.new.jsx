import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import {
  banUser,
  unbanUser,
  listUsers,
  makeEscrow,
  removeEscrow,
  banEscrow,
  listEscrows,
  getStats,
  listAdminProducts,
  listAdminChats,
} from '../services/adminService';
import { pendingProducts, approveProduct, deleteProduct as deleteProductService } from '../services/productService';
import { listTransactions } from '../services/transactionService';
import { getUploadUrl } from '../api/axios';
import axios from '../api/axios';
import ChatPanel from '../components/admin/ChatPanel';
import { SimpleBarChart, SimplePieChart, Sparkline } from '../components/admin/Charts';

const TABS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'users', label: 'Users' },
  { key: 'products', label: 'Products' },
  { key: 'transactions', label: 'Transactions' },
  { key: 'chats', label: 'Chats' },
];

const STAGES = ['awaiting_payment', 'in_escrow', 'shipped', 'delivered', 'released', 'cancelled'];

function formatDate(value) {
  if (!value) return 'N/A';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function resolveUserName(userMap, userId) {
  return userMap[userId]?.username || userMap[userId]?.name || userId || 'Unknown';
}

function Badge({ tone = 'gray', children }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function Admin() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [escrows, setEscrows] = useState([]);
  const [approvedProducts, setApprovedProducts] = useState([]);
  const [pendingProductsList, setPendingProductsList] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [chats, setChats] = useState({ directChats: [], supportChats: [] });
  const [activeChat, setActiveChat] = useState(null);
  const [txFilterStatus, setTxFilterStatus] = useState('all');
  const [txSearch, setTxSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  const isAdmin = user?.role === 'admin';
  const isEscrow = user?.role === 'escrow';

  const userMap = useMemo(
    () => users.reduce((map, item) => ({ ...map, [item.id]: item }), {}),
    [users]
  );

  const allProducts = useMemo(
    () => [...approvedProducts, ...pendingProductsList],
    [approvedProducts, pendingProductsList]
  );

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (txFilterStatus !== 'all' && tx.status !== txFilterStatus) return false;
      if (!txSearch) return true;
      const search = txSearch.toLowerCase();
      return [tx.id, tx.buyerId, tx.sellerId, resolveUserName(userMap, tx.buyerId), resolveUserName(userMap, tx.sellerId)]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search));
    });
  }, [transactions, txFilterStatus, txSearch, userMap]);

  const statsPie = useMemo(() => {
    const total = stats?.totalProducts ?? 0;
    const pending = stats?.pendingProducts ?? 0;
    const approved = Math.max(total - pending, 0);
    return [
      { label: 'Approved', value: approved },
      { label: 'Pending', value: pending },
    ];
  }, [stats]);

  const platformDistribution = useMemo(() => {
    const counts = {};
    allProducts.forEach((product) => {
      const key = product.platform || 'Unknown';
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).map(([label, value]) => ({ label, value }));
  }, [allProducts]);

  const notify = useCallback((message, tone = 'info') => {
    setToast({ message, tone });
    window.clearTimeout(window.__adminToastTimer);
    window.__adminToastTimer = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [statsRes, usersRes, productsRes, pendingRes, txRes, chatsRes] = await Promise.all([
        getStats(),
        listUsers(),
        listAdminProducts(),
        pendingProducts(),
        listTransactions(),
        listAdminChats(),
      ]);

      setStats(statsRes?.data?.data ?? null);
      setUsers(usersRes?.data?.data ?? []);
      const productsData = productsRes?.data?.data ?? [];
      setApprovedProducts(productsData.filter((product) => product.status === 'approved'));
      setPendingProductsList(pendingRes?.data?.data ?? []);
      setTransactions(txRes?.data?.data ?? []);
      setChats(chatsRes?.data?.data ?? { directChats: [], supportChats: [] });

      if (isAdmin) {
        const escrowsRes = await listEscrows();
        setEscrows(escrowsRes?.data?.data ?? []);
      }
    } catch (err) {
      console.error(err);
      setError('Unable to load admin dashboard.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!user || (!isAdmin && !isEscrow)) {
      navigate('/');
      return;
    }
    loadData();
  }, [user, isAdmin, isEscrow, loadData, navigate]);

  const handleAction = async (action, id, extra) => {
    try {
      if (action === 'banUser') await banUser(id);
      if (action === 'unbanUser') await unbanUser(id);
      if (action === 'makeEscrow') await makeEscrow(id);
      if (action === 'removeEscrow') await removeEscrow(id);
      if (action === 'banEscrow') await banEscrow(id);
      if (action === 'approveProduct') await approveProduct(id, extra);
      if (action === 'deleteProduct') await deleteProductService(id);
      notify('Action completed', 'success');
      await loadData();
    } catch (err) {
      console.error(err);
      notify('Action failed', 'danger');
    }
  };

  const handleSetTxStage = async (txId, stage) => {
    try {
      await axios.post(`/transactions/${txId}/stage`, { stage });
      notify('Transaction stage updated.', 'success');
      await loadData();
    } catch (err) {
      console.error(err);
      notify('Unable to update stage.', 'danger');
    }
  };

  if (!user || (!isAdmin && !isEscrow)) {
    return (
      <div className="page-shell">
        <div className="empty-state">Admin or escrow access required.</div>
      </div>
    );
  }

  return (
    <div className="page-shell admin-dashboard">
      <div className="page-header admin-header">
        <div>
          <h2>{isAdmin ? 'Admin Panel' : 'Escrow Panel'}</h2>
          <p>{isAdmin ? 'Manage users, products, transactions, and chats.' : 'Review pending products, transactions, and support chats.'}</p>
        </div>
        <div className="admin-header-actions">
          <span className="badge badge-secondary">{user.role?.toUpperCase()}</span>
          <button className="btn btn-secondary" onClick={loadData}>Refresh</button>
        </div>
      </div>

      <div className="admin-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
        {isAdmin && (
          <button
            className={`tab-btn ${activeTab === 'escrows' ? 'active' : ''}`}
            onClick={() => setActiveTab('escrows')}
          >
            Escrows
          </button>
        )}
      </div>

      {loading && <div className="empty-state">Loading admin dashboard...</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      {!loading && !error && activeTab === 'dashboard' && (
        <>
          <div className="dashboard-summary-grid">
            <div className="summary-card">
              <div className="summary-label">Users</div>
              <div className="summary-value">{stats?.totalUsers ?? 0}</div>
              <div className="summary-note">Total registered accounts</div>
            </div>
            <div className="summary-card">
              <div className="summary-label">Products</div>
              <div className="summary-value">{stats?.totalProducts ?? 0}</div>
              <div className="summary-note">Marketplace listings</div>
            </div>
            <div className="summary-card">
              <div className="summary-label">Pending</div>
              <div className="summary-value">{stats?.pendingProducts ?? 0}</div>
              <div className="summary-note">Waiting approval</div>
            </div>
            <div className="summary-card">
              <div className="summary-label">Transactions</div>
              <div className="summary-value">{stats?.totalTransactions ?? 0}</div>
              <div className="summary-note">Total processed</div>
            </div>
          </div>

          <div className="dashboard-charts">
            <div className="dashboard-card chart-card">
              <h3>Product approval split</h3>
              <SimplePieChart data={statsPie} size={140} />
            </div>
            <div className="dashboard-card chart-card">
              <h3>Platform distribution</h3>
              <SimpleBarChart data={platformDistribution} width={320} height={120} />
            </div>
            <div className="dashboard-card chart-card">
              <h3>Recent transactions</h3>
              <Sparkline values={Array.from({ length: 7 }, () => 0)} width={420} />
            </div>
          </div>
        </>
      )}

      {!loading && !error && activeTab === 'users' && (
        <div className="section-card">
          {users.length ? (
            <div className="admin-list">
              {users.map((u) => (
                <div key={u.id} className="admin-item">
                  <div className="admin-item-info">
                    <strong>{u.username || u.email}</strong>
                    <div className="admin-item-details">
                      <span className={`badge badge-role-${u.role}`}>{u.role}</span>
                      {u.banned && <Badge tone="danger">BANNED</Badge>}
                      <span className="badge">{formatDate(u.createdAt || u.joinedAt)}</span>
                    </div>
                  </div>
                  <div className="admin-item-actions">
                    {u.banned ? (
                      <button className="btn btn-sm btn-success" onClick={() => handleAction('unbanUser', u.id)}>Unban</button>
                    ) : (
                      <button className="btn btn-sm btn-danger" onClick={() => handleAction('banUser', u.id)}>Ban</button>
                    )}
                    {isAdmin && u.role === 'user' && (
                      <button className="btn btn-sm btn-primary" onClick={() => handleAction('makeEscrow', u.id)}>Promote</button>
                    )}
                    {isAdmin && u.role === 'escrow' && (
                      <button className="btn btn-sm btn-secondary" onClick={() => handleAction('removeEscrow', u.id)}>Demote</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">No users found.</div>
          )}
        </div>
      )}

      {!loading && !error && activeTab === 'products' && (
        <div className="section-card">
          <div className="admin-section-heading">
            <h3>Pending products</h3>
            <p>Approve or delete submitted listings.</p>
          </div>
          {pendingProductsList.length ? (
            <div className="admin-list">
              {pendingProductsList.map((product) => (
                <div key={product.id} className="admin-item admin-item-dark">
                  <div className="admin-item-info">
                    <strong>{product.title || product.name}</strong>
                    <div className="admin-item-details">
                      <span className="badge">{product.platform || 'Unknown'}</span>
                      <span className="badge">Seller: {resolveUserName(userMap, product.sellerId)}</span>
                      <span className="badge">Price: ${product.price ?? product.amount ?? 0}</span>
                    </div>
                  </div>
                  <div className="admin-item-actions">
                    <button className="btn btn-sm btn-primary" onClick={() => handleAction('approveProduct', product.id, product.code)}>Approve</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleAction('deleteProduct', product.id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">No pending products.</div>
          )}
        </div>
      )}

      {!loading && !error && activeTab === 'transactions' && (
        <div className="section-card">
          <div className="admin-section-heading">
            <h3>Transactions</h3>
            <div className="admin-filter-row">
              <select value={txFilterStatus} onChange={(e) => setTxFilterStatus(e.target.value)}>
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <input
                type="search"
                placeholder="Search by txn, buyer, seller"
                value={txSearch}
                onChange={(e) => setTxSearch(e.target.value)}
              />
            </div>
          </div>
          {filteredTransactions.length ? (
            <div className="admin-list">
              {filteredTransactions.map((tx) => (
                <div key={tx.id} className="admin-item admin-item-dark">
                  <div className="admin-item-info">
                    <strong>{tx.id}</strong>
                    <div className="admin-item-details">
                      <span className="badge">Buyer: {resolveUserName(userMap, tx.buyerId)}</span>
                      <span className="badge">Seller: {resolveUserName(userMap, tx.sellerId)}</span>
                      <span className={`badge badge-${tx.status === 'completed' ? 'success' : tx.status === 'cancelled' ? 'danger' : 'warning'}`}>{tx.status || 'unknown'}</span>
                    </div>
                  </div>
                  <div className="admin-item-actions">
                    <select value={tx.stage || STAGES[0]} onChange={(e) => handleSetTxStage(tx.id, e.target.value)}>
                      {STAGES.map((stage) => (
                        <option key={stage} value={stage}>{stage.replace('_', ' ')}</option>
                      ))}
                    </select>
                    <button className="btn btn-sm btn-secondary" onClick={() => setActiveChat({ type: 'tx', id: tx.id })}>Open Chat</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">No transactions found.</div>
          )}
        </div>
      )}

      {!loading && !error && activeTab === 'chats' && (
        <div className="section-card">
          <div className="admin-section-heading">
            <h3>Support & Direct chats</h3>
          </div>
          <div className="admin-chat-groups">
            <div className="admin-chat-group">
              <h4>Support chats</h4>
              {chats.supportChats.length ? chats.supportChats.map((chat) => (
                <div key={chat.id} className="admin-item admin-item-dark">
                  <div className="admin-item-info">
                    <strong>{chat.userName || chat.userId}</strong>
                    <div className="admin-item-details">
                      <span className="badge">Messages: {chat.messages?.length || 0}</span>
                      <span className="badge">Assigned: {chat.assignedToName || 'none'}</span>
                    </div>
                  </div>
                  <div className="admin-item-actions">
                    <button className="btn btn-sm btn-secondary" onClick={() => setActiveChat({ type: 'support', id: chat.id })}>Open</button>
                  </div>
                </div>
              )) : <div className="empty-state">No support chats.</div>}
            </div>
            <div className="admin-chat-group">
              <h4>Direct chats</h4>
              {chats.directChats.length ? chats.directChats.map((chat) => (
                <div key={chat.id} className="admin-item admin-item-dark">
                  <div className="admin-item-info">
                    <strong>Direct chat</strong>
                    <div className="admin-item-details">
                      <span className="badge">Participants: {chat.participants?.join(', ') || 'N/A'}</span>
                      <span className="badge">Messages: {chat.messages?.length || 0}</span>
                    </div>
                  </div>
                  <div className="admin-item-actions">
                    <button className="btn btn-sm btn-secondary" onClick={() => setActiveChat({ type: 'direct', id: chat.id })}>Open</button>
                  </div>
                </div>
              )) : <div className="empty-state">No direct chats.</div>}
            </div>
          </div>
        </div>
      )}

      {!loading && !error && isAdmin && activeTab === 'escrows' && (
        <div className="section-card">
          <div className="admin-section-heading">
            <h3>Escrow accounts</h3>
          </div>
          {escrows.length ? (
            <div className="admin-list">
              {escrows.map((escrow) => (
                <div key={escrow.id} className="admin-item admin-item-dark">
                  <div className="admin-item-info">
                    <strong>{escrow.username || escrow.email}</strong>
                    <div className="admin-item-details">
                      <span className={`badge badge-${escrow.banned ? 'danger' : 'success'}`}>{escrow.banned ? 'Banned' : 'Active'}</span>
                      <span className="badge">Escrow</span>
                    </div>
                  </div>
                  <div className="admin-item-actions">
                    <button className="btn btn-sm btn-secondary" onClick={() => handleAction('removeEscrow', escrow.id)}>Demote</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleAction('banEscrow', escrow.id)}>Ban</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">No escrow accounts found.</div>
          )}
        </div>
      )}

      {activeChat && <ChatPanel type={activeChat.type} id={activeChat.id} onClose={() => setActiveChat(null)} />}
      {toast && <div className={`admin-toast ${toast.tone}`}>{toast.message}</div>}
    </div>
  );
}

export default Admin;
