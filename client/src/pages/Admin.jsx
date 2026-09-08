import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  LayoutDashboard, Users, ShieldCheck, Package, ArrowLeftRight, MessageSquare,
  Search, Bell, Ban, CheckCircle2, XCircle, UserCog, UserMinus,
  Send, X, ShieldOff, Eye, RefreshCw, ArrowUpRight, ArrowDownRight,
  Clock, DollarSign, Menu, Trash2, UserCheck,
  ChevronRight, Loader2, Inbox, Link2, KeyRound,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import "./AdminPanel.css";
import axios from "../api/axios";

/* ============================================================================
   API LAYER
   Every function below documents one backend endpoint. Each call falls back to
   local mock data if the request fails (e.g. no network access, or the endpoint
   isn't live yet) so the UI always has something to render while you wire up
   the backend.
============================================================================ */

async function request(method, path, body) {
  try {
    const res = await axios({ method: method.toLowerCase(), url: path, data: body });
    const json = res.data;
    if (json && typeof json === 'object' && 'success' in json && 'data' in json) return json.data;
    return json;
  } catch (err) {
    const status = err.response?.status;
    const msg = err.response?.data?.error || err.message;
    const e = new Error(`Request failed: ${msg}`);
    e.status = status;
    throw e;
  }
}

const api = {
  // ---- Admin management ----
  getUsers: () => request("GET", "/admin/users"),
  getEscrows: () => request("GET", "/admin/escrows"),
  banUser: (userId, reason) => request("POST", `/admin/ban/${userId}`, { reason }),
  unbanUser: (userId) => request("POST", `/admin/unban/${userId}`),
  makeEscrow: (userId) => request("POST", `/admin/make-escrow/${userId}`),
  removeEscrow: (userId) => request("POST", `/admin/remove-escrow/${userId}`),
  banEscrow: (userId, reason) => request("POST", `/admin/ban-escrow/${userId}`, { reason }),
  getStats: () => request("GET", "/admin/stats"),
  getAdminProducts: () => request("GET", "/admin/products"),
  getPendingProducts: () => request("GET", "/products/pending"),
  approveProduct: (id, code) => request("POST", `/products/${id}/approve`, { code }),
  deleteProduct: (id) => request("DELETE", `/products/${id}`),
  getAdminChats: () => request("GET", "/admin/chats"),
  getProductClaims: () => request("GET", "/products/claims/pending"),
  resolveProductClaim: (productId, code, approve) => request("POST", `/products/${productId}/claim/resolve`, { code, approve }),

  // ---- Chat / support ----
  getMe: () => request("GET", "/auth/me"),
  getUserProfile: (userId) => request("GET", `/auth/profile/${userId}`),
  getSupportChat: (chatId) => request("GET", `/chats/support/${chatId}/get`),
  sendSupportMessage: (chatId, text) => request("POST", `/chats/support/${chatId}/message`, { text }),
  assignSupportChat: (chatId) => request("POST", `/chats/support/${chatId}/assign`),
  getDirectChat: (chatId) => request("GET", `/chats/direct/chat/${chatId}`),
  sendDirectMessage: (chatId, text) => request("POST", `/chats/direct/chat/${chatId}/message`, { text }),
  getTransactionChat: (txId) => request("GET", `/chats/${txId}`),
  sendTransactionChatMessage: (txId, text) => request("POST", `/chats/${txId}/message`, { text }),
  issuePhotoChangeCode: (userId, photoType) => request("POST", `/admin/users/${userId}/photo-change-code`, { photoType }),

  // Notifications / activity
  getNotifications: () => request("GET", "/notifications"),

  // ---- Suggested additional endpoints (not in the original list, see notes) ----
  getProductDetail: (productId) => request("GET", `/admin/products/${productId}`),
  closeSupportChat: (chatId) => request("POST", `/chats/support/${chatId}/close`),
  // getActivity removed; use notifications for activity feed
  getEscrowTransactions: (userId) => request("GET", `/admin/escrows/${userId}/transactions`),
};

/* ============================================================================
   MOCK DATA
============================================================================ */

const MOCK_STATS = {
  totalUsers: 14250, totalProducts: 8430, pendingApprovals: 156,
  totalTransactions: 2540, totalRevenue: 32540,
  deltas: { users: 12.5, products: 8.3, pending: 4.2, transactions: 15.7, revenue: 18.6 },
};

const MOCK_TREND = [
  { day: "May 12", users: 9800, revenue: 22400 },
  { day: "May 13", users: 10600, revenue: 24100 },
  { day: "May 14", users: 11100, revenue: 23600 },
  { day: "May 15", users: 11800, revenue: 27200 },
  { day: "May 16", users: 12700, revenue: 29800 },
  { day: "May 17", users: 13400, revenue: 31500 },
  { day: "May 18", users: 14250, revenue: 32540 },
];

const MOCK_ACTIVITY = [
  { id: "a1", type: "user", text: "New user registered — johndoe@email.com", time: "2 mins ago" },
  { id: "a2", type: "product", text: "New product submitted — Vintage Leather Bag", time: "5 mins ago" },
  { id: "a3", type: "transaction", text: "Transaction completed — Smartphone iPhone 12", time: "10 mins ago" },
  { id: "a4", type: "escrow", text: "Escrow assigned — #ESC789", time: "15 mins ago" },
];

const MOCK_USERS = [
  { id: "u1", name: "John Doe", email: "john@doe.com", role: "buyer", status: "active", joined: "2025-01-04" },
  { id: "u2", name: "Jane Smith", email: "jane@smith.com", role: "seller", status: "active", joined: "2025-01-12" },
  { id: "u3", name: "Mike Johnson", email: "mike@johnson.com", role: "buyer", status: "banned", joined: "2025-02-02" },
  { id: "u4", name: "Sarah Wilson", email: "sarah@wilson.com", role: "seller", status: "active", joined: "2025-02-18" },
  { id: "u5", name: "David Brown", email: "david@brown.com", role: "buyer", status: "active", joined: "2025-03-01" },
];

const MOCK_ESCROWS = [
  { id: "e1", name: "Alicia Grant", email: "alicia@escrow.com", assigned: 6, status: "active" },
  { id: "e2", name: "Tom Reyes", email: "tom@escrow.com", assigned: 3, status: "active" },
  { id: "e3", name: "Priya Nair", email: "priya@escrow.com", assigned: 0, status: "banned" },
];

const MOCK_PENDING_PRODUCTS = [
  { id: "p1", name: "Vintage Leather Bag", seller: "Jane Smith", price: 250, category: "Fashion", submitted: "2025-05-17" },
  { id: "p2", name: "iPhone 12", seller: "Jane Smith", price: 650, category: "Electronics", submitted: "2025-05-18" },
  { id: "p3", name: "Nike Air Max", seller: "Sarah Wilson", price: 150, category: "Fashion", submitted: "2025-05-18" },
];

const MOCK_ALL_PRODUCTS = [
  { id: "p1", name: "Vintage Leather Bag", seller: "Jane Smith", price: 250, status: "pending" },
  { id: "p4", name: "Samsung Galaxy S21", seller: "Mike Johnson", price: 450, status: "approved" },
  { id: "p5", name: "MacBook Pro", seller: "David Brown", price: 1250, status: "approved" },
];

const MOCK_TRANSACTIONS = [
  { id: "t1", item: "Vintage Leather Bag", buyer: "John Doe", seller: "Jane Smith", amount: 250, status: "completed", stage: "released", escrow: "Alicia Grant" },
  { id: "t2", item: "iPhone 12", buyer: "Jane Smith", seller: "Mike Johnson", amount: 650, status: "pending", stage: "awaiting_payment", escrow: null },
  { id: "t3", item: "Samsung Galaxy S21", buyer: "Mike Johnson", seller: "Sarah Wilson", amount: 450, status: "completed", stage: "released", escrow: "Tom Reyes" },
  { id: "t4", item: "Nike Air Max", buyer: "Sarah Wilson", seller: "David Brown", amount: 150, status: "cancelled", stage: "cancelled", escrow: null },
  { id: "t5", item: "MacBook Pro", buyer: "David Brown", seller: "John Doe", amount: 1250, status: "pending", stage: "in_escrow", escrow: "Alicia Grant" },
];

const STAGES = ["awaiting_payment", "in_escrow", "shipped", "delivered", "released", "cancelled"];



/* ============================================================================
   SMALL SHARED UI PIECES
============================================================================ */

function useAsync(fn, mock, deps = []) {
  const [data, setData] = useState(mock);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(() => {
    setLoading(true);
    fn()
      .then((res) => setData(res ?? mock))
      .catch(() => setData(mock))
      .finally(() => setLoading(false));
    // eslint-disable-next-line
  }, deps);
  useEffect(() => { reload(); }, [reload]);
  return [data, loading, reload, setData];
}

function Badge({ tone = "gray", children }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function IconBtn({ icon: Icon, label, tone = "gray", onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} title={label} className={`icon-btn tone-${tone}`}>
      <Icon size={14} /> {label}
    </button>
  );
}

function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className={`toast ${toast.tone}`}>
      {toast.tone === "success" ? <CheckCircle2 size={16} /> : toast.tone === "error" ? <XCircle size={16} /> : <Loader2 size={16} />}
      {toast.text}
    </div>
  );
}

function Card({ title, action, children, className = "" }) {
  return (
    <div className={`card ${className}`}>
      {title && (
        <div className="card-header">
          <h3 className="card-title">{title}</h3>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, delta, tone }) {
  const hasDelta = typeof delta === 'number' && !Number.isNaN(delta);
  const up = hasDelta && delta >= 0;
  return (
    <div className="stat-card">
      <div className="stat-icon-row">
        <div className={`stat-icon tone-${tone}`}><Icon size={18} /></div>
        <span className="stat-label">{label}</span>
      </div>
      <div className="stat-value-row">
        <span className="stat-value">{value}</span>
        {hasDelta && (
          <span className={`stat-delta ${up ? "up" : "down"}`}>
            {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {Math.abs(delta)}%
          </span>
        )}
      </div>
    </div>
  );
}

function SearchInput({ value, onChange, placeholder }) {
  return (
    <div className="search-wrap">
      <Search size={15} className="search-icon" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="search-input"
      />
    </div>
  );
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button onClick={onClose} className="modal-close"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon = Inbox, text }) {
  return (
    <div className="empty-state">
      <Icon size={28} />
      <span>{text}</span>
    </div>
  );
}

function statusTone(status) {
  return { active: "green", pending: "amber", banned: "red", completed: "green", cancelled: "red", refunded: "amber" }[status] || "gray";
}

/* ============================================================================
   NAVIGATION
============================================================================ */

const NAV = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "users", label: "Users", icon: Users },
  { key: "escrows", label: "Escrows", icon: ShieldCheck },
  { key: "products", label: "Products", icon: Package },
  { key: "transactions", label: "Transactions", icon: ArrowLeftRight },
  { key: "chats", label: "Chats", icon: MessageSquare },
];

function Sidebar({ page, setPage, collapsed, setCollapsed }) {
  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo">M</div>
        {!collapsed && <span className="sidebar-title">MarketHub</span>}
        <button onClick={() => setCollapsed(!collapsed)} className="sidebar-collapse-btn">
          <Menu size={16} />
        </button>
      </div>
      <nav className="sidebar-nav">
        {NAV.map((item) => (
          <button
            key={item.key}
            onClick={() => setPage(item.key)}
            className={`nav-item ${page === item.key ? "active" : ""}`}
          >
            <item.icon size={18} />
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}
      </nav>
    </aside>
  );
}

function Topbar({ title, subtitle }) {
  return (
    <header className="topbar">
      <div>
        <h1 className="topbar-title">{title}</h1>
        {subtitle && <p className="topbar-subtitle">{subtitle}</p>}
      </div>
      <div className="topbar-search">
        <SearchInput value="" onChange={() => {}} placeholder="Search users, products, transactions..." />
      </div>
      <div className="topbar-actions">
        <button className="bell-btn">
          <Bell size={18} />
          <span className="bell-badge">3</span>
        </button>
      </div>
    </header>
  );
}

/* ============================================================================
   DASHBOARD PAGE
============================================================================ */

function DashboardPage() {
  const [stats, statsLoading] = useAsync(api.getStats, MOCK_STATS, []);
  const [activity] = useAsync(api.getNotifications, MOCK_ACTIVITY, []);

  return (
    <div className="page">
      <div className="stats-row">
        <StatCard icon={Users} label="Total users" value={stats.totalUsers?.toLocaleString()} delta={stats.deltas?.users} tone="violet" />
        <StatCard icon={Package} label="Total products" value={stats.totalProducts?.toLocaleString()} delta={stats.deltas?.products} tone="sky" />
        <StatCard icon={Clock} label="Pending approvals" value={stats.pendingProducts ?? 0} delta={stats.deltas?.pending} tone="amber" />
        <StatCard icon={ArrowLeftRight} label="Total transactions" value={stats.totalTransactions?.toLocaleString()} delta={stats.deltas?.transactions} tone="emerald" />
        <StatCard icon={DollarSign} label="Total revenue" value={`$${(stats.totalRevenue ?? 0).toLocaleString()}`} delta={stats.deltas?.revenue} tone="rose" />
      </div>

      <div className="dashboard-grid">
        <Card title="Platform overview">
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={MOCK_TREND}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="day" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="revenue" stroke="#a78bfa" fill="url(#rev)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Recent activity">
          <div className="activity-list">
            {activity.map((a) => (
              <div key={a.id} className="activity-item">
                <div className="activity-icon">
                  {a.type === "user" && <Users size={14} />}
                  {a.type === "product" && <Package size={14} />}
                  {a.type === "transaction" && <ArrowLeftRight size={14} />}
                  {a.type === "escrow" && <ShieldCheck size={14} />}
                </div>
                <div>
                  <p className="activity-text">{a.text}</p>
                  <p className="activity-time">{a.time}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      {statsLoading && <p className="muted-note">Refreshing stats…</p>}
    </div>
  );
}

/* ============================================================================
   USERS PAGE
============================================================================ */

function UsersPage({ notify }) {
  const [users, loading, reload, setUsers] = useAsync(api.getUsers, MOCK_USERS, []);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [busyId, setBusyId] = useState(null);

  const filtered = useMemo(
    () =>
      users.filter(
        (u) =>
          (roleFilter === "all" || u.role === roleFilter) &&
          (u.name.toLowerCase().includes(query.toLowerCase()) || u.email.toLowerCase().includes(query.toLowerCase()))
      ),
    [users, query, roleFilter]
  );

  async function act(userId, action, label) {
    setBusyId(userId);
    try {
      if (action === "ban") await api.banUser(userId, "Policy violation");
      if (action === "unban") await api.unbanUser(userId);
      if (action === "makeEscrow") await api.makeEscrow(userId);
      if (action === "removeEscrow") await api.removeEscrow(userId);
      notify(`${label} succeeded`, "success");
    } catch {
      notify(`${label} sent (demo mode — no live API)`, "info");
    }
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id !== userId) return u;
        if (action === "ban") return { ...u, status: "banned" };
        if (action === "unban") return { ...u, status: "active" };
        if (action === "makeEscrow") return { ...u, role: "escrow" };
        if (action === "removeEscrow") return { ...u, role: "buyer" };
        return u;
      })
    );
    setBusyId(null);
  }

  async function issuePhotoCode(user) {
    const photoType = window.prompt(`Issue a one-time code for ${user.name}'s photo. Type profile or background:`, 'profile');
    if (!photoType) return;
    const normalizedType = photoType.trim().toLowerCase();
    if (!['profile', 'background'].includes(normalizedType)) {
      notify('Photo type must be profile or background.', 'error');
      return;
    }
    try {
      const result = await api.issuePhotoChangeCode(user.id, normalizedType);
      window.prompt(`Send this ${normalizedType} photo code through escrow. It expires in 30 minutes:`, result.code);
      notify('One-time photo-change code issued.', 'success');
    } catch (error) {
      notify(error?.message || 'Unable to issue a photo-change code.', 'error');
    }
  }

  return (
    <div className="page">
      <div className="filters-row">
        <div className="search-max flex-1"><SearchInput value={query} onChange={setQuery} placeholder="Search name or email..." /></div>
        <div className="tab-group">
          {["all", "buyer", "seller", "escrow"].map((r) => (
            <button key={r} onClick={() => setRoleFilter(r)} className={`tab-btn ${roleFilter === r ? "active" : ""}`}>
              {r}
            </button>
          ))}
        </div>
        <button onClick={reload} className="refresh-btn ml-auto">
          <RefreshCw size={13} className={loading ? "spin" : ""} /> Refresh
        </button>
      </div>

      <Card>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="table-user">
                      <div className="table-avatar">{u.name.split(" ").map((n) => n[0]).join("")}</div>
                      <div>
                        <p className="table-name">{u.name}</p>
                        <p className="table-sub">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td><Badge tone={u.role === "escrow" ? "violet" : "gray"}>{u.role}</Badge></td>
                  <td><Badge tone={statusTone(u.status)}>{u.status}</Badge></td>
                  <td>{u.joined}</td>
                  <td>
                    <div className="table-actions">
                      {u.status === "active" ? (
                        <IconBtn icon={Ban} label="Ban" tone="red" disabled={busyId === u.id} onClick={() => act(u.id, "ban", "Ban user")} />
                      ) : (
                        <IconBtn icon={UserCheck} label="Unban" tone="green" disabled={busyId === u.id} onClick={() => act(u.id, "unban", "Unban user")} />
                      )}
                      {u.role !== "escrow" ? (
                        <IconBtn icon={UserCog} label="Make escrow" tone="violet" disabled={busyId === u.id} onClick={() => act(u.id, "makeEscrow", "Make escrow")} />
                      ) : (
                        <IconBtn icon={UserMinus} label="Remove escrow" tone="gray" disabled={busyId === u.id} onClick={() => act(u.id, "removeEscrow", "Remove escrow")} />
                      )}
                      <IconBtn icon={KeyRound} label="Issue photo-change code" tone="violet" disabled={busyId === u.id} onClick={() => issuePhotoCode(u)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <EmptyState icon={Users} text="No users match this filter" />}
        </div>
      </Card>
    </div>
  );
}

/* ============================================================================
   ESCROWS PAGE
============================================================================ */

function EscrowsPage({ notify }) {
  const [escrows, loading, reload, setEscrows] = useAsync(api.getEscrows, MOCK_ESCROWS, []);
  const [busyId, setBusyId] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [txForEscrow, setTxForEscrow] = useState([]);

  async function ban(userId) {
    setBusyId(userId);
    try {
      await api.banEscrow(userId, "Policy violation");
      notify("Escrow banned", "success");
    } catch {
      notify("Escrow banned (demo mode)", "info");
    }
    setEscrows((prev) => prev.map((e) => (e.id === userId ? { ...e, status: "banned" } : e)));
    setBusyId(null);
  }

  async function openEscrow(e) {
    setViewing(e);
    try {
      const tx = await api.getEscrowTransactions(e.id);
      setTxForEscrow(tx ?? MOCK_TRANSACTIONS.slice(0, e.assigned));
    } catch {
      setTxForEscrow(MOCK_TRANSACTIONS.slice(0, e.assigned));
    }
  }

  return (
    <div className="page">
      <div className="filters-row">
        <p className="muted-note">Escrow moderators handle assigned transactions and hold funds until release.</p>
        <button onClick={reload} className="refresh-btn ml-auto">
          <RefreshCw size={13} className={loading ? "spin" : ""} /> Refresh
        </button>
      </div>
      <Card>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Escrow</th>
                <th>Assigned transactions</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {escrows.map((e) => (
                <tr key={e.id}>
                  <td>
                    <p className="table-name">{e.name}</p>
                    <p className="table-sub">{e.email}</p>
                  </td>
                  <td>{e.assigned}</td>
                  <td><Badge tone={statusTone(e.status)}>{e.status}</Badge></td>
                  <td>
                    <div className="table-actions">
                      <IconBtn icon={Eye} label="View" tone="gray" onClick={() => openEscrow(e)} />
                      {e.status !== "banned" && (
                        <IconBtn icon={ShieldOff} label="Ban escrow" tone="red" disabled={busyId === e.id} onClick={() => ban(e.id)} />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing ? `${viewing.name} — assigned transactions` : ""}>
        {txForEscrow.length === 0 ? (
          <EmptyState text="No transactions assigned yet" />
        ) : (
          <div className="pending-list">
            {txForEscrow.map((t) => (
              <div key={t.id} className="pending-item">
                <span className="table-name">{t.item}</span>
                <Badge tone={statusTone(t.status)}>{t.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ============================================================================
   PRODUCTS PAGE
============================================================================ */

function ProductsPage({ notify }) {
  const [tab, setTab] = useState("pending");
  const [pending, pendingLoading, reloadPending, setPending] = useAsync(api.getPendingProducts, MOCK_PENDING_PRODUCTS, []);
  const [all] = useAsync(api.getAdminProducts, MOCK_ALL_PRODUCTS, []);
  const [claims, claimsLoading, reloadClaims, setClaims] = useAsync(api.getProductClaims, [], []);
  const [busyId, setBusyId] = useState(null);

  // The real backend returns title/sellerName/sellerId/topic/createdAt;
  // mock fallback data used a different placeholder shape (name/seller/
  // category/submitted). Normalize both into one shape so the UI renders
  // correctly regardless of which one is currently backing it.
  function normalizeProduct(p) {
    return {
      id: p.id,
      name: p.title || p.name || "",
      seller: p.sellerName || p.seller || "",
      sellerId: p.sellerId || null,
      category: p.topic || p.category || "",
      submitted: p.createdAt ? new Date(p.createdAt).toLocaleString() : (p.submitted || ""),
      price: p.price ?? 0,
      status: p.status || "",
      code: p.code,
    };
  }

  const pendingRows = (Array.isArray(pending) ? pending : []).map(normalizeProduct);
  const allRows = (Array.isArray(all) ? all : []).map(normalizeProduct);

  async function resolveClaim(productId, code, approve) {
    setBusyId(productId);
    try {
      await api.resolveProductClaim(productId, code, approve);
      notify(approve ? "Claim approved - listing removed from marketplace" : "Claim rejected", "success");
      setClaims((prev) => prev.filter((c) => c.productId !== productId));
    } catch (e) {
      notify(e?.response?.data?.error || "Unable to resolve this claim", "error");
    }
    setBusyId(null);
  }

  async function approve(id, code) {
    setBusyId(id);
    try {
      await api.approveProduct(id, code);
      notify("Product approved", "success");
      setPending((prev) => (Array.isArray(prev) ? prev.filter((p) => p.id !== id) : prev));
    } catch (e) {
      notify(e?.response?.data?.error || e.message || "Unable to approve this listing", "error");
    }
    setBusyId(null);
  }

  async function reject(id) {
    setBusyId(id);
    try {
      await api.deleteProduct(id);
      notify("Product removed", "success");
      setPending((prev) => (Array.isArray(prev) ? prev.filter((p) => p.id !== id) : prev));
    } catch (e) {
      notify(e?.response?.data?.error || e.message || "Unable to remove this listing", "error");
    }
    setBusyId(null);
  }

  // Renders a seller name as a link to their profile when we have a
  // sellerId to link to (real backend data); plain text otherwise (mock
  // data, or a listing whose seller account no longer exists).
  function SellerLink({ sellerId, sellerName }) {
    if (!sellerId) return <>{sellerName}</>;
    return <Link to={`/users/${sellerId}`} className="admin-seller-link">{sellerName}</Link>;
  }

  return (
    <div className="page">
      <div className="tab-group">
        {[["pending", "Pending review"], ["all", "All products"], ["claims", "Ownership claims"]].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`tab-btn ${tab === k ? "active" : ""}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "pending" ? (
        <Card title="Pending approvals" action={<button onClick={reloadPending} className="modal-close"><RefreshCw size={13} className={pendingLoading ? "spin" : ""} /></button>}>
          {pendingRows.length === 0 ? (
            <EmptyState icon={Package} text="No listings waiting for review" />
          ) : (
            <div className="pending-list">
              {pendingRows.map((p) => (
                <div key={p.id} className="pending-item">
                  <div>
                    <p className="pending-info-name">{p.name}</p>
                    <p className="pending-info-sub">
                      by <SellerLink sellerId={p.sellerId} sellerName={p.seller} /> · {p.category} · submitted {p.submitted}
                    </p>
                  </div>
                  <div className="pending-actions">
                    <span className="pending-price">${p.price}</span>
                    <IconBtn icon={CheckCircle2} label="Approve" tone="green" disabled={busyId === p.id} onClick={() => approve(p.id, p.code)} />
                    <IconBtn icon={Trash2} label="Reject" tone="red" disabled={busyId === p.id} onClick={() => reject(p.id)} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : tab === "all" ? (
        <Card title="All products">
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Seller</th>
                <th>Price</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {allRows.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td className="table-sub"><SellerLink sellerId={p.sellerId} sellerName={p.seller} /></td>
                  <td>${p.price}</td>
                  <td><Badge tone={statusTone(p.status)}>{p.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <Card title="Ownership claims" action={<button onClick={reloadClaims} className="modal-close"><RefreshCw size={13} className={claimsLoading ? "spin" : ""} /></button>}>
          {claims.length === 0 ? (
            <EmptyState icon={Package} text="No ownership claims awaiting review" />
          ) : (
            <div className="pending-list">
              {claims.map((c) => (
                <div key={c.productId} className="pending-item">
                  <div>
                    <p className="pending-info-name">{c.productTitle}</p>
                    <p className="pending-info-sub">
                      Claimed by user {c.userId} · code <strong style={{ fontFamily: 'monospace' }}>{c.code}</strong> · submitted {c.submittedAt ? new Date(c.submittedAt).toLocaleString() : ''}
                    </p>
                  </div>
                  <div className="pending-actions">
                    <IconBtn icon={CheckCircle2} label="Approve" tone="green" disabled={busyId === c.productId} onClick={() => resolveClaim(c.productId, c.code, true)} />
                    <IconBtn icon={Trash2} label="Reject" tone="red" disabled={busyId === c.productId} onClick={() => resolveClaim(c.productId, c.code, false)} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

/* ============================================================================
   TRANSACTIONS PAGE
============================================================================ */

function TransactionsPage({ notify }) {
  const [rawTxs, loading, reload, setRawTxs] = useAsync(api.getTransactions, [], []);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);

  // Normalize backend transaction shape to the UI-friendly shape used below
  const txs = (Array.isArray(rawTxs) ? rawTxs : []).map((t) => ({
    id: t.id,
    item: t.productTitle || t.item || t.productName || "",
    buyer: t.buyerName || t.buyer || "",
    seller: t.sellerName || t.seller || "",
    amount: t.productPrice || t.amount || t.price || 0,
    status: t.status || "",
    stage: t.stage || "",
    escrow: t.escrow || t.escrowId || null,
  }));

  const filtered = txs.filter((t) => statusFilter === "all" || t.status === statusFilter);

  async function open(t) {
    try {
      const full = await api.getTransaction(t.id);
      const mapped = full ? {
        id: full.id,
        item: full.productTitle || full.item || full.productName || "",
        buyer: full.buyerName || full.buyer || "",
        seller: full.sellerName || full.seller || "",
        amount: full.productPrice || full.amount || full.price || 0,
        status: full.status || "",
        stage: full.stage || "",
        escrow: full.escrow || full.escrowId || null,
      } : t;
      setSelected(mapped);
    } catch {
      setSelected(t);
    }
  }

  async function changeStage(stage) {
    setSaving(true);
    try {
      await api.updateTransactionStage(selected.id, stage);
      notify("Stage updated", "success");
    } catch {
      notify("Stage updated (demo mode)", "info");
    }
    // Update local normalized list by updating the raw source shallowly
    setRawTxs((prev) => prev.map((r) => (r.id === selected.id ? { ...r, stage } : r)));
    setSelected((s) => ({ ...s, stage }));
    setSaving(false);
  }

  async function assignEscrow(name) {
    setSaving(true);
    try {
      await api.assignEscrowToTransaction(selected.id, name);
      notify("Escrow assigned", "success");
    } catch {
      notify("Escrow assigned (demo mode)", "info");
    }
    setRawTxs((prev) => prev.map((r) => (r.id === selected.id ? { ...r, escrow: name, escrowId: name } : r)));
    setSelected((s) => ({ ...s, escrow: name }));
    setSaving(false);
  }

  return (
    <div className="page">
      <div className="filters-row">
        <div className="tab-group">
          {[
            "all", "pending", "completed", "cancelled", "refunded"
          ].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`tab-btn ${statusFilter === s ? "active" : ""}`}>
              {s}
            </button>
          ))}
        </div>
        <button onClick={reload} className="refresh-btn ml-auto">
          <RefreshCw size={13} className={loading ? "spin" : ""} /> Refresh
        </button>
      </div>

      <Card>
        <table className="table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Buyer / Seller</th>
              <th>Amount</th>
              <th>Escrow</th>
              <th>Status</th>
              <th className="text-right">Details</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id}>
                <td>{t.item}</td>
                <td className="table-sub">{t.buyer} → {t.seller}</td>
                <td className="table-name">${t.amount}</td>
                <td className="table-sub">{t.escrow || "—"}</td>
                <td><Badge tone={statusTone(t.status)}>{t.status}</Badge></td>
                <td className="text-right">
                  <button onClick={() => open(t)} className="link-btn">
                    View <ChevronRight size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected ? `Transaction ${selected.id}` : ""}>
        {selected && (
          <div className="tx-section">
            <div className="detail-grid">
              <div><p className="detail-label">Item</p><p className="detail-value">{selected.item}</p></div>
              <div><p className="detail-label">Amount</p><p className="detail-value">${selected.amount}</p></div>
              <div><p className="detail-label">Buyer</p><p className="detail-value">{selected.buyer}</p></div>
              <div><p className="detail-label">Seller</p><p className="detail-value">{selected.seller}</p></div>
            </div>

            <div>
              <p className="detail-block-title">Workflow stage</p>
              <div className="chip-group">
                {STAGES.map((s) => (
                  <button key={s} disabled={saving} onClick={() => changeStage(s)} className={`chip ${selected.stage === s ? "active" : ""}`}>
                    {s.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="detail-block-title">Assign escrow</p>
              <div className="chip-group">
                {MOCK_ESCROWS.filter((e) => e.status === "active").map((e) => (
                  <button key={e.id} disabled={saving} onClick={() => assignEscrow(e.name)} className={`chip ${selected.escrow === e.name ? "active" : ""}`}>
                    {e.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ============================================================================
   CHATS PAGE
============================================================================ */

function ChatsPage({ notify }) {
  const [chatAdminFilter, setChatAdminFilter] = useState("");
  const [chatPhaseFilter, setChatPhaseFilter] = useState("");
  const [rawChats, loading, reload] = useAsync(() => api.getAdminChats(), { directChats: [], supportChats: [] }, []);
  const direct = (rawChats && Array.isArray(rawChats.directChats) ? rawChats.directChats : []).map(c => ({
    ...c,
    type: c.txId ? 'tx' : 'direct'
  }));
  const support = (rawChats && Array.isArray(rawChats.supportChats) ? rawChats.supportChats.map(c => ({ ...c, type: 'support' })) : []);
  const chats = direct.concat(support);
  const chatPhases = useMemo(() => {
    const stages = new Set(chats.map((chat) => chat.stage).filter(Boolean));
    return Array.from(stages);
  }, [chats]);
  const [activeId, setActiveId] = useState(chats[0]?.id);
  const filteredChats = useMemo(() => {
    const query = (chatAdminFilter || '').trim().toLowerCase();
    return chats.filter((chat) => {
      if (chatPhaseFilter && chat.stage !== chatPhaseFilter) return false;
      if (!query) return true;
      const orderId = String(chat.txId || chat.orderId || chat.dealId || chat.id || '').toLowerCase();
      const productId = String(chat.productId || '').toLowerCase();
      const userNames = [
        chat.user,
        chat.userName,
        chat.userId,
        chat.participantName,
        chat.participantNames && Object.values(chat.participantNames).join(' '),
        chat.buyerName,
        chat.sellerName,
      ].filter(Boolean).map((value) => String(value).toLowerCase());
      const escrowNames = [
        chat.assignedToName,
        chat.assignedTo,
        chat.escrowName,
        chat.escrowId,
      ].filter(Boolean).map((value) => String(value).toLowerCase());
      const textFields = [chat.lastMessage, chat.type, chat.updatedAt, chat.stage, chat.productTitle].filter(Boolean).map((value) => String(value).toLowerCase());
      const allFields = [orderId, productId, ...userNames, ...escrowNames, ...textFields];
      return allFields.some((value) => value.includes(query));
    });
  }, [chatAdminFilter, chatPhaseFilter, chats]);
  const [thread, setThread] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [viewer, setViewer] = useState(null);

  const active = chats.find((c) => c.id === activeId) || chats[0] || null;

  useEffect(() => {
    api.getMe().then((result) => setViewer(result?.user || result)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!activeId && chats.length) {
      const first = chats[0];
      if (first) {
        setActiveId(first.id);
        openChat(first);
      }
    } else if (activeId && !chats.find((chat) => chat.id === activeId) && chats.length) {
      const first = chats[0];
      if (first) openChat(first);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chats]);

  async function openChat(chat) {
    setActiveId(chat.id);
    try {
      let data;
      if (chat.type === 'support') {
        data = await api.getSupportChat(chat.id);
        setThread(data?.chat?.messages ?? data?.messages ?? []);
      } else if (chat.type === 'tx') {
        // transaction-based chat returns messages array
        data = await api.getTransactionChat(chat.txId || chat.id);
        setThread(Array.isArray(data) ? data : data?.messages ?? []);
      } else {
        data = await api.getDirectChat(chat.id);
        setThread(data?.chat?.messages ?? data?.messages ?? []);
      }
    } catch (err) {
      if (err?.status === 403) {
        notify('Forbidden to view this chat', 'error');
      } else {
        notify('Failed to load chat (offline/demo)', 'info');
      }
      setThread([]);
    }
  }

  useEffect(() => {
    if (!active) return undefined;
    const interval = setInterval(() => openChat(active), 5000);
    return () => clearInterval(interval);
    // openChat is intentionally not a dependency: polling should follow only
    // the selected conversation, not every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, active?.type]);

  async function send() {
    if (!draft.trim()) return;
    setSending(true);
    try {
      let response;
      if (active.type === "support") response = await api.sendSupportMessage(active.id, draft);
      else if (active.type === "tx") response = await api.sendTransactionChatMessage(active.txId || active.id, draft);
      else response = await api.sendDirectMessage(active.id, draft);
      const message = response?.message;
      if (message) setThread((prev) => [...prev, message]);
      notify("Message sent", "success");
      setDraft("");
    } catch (error) {
      notify(error?.message || "Unable to send message", "error");
    } finally {
      setSending(false);
    }
  }

  function messageAuthor(message, isMine) {
    const role = message.senderRole || message.role || (message.from === 'admin' ? 'admin' : 'user');
    const name = message.senderName;
    if (role === 'admin') return `Admin${name ? ` · ${name}` : ''}`;
    if (role === 'escrow') return `Escrow${name ? ` · ${name}` : ''}`;
    return isMine ? 'You' : (name || 'Customer');
  }

  async function assignToMe() {
    try {
      await api.assignSupportChat(active.id);
      notify("Chat assigned to you", "success");
    } catch {
      notify("Chat assigned to you (demo mode)", "info");
    }
  }

  return (
    <div className="chats-page">
      <div className="chats-layout">
        <Card
          title="Conversations"
          action={<button onClick={reload} className="modal-close"><RefreshCw size={13} className={loading ? "spin" : ""} /></button>}
          className="chat-list-card"
        >
          <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
            <input
              type="search"
              value={chatAdminFilter}
              onChange={(e) => setChatAdminFilter(e.target.value)}
              placeholder="Search chats by Order ID, Product ID, User, or Escrow"
              style={{ flex: 1, padding: '8px 10px', borderRadius: 6, border: '1px solid #ccc' }}
            />
            <select
              value={chatPhaseFilter}
              onChange={(e) => setChatPhaseFilter(e.target.value)}
              style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #ccc' }}
              aria-label="Filter by deal phase"
            >
              <option value="">All phases</option>
              {chatPhases.map((phase) => (
                <option key={phase} value={phase}>{phase}</option>
              ))}
            </select>
          </div>
          <div className="chat-list">
            {filteredChats.map((c) => {
              const rawName = c.user || c.userName || c.userId || c.participantName || c.buyerName || c.sellerName || 'User';
              const name = typeof rawName === 'string' ? rawName : String(rawName);
              const initials = name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
              const time = c.time || c.updatedAt || (c.messages && c.messages.length ? new Date(c.messages[c.messages.length - 1].ts || c.messages[c.messages.length - 1].time || Date.now()).toLocaleTimeString() : '');
              const preview = c.lastMessage || (c.messages && c.messages.length ? c.messages[c.messages.length - 1].text : '');
              return (
                <button key={c.id} onClick={() => openChat(c)} className={`chat-list-item ${activeId === c.id ? "active" : ""}`}>
                  <div className="chat-avatar">{initials}</div>
                  <div className="chat-list-info">
                    <div className="chat-list-name-row">
                      <p className="chat-list-name">{name}</p>
                      <span className="chat-list-time">{time}</span>
                    </div>
                    <div className="chat-list-meta">
                      <small>{c.type === 'tx' ? `Order: ${c.txId || c.orderId || c.id}` : `Chat: ${c.id}`}</small>
                      {c.productId && <small style={{ marginLeft: 8 }}>Product: {c.productId}</small>}
                      {c.stage && <small style={{ marginLeft: 8 }}>Phase: {c.stage}</small>}
                      {c.buyerName && <small style={{ marginLeft: 8 }}>Buyer: {c.buyerName}</small>}
                      {c.sellerName && <small style={{ marginLeft: 8 }}>Seller: {c.sellerName}</small>}
                      {c.escrowName && <small style={{ marginLeft: 8 }}>Escrow: {c.escrowName}</small>}
                    </div>
                    <p className="chat-list-preview">{preview}</p>
                  </div>
                  {c.unread > 0 && <span className="chat-unread-badge">{c.unread}</span>}
                </button>
              );
            })}
          </div>
        </Card>

        <Card
          className="chat-panel"
          title={active ? (active.user || active.userName || active.userId || '') : ""}
          action={
            active?.type === "support" && (
              <button onClick={assignToMe} className="link-btn">
                <Link2 size={13} /> Assign to me
              </button>
            )
          }
        >
          <div className="chat-thread">
            {thread.map((m, i) => {
              const isMine = m.userId ? m.userId === viewer?.id : m.from === 'admin';
              return (
              <div key={m.id || i} className={`chat-bubble-row ${isMine ? "mine" : "theirs"}`}>
                <div className={`chat-bubble ${isMine ? "mine" : "theirs"}`}>
                  {m.text}
                  <p className="chat-bubble-time">{messageAuthor(m, isMine)} · {m.ts ? new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (m.time || '')}</p>
                </div>
              </div>
              );
            })}
          </div>
          <div className="chat-input-row">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Type a reply..."
              className="chat-input"
            />
            <button onClick={send} disabled={sending} className="chat-send-btn">
              <Send size={16} />
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ============================================================================
   APP SHELL
============================================================================ */

export default function AdminPanel() {
  const [page, setPage] = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [toast, setToast] = useState(null);

  const notify = useCallback((text, tone = "info") => {
    setToast({ text, tone });
    window.clearTimeout(window.__toastTimer);
    window.__toastTimer = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const titles = {
    dashboard: ["Admin dashboard", "Welcome back — here's what's happening on the platform"],
    users: ["Users", "Manage buyer and seller accounts"],
    escrows: ["Escrows", "Manage escrow moderators and assignments"],
    products: ["Products", "Review and moderate marketplace listings"],
    transactions: ["Transactions", "Track status, stages, and escrow assignment"],
    chats: ["Chats", "Support and direct message threads"],
  };

  return (
    <div className="app-shell">
      <Sidebar page={page} setPage={setPage} collapsed={collapsed} setCollapsed={setCollapsed} />
      <div className="main-col">
        <Topbar title={titles[page][0]} subtitle={titles[page][1]} />
        <main className="main-content">
          {page === "dashboard" && <DashboardPage />}
          {page === "users" && <UsersPage notify={notify} />}
          {page === "escrows" && <EscrowsPage notify={notify} />}
          {page === "products" && <ProductsPage notify={notify} />}
          {page === "transactions" && <TransactionsPage notify={notify} />}
          {page === "chats" && <ChatsPage notify={notify} />}
        </main>
      </div>
      <Toast toast={toast} />
    </div>
  );
}
