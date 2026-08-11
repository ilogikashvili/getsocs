import React from 'react';
import { Link } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import { getUploadUrl } from '../api/axios';
import { uploadProfilePhotos, changePassword } from '../services/authService';
import { getMembershipTiers, getMyMembership, subscribeToTier } from '../services/membershipService';
import { validatePassword } from '../utils/validation';

const PROFILE_TABS = ['Summary', 'Activity', 'Badges', 'Follows', 'Earnings', 'Feedback', 'Settings'];

const BADGES = [
  {
    id: 'id-verified',
    icon: 'ID',
    title: 'ID Verified',
    text: 'Identity checked before trading on Getsocs.',
    earned: true
  },
  {
    id: 'trusted-seller',
    icon: 'TS',
    title: 'Trusted Seller',
    text: 'Keeps listings accurate and completes clean transfers.',
    earned: true
  },
  {
    id: 'escrow-ready',
    icon: 'ER',
    title: 'Escrow Ready',
    text: 'Uses escrow flow for safer social account deals.',
    earned: true
  },
  {
    id: 'fast-responder',
    icon: 'FR',
    title: 'Fast Responder',
    text: 'Replies quickly to buyers, sellers, and support.',
    earned: false
  },
  {
    id: 'community-builder',
    icon: 'CB',
    title: 'Community Builder',
    text: 'Creates useful listings, comments, and reports.',
    earned: false
  },
  {
    id: 'premium-member',
    icon: 'GS',
    title: 'Getsocs Member',
    text: 'Active member with marketplace access enabled.',
    earned: true
  }
];

const RECENT_ACTIVITY = [
  {
    title: 'Profile prepared for verified trading',
    meta: 'Today',
    detail: 'Account details, badges, and trust stats are visible to marketplace users.'
  },
  {
    title: 'Escrow protection enabled',
    meta: 'Security',
    detail: 'Deals can move through a protected buyer and seller confirmation flow.'
  },
  {
    title: 'Badge showcase added',
    meta: 'Reputation',
    detail: 'Important trust signals now have their own dedicated profile section.'
  }
];

const FOLLOWING = [
  { username: 'creatorhub', name: 'Creator Hub', detail: 'YouTube and TikTok seller updates' },
  { username: 'socialvault', name: 'Social Vault', detail: 'Escrow-first marketplace member' },
  { username: 'growthdesk', name: 'Growth Desk', detail: 'Telegram and Instagram deal watcher' }
];

const FOLLOWERS = [
  { username: 'marketbuyer', name: 'Market Buyer', detail: 'Interested in verified pages' },
  { username: 'safetrades', name: 'Safe Trades', detail: 'Completed buyer profile' },
  { username: 'getsocspro', name: 'Getsocs Pro', detail: 'Reputation-focused member' }
];

const FEEDBACK_ITEMS = [
  { from: 'Market Buyer', rating: '5/5', text: 'Clear profile, fast responses, and escrow-friendly deal flow.' },
  { from: 'Safe Trades', rating: '5/5', text: 'Trust badges and profile details make this member easier to verify.' },
  { from: 'Getsocs Desk', rating: 'Verified', text: 'Account is prepared for marketplace reputation tracking.' }
];

function getDisplayName(user) {
  const fullName = `${user?.name || ''} ${user?.lastname || ''}`.trim();
  return fullName || user?.username || 'Getsocs member';
}

function getInitials(user) {
  return getDisplayName(user)
    .split(' ')
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function formatMoney(value) {
  return `GEL ${(value || 0).toLocaleString()}`;
}

function formatUsd(value) {
  return `$${Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function getTierStyle(tier) {
  const id = tier?.id || '';
  const name = tier?.name || '';
  if (id.includes('plus') || id.includes('premium') || name.includes('+')) return 'vip-plus';
  if (id.includes('vip') || name.toLowerCase().includes('vip')) return 'vip';
  return '';
}

export default function Profile() {
  const { user, updateUser } = React.useContext(AuthContext);
  const [activeTab, setActiveTab] = React.useState('Summary');
  const [profileNotice, setProfileNotice] = React.useState('');
  const [membershipTiers, setMembershipTiers] = React.useState([]);
  const [membershipSummary, setMembershipSummary] = React.useState(null);
  const [membershipLoading, setMembershipLoading] = React.useState(false);
  const [membershipError, setMembershipError] = React.useState('');
  const [buyingTierId, setBuyingTierId] = React.useState('');
  const [profilePhotoFile, setProfilePhotoFile] = React.useState(null);
  const [backgroundPhotoFile, setBackgroundPhotoFile] = React.useState(null);
  const [mediaSaving, setMediaSaving] = React.useState(false);
  const mediaFormRef = React.useRef(null);
  const [passwordForm, setPasswordForm] = React.useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordError, setPasswordError] = React.useState('');
  const [passwordSaving, setPasswordSaving] = React.useState(false);
  const userId = user?.id;

  React.useEffect(() => {
    if (!userId) return undefined;

    let mounted = true;
    async function loadMembershipData() {
      setMembershipLoading(true);
      setMembershipError('');
      try {
        const [tiersRes, membershipRes] = await Promise.all([getMembershipTiers(), getMyMembership()]);
        if (!mounted) return;
        if (tiersRes?.data?.success) setMembershipTiers(tiersRes.data.tiers || []);
        if (membershipRes?.data?.success) setMembershipSummary(membershipRes.data.summary || null);
      } catch (err) {
        if (mounted) setMembershipError(err.response?.data?.error || 'Unable to load membership plans.');
      } finally {
        if (mounted) setMembershipLoading(false);
      }
    }

    loadMembershipData();
    return () => { mounted = false; };
  }, [userId]);

  if (!user) {
    return <div className="page-shell"><div className="empty-state">Please login to view your profile.</div></div>;
  }

  const purchased = user.pointsBought || 0;
  const sold = user.pointsSold || 0;
  const totalVolume = purchased + sold;
  const earnedBadges = BADGES.filter(badge => badge.earned).length;
  const displayName = getDisplayName(user);
  const initials = getInitials(user);
  const roleLabel = user.role || 'user';
  const activeTier = membershipSummary?.tier || null;
  const activeTierStyle = getTierStyle(activeTier);
  const profilePhotoUrl = user.profilePhoto ? getUploadUrl(user.profilePhoto) : '/getsocs-logo.png';
  const heroBackgroundStyle = user.backgroundPhoto
    ? { backgroundImage: `linear-gradient(90deg, rgba(8,13,24,0.9), rgba(8,13,24,0.74)), url(${getUploadUrl(user.backgroundPhoto)})` }
    : undefined;
  const canSaveMedia = !!profilePhotoFile || !!backgroundPhotoFile;
  const showNotice = message => setProfileNotice(message);

  const handleBuyTier = async tier => {
    setBuyingTierId(tier.id);
    setMembershipError('');
    try {
      const subscribeRes = await subscribeToTier(tier.id);
      if (!subscribeRes?.data?.success) {
        throw new Error(subscribeRes?.data?.error || 'Membership purchase failed.');
      }
      const membershipRes = await getMyMembership();
      if (membershipRes?.data?.success) {
        setMembershipSummary(membershipRes.data.summary || null);
      }
      showNotice(`${tier.name} is active on your profile.`);
    } catch (err) {
      setMembershipError(err.response?.data?.error || err.message || 'Membership purchase failed.');
    } finally {
      setBuyingTierId('');
    }
  };

  const handleMediaSubmit = async event => {
    event.preventDefault();
    if (!canSaveMedia) {
      showNotice('Choose a profile photo or background photo first.');
      return;
    }

    setMediaSaving(true);
    try {
      const formData = new FormData();
      if (profilePhotoFile) formData.append('profilePhoto', profilePhotoFile);
      if (backgroundPhotoFile) formData.append('backgroundPhoto', backgroundPhotoFile);
      const res = await uploadProfilePhotos(formData);
      if (!res?.data?.success) {
        throw new Error(res?.data?.error || 'Photo upload failed.');
      }
      updateUser(res.data.user);
      setProfilePhotoFile(null);
      setBackgroundPhotoFile(null);
      mediaFormRef.current?.reset();
      showNotice('Profile photos updated.');
    } catch (err) {
      showNotice(err.response?.data?.error || err.message || 'Photo upload failed.');
    } finally {
      setMediaSaving(false);
    }
  };

  const handleChangePassword = async event => {
    event.preventDefault();
    setPasswordError('');
    const validation = validatePassword(passwordForm.newPassword);
    if (!validation.ok) {
      setPasswordError(validation.message);
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }
    setPasswordSaving(true);
    try {
      await changePassword(passwordForm.oldPassword, passwordForm.newPassword);
      setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
      showNotice('Password changed successfully.');
    } catch (err) {
      setPasswordError(err.response?.data?.error || 'Unable to change password.');
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="page-shell profile-page">
      <section
        className={`profile-hero-card ${activeTierStyle ? `membership-${activeTierStyle}` : ''} ${user.backgroundPhoto ? 'has-background' : ''}`.trim()}
        style={heroBackgroundStyle}
      >
        <div className="profile-identity">
          <div className="profile-avatar-wrap">
            <img src={profilePhotoUrl} alt="Profile" />
            <span>{initials}</span>
          </div>
          <div>
            <div className="profile-kicker">Getsocs profile</div>
            <h2>{user.username}</h2>
            <p>{displayName}</p>
            <div className="profile-rating" aria-label="Five star profile rating">
              <span>* * * * *</span>
              <small>Trusted marketplace member</small>
            </div>
            <div className="profile-location">Registered in Georgia - Located in Georgia</div>
          </div>
        </div>

        <div className="profile-actions">
          <span className={`role-badge role-${roleLabel}`}>{roleLabel}</span>
          <span className={`membership-status ${activeTierStyle ? `membership-status-${activeTierStyle}` : ''}`}>
            {activeTier ? activeTier.name : 'No VIP'}
          </span>
          <Link className="btn primary" to="/upload">Create listing</Link>
          <Link className="btn secondary" to="/messages">Messages</Link>
        </div>
      </section>

      <section className="profile-media-panel">
        <form ref={mediaFormRef} onSubmit={handleMediaSubmit}>
          <label className="media-upload-control">
            <span className="media-upload-title">Profile photo</span>
            {user.profilePhoto && <small>Current photo will be replaced when you upload a new file.</small>}
            <span className="media-upload-row"><span className="file-picker-button">Choose file</span><span className="file-picker-name">{profilePhotoFile?.name || (user.profilePhoto ? 'Current photo' : 'No file chosen')}</span></span>
            <input className="visually-hidden-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setProfilePhotoFile(event.target.files?.[0] || null)} />
          </label>
          <label className="media-upload-control">
            <span className="media-upload-title">Background photo</span>
            {user.backgroundPhoto && <small>Current background will be replaced when you upload a new file.</small>}
            <span className="media-upload-row"><span className="file-picker-button">Choose file</span><span className="file-picker-name">{backgroundPhotoFile?.name || (user.backgroundPhoto ? 'Current background' : 'No file chosen')}</span></span>
            <input className="visually-hidden-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setBackgroundPhotoFile(event.target.files?.[0] || null)} />
          </label>
          <button className="btn primary" type="submit" disabled={mediaSaving || !canSaveMedia}>
            {mediaSaving ? 'Saving...' : 'Save photos'}
          </button>
        </form>
      </section>

      <section className="profile-membership-panel">
        <div className="panel-heading">
          <div>
            <h3>VIP membership</h3>
            <p>{activeTier ? `${activeTier.name} active - ${activeTier.daysRemaining} days remaining` : 'Choose a card shine for your listings.'}</p>
          </div>
          {membershipLoading && <strong>Loading</strong>}
        </div>
        {membershipError && <div className="profile-inline-error">{membershipError}</div>}
        <div className="membership-plan-grid">
          {membershipTiers.map(tier => {
            const tierStyle = getTierStyle(tier);
            const isActive = activeTier?.id === tier.id;
            return (
              <article key={tier.id} className={`membership-plan-card membership-plan-${tierStyle} ${isActive ? 'active' : ''}`.trim()}>
                <div>
                  <span>{tier.name}</span>
                  <strong>{formatUsd(tier.price)}</strong>
                </div>
                <ul>
                  {(tier.benefits || []).slice(0, 3).map(benefit => <li key={benefit}>{benefit}</li>)}
                </ul>
                <button
                  type="button"
                  disabled={isActive || buyingTierId === tier.id}
                  onClick={() => handleBuyTier(tier)}
                >
                  {isActive ? 'Active' : buyingTierId === tier.id ? 'Buying...' : `Buy ${tier.name}`}
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <nav className="profile-tabbar" aria-label="Profile sections" role="tablist">
        {PROFILE_TABS.map(tab => (
          <button
            key={tab}
            type="button"
            role="tab"
            className={activeTab === tab ? 'active' : ''}
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>

      <section className="profile-stats-grid">
        <div className="profile-stat"><strong>{earnedBadges}/{BADGES.length}</strong><span>badges earned</span></div>
        <div className="profile-stat"><strong>{formatMoney(purchased)}</strong><span>purchased</span></div>
        <div className="profile-stat"><strong>{formatMoney(sold)}</strong><span>sold</span></div>
        <div className="profile-stat"><strong>{formatMoney(totalVolume)}</strong><span>total volume</span></div>
        <div className="profile-stat"><strong>100%</strong><span>escrow ready</span></div>
        <div className="profile-stat"><strong>5</strong><span>trust score</span></div>
      </section>

      {profileNotice && (
        <div className="profile-toast" role="status">
          <span>{profileNotice}</span>
          <button type="button" onClick={() => setProfileNotice('')}>Close</button>
        </div>
      )}

      {activeTab === 'Summary' && (
        <section className="profile-main-grid profile-tab-section">
          <div className="profile-panel profile-summary-panel">
            <div className="panel-heading">
              <div>
                <h3>Summary</h3>
                <p>Account details and reputation overview.</p>
              </div>
            </div>

            <div className="profile-detail-list">
              <div><span>Username</span><strong>{user.username}</strong></div>
              <div><span>Name</span><strong>{displayName}</strong></div>
              <div><span>Email</span><strong>{user.email || 'Not provided'}</strong></div>
              <div><span>Mobile</span><strong>{user.mobile || 'Not provided'}</strong></div>
            </div>

            <div className={`profile-note note-${roleLabel}`}>
              {roleLabel === 'admin'
                ? 'Admin access is active. You can manage users, products, chats, and escrow permissions.'
                : roleLabel === 'escrow'
                  ? 'Escrow access is active. You can review pending uploads and moderate suspicious users.'
                  : 'Buyer and seller access is active. Use escrow, earn badges, and build reputation through clean deals.'}
            </div>
          </div>

          <div className="profile-panel profile-earnings-card">
            <span>Current earnings</span>
            <strong>{formatMoney(sold)}</strong>
            <p>Lifetime marketplace sales volume tracked on Getsocs.</p>
            <button
              type="button"
              onClick={() => showNotice('Payout action is ready on the frontend. Payment provider connection comes next.')}
            >
              Request payout
            </button>
            <small>Minimum payout rules will be connected when payments are enabled.</small>
          </div>
        </section>
      )}

      {activeTab === 'Activity' && (
        <section className="profile-feed-grid profile-tab-section">
          <div className="profile-panel">
            <h3>Activity</h3>
            <div className="profile-feed-list">
              {RECENT_ACTIVITY.map(item => (
                <article key={item.title}>
                  <span>{item.meta}</span>
                  <h4>{item.title}</h4>
                  <p>{item.detail}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="profile-panel">
            <h3>Top Topics</h3>
            <div className="topic-list">
              <div><span>Creator accounts</span><strong>YouTube / TikTok / Telegram</strong></div>
              <div><span>Escrow deals</span><strong>Secure transfers and buyer checks</strong></div>
              <div><span>Reputation</span><strong>Badges, feedback, and completed trades</strong></div>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'Badges' && (
        <section className="profile-panel profile-tab-section">
          <div className="panel-heading">
            <div>
              <h3>Badges</h3>
              <p>Badges are front and center because trust is the product.</p>
            </div>
            <strong>{earnedBadges} marked as earned</strong>
          </div>

          <div className="profile-badge-grid">
            {BADGES.map(badge => (
              <article key={badge.id} className={`profile-badge-card ${badge.earned ? 'earned' : 'locked'}`}>
                <div className="badge-icon">{badge.icon}</div>
                <div>
                  <h4>{badge.title}</h4>
                  <p>{badge.text}</p>
                  <span>{badge.earned ? 'Earned' : 'Locked'}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'Follows' && (
        <section className="profile-follow-grid profile-tab-section">
          <div className="profile-panel">
            <div className="panel-heading">
              <div>
                <h3>Following</h3>
                <p>Members this account follows for marketplace updates.</p>
              </div>
              <strong>{FOLLOWING.length}</strong>
            </div>
            <div className="profile-follow-list">
              {FOLLOWING.map(item => (
                <article key={item.username} className="profile-follow-row">
                  <div className="mini-avatar">{item.username.slice(0, 2).toUpperCase()}</div>
                  <div>
                    <h4>{item.username}</h4>
                    <p>{item.name} - {item.detail}</p>
                  </div>
                  <button type="button" onClick={() => showNotice(`${item.username} follow control clicked.`)}>
                    Following
                  </button>
                </article>
              ))}
            </div>
          </div>

          <div className="profile-panel">
            <div className="panel-heading">
              <div>
                <h3>Followers</h3>
                <p>People watching this profile and trust score.</p>
              </div>
              <strong>{FOLLOWERS.length}</strong>
            </div>
            <div className="profile-follow-list">
              {FOLLOWERS.map(item => (
                <article key={item.username} className="profile-follow-row">
                  <div className="mini-avatar">{item.username.slice(0, 2).toUpperCase()}</div>
                  <div>
                    <h4>{item.username}</h4>
                    <p>{item.name} - {item.detail}</p>
                  </div>
                  <button type="button" onClick={() => showNotice(`Invite action prepared for ${item.username}.`)}>
                    Invite
                  </button>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {activeTab === 'Earnings' && (
        <section className="profile-main-grid profile-tab-section">
          <div className="profile-panel">
            <div className="panel-heading">
              <div>
                <h3>Earnings</h3>
                <p>Frontend-ready earnings overview for future payment integration.</p>
              </div>
            </div>
            <div className="profile-feed-list">
              <article>
                <span>Sold</span>
                <h4>{formatMoney(sold)} marketplace sales</h4>
                <p>Total value of listings marked as sold by this profile.</p>
              </article>
              <article>
                <span>Purchased</span>
                <h4>{formatMoney(purchased)} purchases</h4>
                <p>Buyer-side trading history tracked for trust scoring.</p>
              </article>
              <article>
                <span>Escrow</span>
                <h4>100% escrow ready</h4>
                <p>Escrow payout tracking will connect once payment processing is enabled.</p>
              </article>
            </div>
          </div>

          <div className="profile-panel profile-earnings-card">
            <span>Current earnings</span>
            <strong>{formatMoney(sold)}</strong>
            <p>Lifetime marketplace sales volume tracked on Getsocs.</p>
            <button
              type="button"
              onClick={() => showNotice('Payout action is ready on the frontend. Payment provider connection comes next.')}
            >
              Request payout
            </button>
            <small>Minimum payout rules will be connected when payments are enabled.</small>
          </div>
        </section>
      )}

      {activeTab === 'Feedback' && (
        <section className="profile-panel profile-tab-section">
          <div className="panel-heading">
            <div>
              <h3>Feedback</h3>
              <p>Public reputation notes for buyers and sellers.</p>
            </div>
            <button
              className="btn secondary"
              type="button"
              onClick={() => showNotice('Feedback request button clicked. Review submission can be connected to backend later.')}
            >
              Request feedback
            </button>
          </div>

          <div className="profile-feedback-grid">
            {FEEDBACK_ITEMS.map(item => (
              <article key={item.from} className="profile-feedback-card">
                <span>{item.rating}</span>
                <h4>{item.from}</h4>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'Settings' && (
        <section className="profile-main-grid profile-tab-section">
          <div className="profile-panel">
            <div className="panel-heading">
              <div>
                <h3>Account information</h3>
                <p>These details identify you to other members and cannot be edited here. Contact support if something is wrong.</p>
              </div>
            </div>
            <div className="profile-detail-list">
              <div><span>Username</span><strong>{user.username}</strong></div>
              <div><span>Name</span><strong>{displayName}</strong></div>
              <div><span>Email</span><strong>{user.email || 'Not provided'}</strong></div>
              <div><span>Mobile</span><strong>{user.mobile || 'Not provided'}</strong></div>
              <div><span>Email verification</span><strong>{user.verified ? 'Verified' : 'Not verified'}</strong></div>
            </div>
          </div>

          <div className="profile-panel">
            <div className="panel-heading">
              <div>
                <h3>Change password</h3>
                <p>Use a strong password you don't use anywhere else.</p>
              </div>
            </div>
            <form className="form" onSubmit={handleChangePassword}>
              {passwordError && <div className="alert">{passwordError}</div>}
              <input
                type="password"
                placeholder="Current password"
                value={passwordForm.oldPassword}
                onChange={e => setPasswordForm(prev => ({ ...prev, oldPassword: e.target.value }))}
                required
              />
              <input
                type="password"
                placeholder="New password"
                value={passwordForm.newPassword}
                onChange={e => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                required
              />
              <p className="small-text">Password must be at least 8 characters and include an uppercase letter, a number, and a symbol.</p>
              <input
                type="password"
                placeholder="Confirm new password"
                value={passwordForm.confirmPassword}
                onChange={e => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                required
              />
              <button type="submit" className="btn primary" disabled={passwordSaving}>
                {passwordSaving ? 'Saving...' : 'Save new password'}
              </button>
            </form>
          </div>
        </section>
      )}

      {roleLabel === 'admin' && (
        <Link to="/admin" className="btn secondary">Open Admin Panel</Link>
      )}
    </div>
  );
}
