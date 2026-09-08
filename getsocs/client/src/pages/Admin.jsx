import React, { useContext, useEffect, useMemo, useState, useCallback } from "react";
import { Link, Navigate } from "react-router-dom";
import AuthContext from "../context/AuthContext";
import {
  LayoutDashboard, Users, ShieldCheck, Package, ArrowLeftRight, MessageSquare,
  Search, Bell, Ban, CheckCircle2, XCircle, UserCog, UserMinus,
  Send, X, ShieldOff, Eye, RefreshCw, ArrowUpRight, ArrowDownRight,
  Clock, DollarSign, Menu, Trash2, UserCheck, ChevronRight,
  Loader2, Inbox, Link2, MessageCircle, LogOut,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import "./AdminPanel.css";
import axios from "../api/axios";
import ThemeToggle from "../components/layout/ThemeToggle";

/* ============================================================================
   API LAYER
   Every function below documents one backend endpoint. Backend failures remain
   visible to the UI instead of being replaced by fabricated production data.
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

// request() above throws a plain Error whose .message is "Request failed:
// <realBackendMessage>" - it does NOT have a .response property, so reading
// e?.response?.data?.error anywhere else always silently evaluates to
// undefined. This pulls the real message back out for display.
function cleanErrorMessage(e) {
  if (!e || !e.message) return null;
  return e.message.replace(/^Request failed:\s*/, '');
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
  getDailyActiveUsers: () => request("GET", "/admin/stats/active-users"),
  getAdminProducts: () => request("GET", "/admin/products"),
  getAdminComments: () => request("GET", "/admin/comments"),
  getAdminReviews: () => request("GET", "/admin/reviews"),
  deleteComment: (productId, commentId) => request("DELETE", `/products/${productId}/comment/${commentId}`),
  deleteReview: (reviewId) => request("DELETE", `/auth/reviews/${reviewId}`),
  getPendingProducts: () => request("GET", "/products/pending"),
  getTransactions: () => request("GET", "/transactions"),
  getTransaction: (id) => request("GET", `/transactions/${id}`),
  updateTransactionStage: (id, stage) => request("POST", `/transactions/${id}/stage`, { stage }),
  assignEscrowToTransaction: (id) => request("POST", `/transactions/${id}/assign-escrow`),
  approveProduct: (id, code) => request("POST", `/products/${id}/approve`, { code }),
  deleteProduct: (id) => request("DELETE", `/products/${id}`),
  getAdminChats: () => request("GET", "/admin/chats"),
  getProductClaims: () => request("GET", "/products/claims/pending"),
  resolveProductClaim: (productId, code, approve) => request("POST", `/products/${productId}/claim/resolve`, { code, approve }),
  getIdVerifications: () => request("GET", "/admin/id-verifications"),
  getIdVerificationImage: async (userId) => {
    const res = await axios.get(`/admin/id-verifications/${userId}/image`, { responseType: "blob" });
    return URL.createObjectURL(res.data);
  },
  reviewIdVerification: (userId, approve, reason) => request("POST", `/admin/id-verifications/${userId}/review`, { approve, reason }),

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

  // Notifications / activity
  getNotifications: () => request("GET", "/notifications"),

  // ---- Suggested additional endpoints (not in the original list, see notes) ----
  getProductDetail: (productId) => request("GET", `/admin/products/${productId}`),
  closeSupportChat: (chatId) => request("POST", `/chats/support/${chatId}/close`),
  // getActivity removed; use notifications for activity feed
  getEscrowTransactions: (userId) => request("GET", `/admin/escrows/${userId}/transactions`),
};

/* Production admin screens intentionally do not fall back to fabricated data. */

const STAGES = ["awaiting_payment", "in_escrow", "shipped", "delivered", "released", "cancelled"];


/* ============================================================================
   SMALL SHARED UI PIECES
============================================================================ */

function useAsync(fn, fallback, deps = []) {
  const [data, setData] = useState(fallback);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(() => {
    setLoading(true);
    fn()
      .then((res) => setData(res ?? fallback))
      .catch(() => setData(fallback))
      .finally(() => setLoading(false));
    // eslint-disable-next-line
  }, deps);
  useEffect(() => { reload(); }, [reload]);
  return [data, loading, reload, setData];
}

function Badge({ tone = "gray", children }) {
  return <span className={`badge badge-${tone}`}>{children || "Unknown"}</span>;
}

function IconBtn({ icon: Icon, label, tone = "gray", onClick, disabled }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={label} className={`icon-btn tone-${tone}`}>
      <Icon size={14} />
      <span>{label}</span>
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

function Card({ title, subtitle, action, children, className = "" }) {
  return (
    <div className={`card ${className}`}>
      {title && (
        <div className="card-header">
          <div>
            <h3 className="card-title">{title}</h3>
            {subtitle && <p className="card-subtitle">{subtitle}</p>}
          </div>
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
  const displayValue = value === undefined || value === null || value === "" ? "0" : value;
  return (
    <div className="stat-card">
      <div className="stat-icon-row">
        <div className={`stat-icon tone-${tone}`}><Icon size={18} /></div>
        <span className="stat-label">{label}</span>
      </div>
      <div className="stat-value-row">
        <span className="stat-value">{displayValue}</span>
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

function SearchInput({ value, onChange, placeholder, type = "search" }) {
  return (
    <div className="search-wrap">
      <Search size={15} className="search-icon" />
      <input
        type={type}
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

function formatMoney(value) {
  const amount = Number(value || 0);
  return `$${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function formatStatus(value) {
  return String(value || "unknown").replace(/_/g, " ");
}

function RefreshAction({ onClick, loading, label = "Refresh" }) {
  return (
    <button type="button" onClick={onClick} className="refresh-btn">
      <RefreshCw size={13} className={loading ? "spin" : ""} />
      <span>{label}</span>
    </button>
  );
}

/* ============================================================================
   NAVIGATION
============================================================================ */

const NAV = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "users", label: "Users", icon: Users },
  { key: "id-verifications", label: "ID Verifications", icon: UserCheck },
  { key: "escrows", label: "Escrows", icon: ShieldCheck, adminOnly: true },
  { key: "products", label: "Products", icon: Package },
  { key: "transactions", label: "Transactions", icon: ArrowLeftRight },
  { key: "chats", label: "Chats", icon: MessageSquare },
  { key: "comments", label: "Comments & reviews", icon: MessageCircle },
];

function Sidebar({ page, setPage, collapsed, setCollapsed, isAdmin, mobileOpen = false, onMobileClose }) {
  const navItems = NAV.filter((item) => !item.adminOnly || isAdmin);

  function navigateTo(key) {
    setPage(key);
    if (onMobileClose) onMobileClose();
  }

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo">GS</div>
        {!collapsed && (
          <span className="sidebar-title">
            <strong>GETSOCS</strong>
            <small>Admin control center</small>
          </span>
        )}
        <button onClick={() => setCollapsed(!collapsed)} className="sidebar-collapse-btn">
          <Menu size={16} />
        </button>
        <button onClick={onMobileClose} className="sidebar-mobile-close" aria-label="Close admin menu">
          <X size={16} />
        </button>
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <button
            key={item.key}
            onClick={() => navigateTo(item.key)}
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

function Topbar({ title, subtitle, onMenuClick, user, onLogout }) {
  const initial = String(user?.username || user?.name || user?.email || "A").trim().slice(0, 1).toUpperCase() || "A";

  return (
    <header className="topbar">
      <button type="button" className="admin-mobile-menu-btn" onClick={onMenuClick} aria-label="Open admin menu">
        <Menu size={18} />
      </button>
      <div>
        <h1 className="topbar-title">{title}</h1>
        {subtitle && <p className="topbar-subtitle">{subtitle}</p>}
      </div>
      <div className="topbar-search">
        <SearchInput value="" onChange={() => {}} placeholder="Search admin data..." />
      </div>
      <div className="topbar-actions">
        <ThemeToggle className="admin-theme-toggle" />
        <button className="bell-btn">
          <Bell size={18} />
          <span className="bell-badge">3</span>
        </button>
        <span className="admin-avatar" aria-label="Current admin">{initial}</span>
        <button type="button" className="admin-logout-btn" onClick={onLogout}>
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
}

/* ============================================================================
   DASHBOARD PAGE
============================================================================ */

function DashboardPage() {
  const [stats, statsLoading] = useAsync(api.getStats, {}, []);
  const [dailyUsers, dailyUsersLoading] = useAsync(api.getDailyActiveUsers, [], []);
  const [activity] = useAsync(api.getNotifications, [], []);

  const signInTrend = useMemo(() => {
    const items = Array.isArray(dailyUsers) ? dailyUsers : [];
    if (!items.length) return [{ day: "No activity", signIns: 0 }];

    return items
      .slice(-7)
      .map((entry) => ({
        day: new Date(`${entry.day}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        signIns: Number(entry.activeUsers || 0)
      }));
  }, [dailyUsers]);

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
        <Card title="Platform overview" subtitle="Active users over the last seven reporting days">
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={signInTrend}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="day" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(value) => [`${value}`, "Users active"]}
                  labelFormatter={(label) => `Date: ${label}`}
                  contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, fontSize: 12 }}
                />
                <Area type="monotone" dataKey="signIns" stroke="#a78bfa" fill="url(#rev)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Recent activity" subtitle="Latest platform notifications and moderation signals">
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
            {activity.length === 0 && <EmptyState icon={Bell} text="No recent activity to show" />}
          </div>
        </Card>
      </div>
      {(statsLoading || dailyUsersLoading) && <p className="muted-note">Refreshing stats…</p>}
    </div>
  );
}

/* ============================================================================
   USERS PAGE
============================================================================ */

function UsersPage({ notify, isAdmin }) {
  const [users, loading, reload, setUsers] = useAsync(api.getUsers, [], []);
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
    } catch (e) {
      notify(cleanErrorMessage(e) || `${label} failed`, "error");
    }
    setBusyId(null);
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
        <div className="ml-auto"><RefreshAction onClick={reload} loading={loading} /></div>
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
                  <td className="table-sub">{u.joined || "—"}</td>
                  <td>
                    <div className="table-actions">
                      {u.status === "active" ? (
                        <IconBtn icon={Ban} label="Ban" tone="red" disabled={busyId === u.id} onClick={() => act(u.id, "ban", "Ban user")} />
                      ) : (
                        <IconBtn icon={UserCheck} label="Unban" tone="green" disabled={busyId === u.id} onClick={() => act(u.id, "unban", "Unban user")} />
                      )}
                      {u.role !== "escrow" ? (
                        isAdmin && <IconBtn icon={UserCog} label="Make escrow" tone="violet" disabled={busyId === u.id} onClick={() => act(u.id, "makeEscrow", "Make escrow")} />
                      ) : (
                        isAdmin && <IconBtn icon={UserMinus} label="Remove escrow" tone="gray" disabled={busyId === u.id} onClick={() => act(u.id, "removeEscrow", "Remove escrow")} />
                      )}
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
   ID VERIFICATIONS PAGE
============================================================================ */

function IdVerificationsPage({ notify }) {
  const [requests, loading, reload, setRequests] = useAsync(api.getIdVerifications, [], []);
  const [busyId, setBusyId] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [documentImageUrl, setDocumentImageUrl] = useState('');
  const [documentImageError, setDocumentImageError] = useState('');

  useEffect(() => {
    let revokedUrl = '';
    setDocumentImageUrl('');
    setDocumentImageError('');
    if (!viewing?.imageFile) return undefined;
    api.getIdVerificationImage(viewing.userId)
      .then((url) => { revokedUrl = url; setDocumentImageUrl(url); })
      .catch((error) => setDocumentImageError(cleanErrorMessage(error) || 'Unable to load the protected document image.'));
    return () => { if (revokedUrl) URL.revokeObjectURL(revokedUrl); };
  }, [viewing?.userId, viewing?.imageFile]);

  async function review(userId, approve, reason) {
    setBusyId(userId);
    try {
      await api.reviewIdVerification(userId, approve, reason);
      notify(approve ? "ID approved" : "ID rejected", "success");
      setRequests((prev) => prev.filter((r) => r.userId !== userId));
      setViewing(null);
      setRejectReason('');
    } catch (e) {
      notify(cleanErrorMessage(e) || "Unable to review this submission", "error");
    }
    setBusyId(null);
  }

  return (
    <div className="page">
      <div className="filters-row">
        <p className="muted-note">Review documents users submitted to get the verified badge. Approving grants the badge; rejecting lets them resubmit.</p>
        <div className="ml-auto"><RefreshAction onClick={reload} loading={loading} /></div>
      </div>
      <Card>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>User</th>
                <th>Document</th>
                <th>Submitted</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.userId}>
                  <td>
                    <p className="table-name">{r.username}</p>
                    <p className="table-sub">{r.email}</p>
                  </td>
                  <td>{r.documentType} · {r.documentId}</td>
                  <td>{r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : '—'}</td>
                  <td>
                    <div className="table-actions">
                      <IconBtn icon={Eye} label="View" tone="gray" onClick={() => setViewing(r)} />
                      <IconBtn icon={CheckCircle2} label="Approve" tone="green" disabled={busyId === r.userId} onClick={() => review(r.userId, true)} />
                      <IconBtn icon={XCircle} label="Reject" tone="red" disabled={busyId === r.userId} onClick={() => setViewing({ ...r, rejecting: true })} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {requests.length === 0 && <EmptyState icon={UserCheck} text="No pending ID verifications" />}
        </div>
      </Card>

      <Modal open={!!viewing} onClose={() => { setViewing(null); setRejectReason(''); }} title={viewing ? `${viewing.username} — ${viewing.documentType}` : ""}>
        {viewing && (
          <div className="pending-list">
            <div className="pending-item">
              <span className="table-name">Document ID</span>
              <span>{viewing.documentId}</span>
            </div>
            {viewing.imageFile && !documentImageUrl && !documentImageError && (
              <p className="muted-note">Loading protected document…</p>
            )}
            {documentImageError && <div className="auth-alert">{documentImageError}</div>}
            {documentImageUrl && (
              <img src={documentImageUrl} alt="Submitted ID document" className="document-preview" />
            )}
            {viewing.rejecting ? (
              <>
                <input
                  className="admin-text-input"
                  type="text"
                  placeholder="Reason for rejection (optional)"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
                <div className="modal-actions">
                  <IconBtn icon={XCircle} label="Confirm reject" tone="red" disabled={busyId === viewing.userId} onClick={() => review(viewing.userId, false, rejectReason)} />
                </div>
              </>
            ) : (
              <div className="modal-actions">
                <IconBtn icon={CheckCircle2} label="Approve" tone="green" disabled={busyId === viewing.userId} onClick={() => review(viewing.userId, true)} />
                <IconBtn icon={XCircle} label="Reject" tone="red" disabled={busyId === viewing.userId} onClick={() => setViewing((prev) => ({ ...prev, rejecting: true }))} />
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ============================================================================
   ESCROWS PAGE
============================================================================ */

function EscrowsPage({ notify }) {
  const [escrows, loading, reload, setEscrows] = useAsync(api.getEscrows, [], []);
  const [busyId, setBusyId] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [txForEscrow, setTxForEscrow] = useState([]);

  async function ban(userId) {
    setBusyId(userId);
    try {
      await api.banEscrow(userId, "Policy violation");
      notify("Escrow banned", "success");
      setEscrows((prev) => prev.map((e) => (e.id === userId ? { ...e, status: "banned" } : e)));
    } catch (e) {
      notify(cleanErrorMessage(e) || "Unable to ban this escrow account", "error");
    }
    setBusyId(null);
  }

  async function openEscrow(e) {
    setViewing(e);
    try {
      const tx = await api.getEscrowTransactions(e.id);
      setTxForEscrow(tx ?? []);
    } catch {
      setTxForEscrow([]);
    }
  }

  return (
    <div className="page">
      <div className="filters-row">
        <p className="muted-note">Escrow moderators handle assigned transactions and hold funds until release.</p>
        <div className="ml-auto"><RefreshAction onClick={reload} loading={loading} /></div>
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
                  <td className="table-name">{e.assigned ?? 0}</td>
                  <td><Badge tone={statusTone(e.status)}>{formatStatus(e.status)}</Badge></td>
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
                <Badge tone={statusTone(t.status)}>{formatStatus(t.status)}</Badge>
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
  const [pending, pendingLoading, reloadPending, setPending] = useAsync(api.getPendingProducts, [], []);
  const [all, allLoading, reloadAll, setAll] = useAsync(api.getAdminProducts, [], []);
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
      notify(cleanErrorMessage(e) || "Unable to resolve this claim", "error");
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
      notify(cleanErrorMessage(e) || "Unable to approve this listing", "error");
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
      notify(cleanErrorMessage(e) || "Unable to remove this listing", "error");
    }
    setBusyId(null);
  }

  async function removeProduct(id) {
    setBusyId(id);
    try {
      await api.deleteProduct(id);
      notify("Product removed from listings", "success");
      setAll((prev) => (Array.isArray(prev) ? prev.filter((p) => p.id !== id) : prev));
      setPending((prev) => (Array.isArray(prev) ? prev.filter((p) => p.id !== id) : prev));
    } catch (e) {
      notify(cleanErrorMessage(e) || "Unable to remove this listing", "error");
    } finally {
      setBusyId(null);
    }
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
        <Card title="Pending approvals" subtitle="Listings waiting for marketplace review" action={<RefreshAction onClick={reloadPending} loading={pendingLoading} label="Sync" />}>
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
                    <span className="pending-price">{formatMoney(p.price)}</span>
                    <IconBtn icon={CheckCircle2} label="Approve" tone="green" disabled={busyId === p.id} onClick={() => approve(p.id, p.code)} />
                    <IconBtn icon={Trash2} label="Reject" tone="red" disabled={busyId === p.id} onClick={() => reject(p.id)} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : tab === "all" ? (
        <Card title="All products" subtitle="Published, pending, and moderated listings" action={<RefreshAction onClick={reloadAll} loading={allLoading} label="Sync" />}>
          {allRows.length === 0 ? (
            <EmptyState icon={Package} text="No products found" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Seller</th>
                    <th>Price</th>
                    <th>Status</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {allRows.map((p) => (
                    <tr key={p.id}>
                      <td className="table-name">{p.name || "Untitled product"}</td>
                      <td className="table-sub"><SellerLink sellerId={p.sellerId} sellerName={p.seller} /></td>
                      <td className="table-name">{formatMoney(p.price)}</td>
                      <td><Badge tone={statusTone(p.status)}>{formatStatus(p.status)}</Badge></td>
                      <td className="text-right">
                        <IconBtn icon={Trash2} label="Remove" tone="red" disabled={busyId === p.id} onClick={() => removeProduct(p.id)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : (
        <Card title="Ownership claims" subtitle="User-submitted claim codes for existing listings" action={<RefreshAction onClick={reloadClaims} loading={claimsLoading} label="Sync" />}>
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

function CommentsPage({ notify }) {
  const [tab, setTab] = useState('comments');
  const [comments, commentsLoading, reloadComments, setComments] = useAsync(api.getAdminComments, [], []);
  const [reviews, reviewsLoading, reloadReviews, setReviews] = useAsync(api.getAdminReviews, [], []);
  const [busyId, setBusyId] = useState(null);

  const commentRows = Array.isArray(comments) ? comments : [];
  const reviewRows = Array.isArray(reviews) ? reviews : [];

  async function removeComment(comment) {
    setBusyId(comment.id);
    try {
      await api.deleteComment(comment.productId, comment.id);
      setComments((prev) => prev.filter((c) => c.id !== comment.id));
      notify('Comment deleted', 'success');
    } catch (e) {
      notify(cleanErrorMessage(e) || 'Unable to delete comment', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function removeReview(review) {
    setBusyId(review.id);
    try {
      await api.deleteReview(review.id);
      setReviews((prev) => prev.filter((r) => r.id !== review.id));
      notify('Review deleted', 'success');
    } catch (e) {
      notify(cleanErrorMessage(e) || 'Unable to delete review', 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="page">
      <div className="tab-group">
        {[
          ['comments', 'Comments'],
          ['reviews', 'Reviews'],
        ].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`tab-btn ${tab === key ? 'active' : ''}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'comments' ? (
        <Card title="Listing comments" subtitle="Moderate customer discussion on marketplace listings" action={<RefreshAction onClick={reloadComments} loading={commentsLoading} label="Sync" />}>
          {commentRows.length === 0 ? (
            <EmptyState icon={MessageCircle} text="No comments found" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Comment</th>
                    <th>Author</th>
                    <th>Product</th>
                    <th>Date</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {commentRows.map((comment) => (
                    <tr key={comment.id}>
                      <td>{comment.text}</td>
                      <td>{comment.authorName}</td>
                      <td>{comment.productTitle}</td>
                      <td>{new Date(comment.ts).toLocaleString()}</td>
                      <td className="text-right">
                        <IconBtn icon={Trash2} label="Delete" tone="red" disabled={busyId === comment.id} onClick={() => removeComment(comment)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : (
        <Card title="User reviews" subtitle="Inspect feedback left between buyers, sellers, and escrow users" action={<RefreshAction onClick={reloadReviews} loading={reviewsLoading} label="Sync" />}>
          {reviewRows.length === 0 ? (
            <EmptyState icon={MessageCircle} text="No reviews found" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Rating</th>
                    <th>Type</th>
                    <th>Author</th>
                    <th>Target</th>
                    <th>Content</th>
                    <th>Date</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewRows.map((review) => (
                    <tr key={review.id}>
                      <td>{review.rating}/5</td>
                      <td>{review.type}</td>
                      <td>{review.authorName}</td>
                      <td>{review.targetName}</td>
                      <td>{review.text || '—'}</td>
                      <td>{new Date(review.ts).toLocaleString()}</td>
                      <td className="text-right">
                        <IconBtn icon={Trash2} label="Delete" tone="red" disabled={busyId === review.id} onClick={() => removeReview(review)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
    escrow: t.escrowName || t.escrow || null,
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
        escrow: full.escrowName || full.escrow || null,
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
      setRawTxs((prev) => prev.map((r) => (r.id === selected.id ? { ...r, stage } : r)));
      setSelected((s) => ({ ...s, stage }));
    } catch (e) {
      notify(cleanErrorMessage(e) || "Unable to update the stage", "error");
    }
    setSaving(false);
  }

  async function takeAsEscrow() {
    setSaving(true);
    try {
      const res = await api.assignEscrowToTransaction(selected.id);
      const escrowName = res?.tx?.escrowName || "You";
      notify("You are now the escrow for this transaction", "success");
      setRawTxs((prev) => prev.map((r) => (r.id === selected.id ? { ...r, escrow: escrowName, escrowId: res?.tx?.escrowId } : r)));
      setSelected((s) => ({ ...s, escrow: escrowName }));
    } catch (e) {
      notify(cleanErrorMessage(e) || "Unable to assign escrow", "error");
    }
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
        <div className="ml-auto"><RefreshAction onClick={reload} loading={loading} /></div>
      </div>

      <Card title="Transaction ledger" subtitle="Track order state, value, and escrow coverage">
        <div className="table-wrap">
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
                <td className="table-name">{t.item || "Untitled transaction"}</td>
                <td className="table-sub">{t.buyer} → {t.seller}</td>
                <td className="table-name">{formatMoney(t.amount)}</td>
                <td className="table-sub">{t.escrow || "—"}</td>
                <td><Badge tone={statusTone(t.status)}>{formatStatus(t.status)}</Badge></td>
                <td className="text-right">
                  <button type="button" onClick={() => open(t)} className="link-btn">
                    View <ChevronRight size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <EmptyState icon={ArrowLeftRight} text="No transactions match this filter" />}
        </div>
      </Card>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected ? `Transaction ${selected.id}` : ""}>
        {selected && (
          <div className="tx-section">
            <div className="detail-grid">
              <div><p className="detail-label">Item</p><p className="detail-value">{selected.item}</p></div>
              <div><p className="detail-label">Amount</p><p className="detail-value">{formatMoney(selected.amount)}</p></div>
              <div><p className="detail-label">Buyer</p><p className="detail-value">{selected.buyer}</p></div>
              <div><p className="detail-label">Seller</p><p className="detail-value">{selected.seller}</p></div>
            </div>

            <div>
              <p className="detail-block-title">Workflow stage</p>
              <div className="chip-group">
                {STAGES.map((s) => (
                  <button key={s} disabled={saving} onClick={() => changeStage(s)} className={`chip ${selected.stage === s ? "active" : ""}`}>
                    {formatStatus(s)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="detail-block-title">Escrow</p>
              {selected.escrow ? (
                <p className="detail-block-value">Handled by {selected.escrow}</p>
              ) : (
                <button disabled={saving} onClick={takeAsEscrow} className="btn secondary">
                  Take this transaction as escrow
                </button>
              )}
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
      reload();
    } catch (e) {
      notify(cleanErrorMessage(e) || "Unable to assign this chat to you", "error");
    }
  }

  return (
    <div className="chats-page">
      <div className="chats-layout">
        <Card
          title="Conversations"
          subtitle="Search and triage support, direct, and transaction threads"
          action={<RefreshAction onClick={reload} loading={loading} label="Sync" />}
          className="chat-list-card"
        >
          <div className="chat-filter-row">
            <SearchInput
              value={chatAdminFilter}
              onChange={setChatAdminFilter}
              placeholder="Search order, product, user, or escrow..."
            />
            <select
              value={chatPhaseFilter}
              onChange={(e) => setChatPhaseFilter(e.target.value)}
              className="admin-select"
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
                      {c.productId && <small>Product: {c.productId}</small>}
                      {c.stage && <small>Phase: {formatStatus(c.stage)}</small>}
                      {c.buyerName && <small>Buyer: {c.buyerName}</small>}
                      {c.sellerName && <small>Seller: {c.sellerName}</small>}
                      {c.escrowName && <small>Escrow: {c.escrowName}</small>}
                    </div>
                    <p className="chat-list-preview">{preview}</p>
                  </div>
                  {c.unread > 0 && <span className="chat-unread-badge">{c.unread}</span>}
                </button>
              );
            })}
            {filteredChats.length === 0 && <EmptyState icon={MessageSquare} text="No conversations match this search" />}
          </div>
        </Card>

        <Card
          className="chat-panel"
          title={active ? (active.user || active.userName || active.userId || '') : ""}
          action={
            active?.type === "support" && (
              <button type="button" onClick={assignToMe} className="link-btn">
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
            {thread.length === 0 && <EmptyState icon={MessageSquare} text="No messages loaded for this conversation" />}
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
  const { user, logout } = useContext(AuthContext);
  const isAdmin = user?.role === "admin";
  const isStaff = isAdmin || user?.role === "escrow";
  const [page, setPage] = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const notify = useCallback((text, tone = "info") => {
    setToast({ text, tone });
    window.clearTimeout(window.__toastTimer);
    window.__toastTimer = window.setTimeout(() => setToast(null), 2600);
  }, []);

  // Admin and escrow accounts share most of this panel (both handle
  // listings, transactions, chats, and comment moderation day to day), but
  // escrow is explicitly NOT allowed to manage who holds escrow/admin
  // privileges - that page and those specific actions are admin-only.
  useEffect(() => {
    if (!isAdmin && page === "escrows") setPage("dashboard");
  }, [isAdmin, page]);

  if (!isStaff) {
    return <Navigate to="/profile" replace />;
  }

  const titles = {
    dashboard: ["Admin dashboard", "Welcome back — here's what's happening on the platform"],
    users: ["Users", "Manage buyer and seller accounts"],
    "id-verifications": ["ID verifications", "Review submitted identity documents"],
    escrows: ["Escrows", "Manage escrow moderators and assignments"],
    products: ["Products", "Review and moderate marketplace listings"],
    transactions: ["Transactions", "Track status, stages, and escrow assignment"],
    chats: ["Chats", "Support and direct message threads"],
    comments: ["Comments & reviews", "Moderate listing comments and user reviews"],
  };

  return (
    <div className="admin-panel-root">
      <button
        type="button"
        className={`admin-sidebar-backdrop ${mobileSidebarOpen ? "show" : ""}`}
        aria-label="Close admin menu"
        onClick={() => setMobileSidebarOpen(false)}
      />
      <Sidebar
        page={page}
        setPage={setPage}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        isAdmin={isAdmin}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />
      <div className="main-col">
        <Topbar
          title={titles[page]?.[0] || "Admin"}
          subtitle={titles[page]?.[1] || ""}
          onMenuClick={() => setMobileSidebarOpen(true)}
          user={user}
          onLogout={logout}
        />
        <main className="main-content">
          {page === "dashboard" && <DashboardPage />}
          {page === "users" && <UsersPage notify={notify} isAdmin={isAdmin} />}
          {page === "id-verifications" && <IdVerificationsPage notify={notify} />}
          {page === "escrows" && isAdmin && <EscrowsPage notify={notify} />}
          {page === "products" && <ProductsPage notify={notify} />}
          {page === "transactions" && <TransactionsPage notify={notify} />}
          {page === "chats" && <ChatsPage notify={notify} />}
          {page === "comments" && <CommentsPage notify={notify} />}
        </main>
      </div>
      <Toast toast={toast} />
    </div>
  );
}
