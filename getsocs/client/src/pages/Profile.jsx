import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import { getUploadUrl } from '../api/axios';
import { uploadProfilePhotos, changePassword, updateUsername, deleteAccount, submitIdVerification } from '../services/authService';
import { getMembershipTiers, getMyMembership, subscribeToTier } from '../services/membershipService';
import { getMyProfileBadges } from '../services/badgeService';
import { validatePassword } from '../utils/validation';

const PROFILE_TABS = ['Summary', 'Activity', 'Badges', 'Follows', 'Earnings', 'Feedback', 'Settings'];

// Icons only - whether each badge is actually earned comes from the backend
// (see getMyProfileBadges), computed from real account data instead of being
// hardcoded, so a fresh account no longer shows badges it hasn't earned yet.
const BADGE_ICONS = {
  'id-verified': 'ID',
  'trusted-seller': 'TS',
  'escrow-ready': 'ER',
  'fast-responder': 'FR',
  'community-builder': 'CB',
  'premium-member': 'GS'
};

const RECENT_ACTIVITY = []; // TODO: populate from real backend data only.

const FOLLOWING = []; // TODO: populate from real backend data only.

const FOLLOWERS = []; // TODO: populate from real backend data only.

const FEEDBACK_ITEMS = []; // TODO: populate from real backend data only.

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
  const navigate = useNavigate();
  const { user, updateUser, logout } = React.useContext(AuthContext);
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
  const [idVerifyForm, setIdVerifyForm] = React.useState({ documentType: 'passport', documentId: '', file: null });
  const [idVerifyError, setIdVerifyError] = React.useState('');
  const [idVerifySaving, setIdVerifySaving] = React.useState(false);
  const [badges, setBadges] = React.useState([]);
  const [badgesLoading, setBadgesLoading] = React.useState(true);
  const [usernameForm, setUsernameForm] = React.useState({ username: user?.username || '' });
  const [usernameError, setUsernameError] = React.useState('');
  const [usernameSaving, setUsernameSaving] = React.useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = React.useState(false);
  const [deleteForm, setDeleteForm] = React.useState({ agree: false, fullName: '', confirmationText: '' });
  const [deleteError, setDeleteError] = React.useState('');
  const [deleteSaving, setDeleteSaving] = React.useState(false);
  const userId = user?.id;

  React.useEffect(() => {
    if (user) {
      setUsernameForm(prev => (prev.username ? prev : { username: user.username || '' }));
    }
  }, [user]);

  React.useEffect(() => {
    if (!userId) return undefined;
    let mounted = true;
    setBadgesLoading(true);
    getMyProfileBadges()
      .then(res => {
        if (mounted && res?.data?.success) setBadges(res.data.badges || []);
      })
      .catch(() => {
        // Leave badges empty rather than pretending anything is earned.
      })
      .finally(() => { if (mounted) setBadgesLoading(false); });
    return () => { mounted = false; };
  }, [userId]);

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
  const earnedBadges = badges.filter(badge => badge.earned).length;
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

  // Name and last name always have to match the account holder's real
  // identity (they're what ID verification checks against), so they aren't
  // freely user-editable here. The editable identifier on this page is the
  // username instead.
  const usernameChangeAllowed = !user?.usernameChangedAt || Date.now() - new Date(user.usernameChangedAt).getTime() >= 30 * 24 * 60 * 60 * 1000;

  const handleUpdateUsername = async event => {
    event.preventDefault();
    setUsernameError('');
    const nextUsername = usernameForm.username.trim();
    if (!nextUsername) {
      setUsernameError('Enter a username.');
      return;
    }
    if (nextUsername === user.username) {
      setUsernameError('That is already your username.');
      return;
    }
    if (!usernameChangeAllowed) {
      setUsernameError('You can change your username only once every 30 days.');
      return;
    }
    setUsernameSaving(true);
    try {
      const res = await updateUsername(nextUsername);
      if (!res?.data?.success) throw new Error(res?.data?.error || 'Unable to update username.');
      updateUser(res.data.user);
      showNotice('Username updated successfully.');
    } catch (error) {
      setUsernameError(error.response?.data?.error || error.message || 'Unable to update username.');
    } finally {
      setUsernameSaving(false);
    }
  };

  const idVerificationStatus = user.idVerified ? 'approved' : (user.idVerificationStatus || 'none');

  const handleSubmitIdVerification = async event => {
    event.preventDefault();
    setIdVerifyError('');
    if (!idVerifyForm.documentId.trim()) {
      setIdVerifyError('Enter your document ID number.');
      return;
    }
    if (!idVerifyForm.file) {
      setIdVerifyError('Upload a photo of your ID document.');
      return;
    }
    setIdVerifySaving(true);
    try {
      const formData = new FormData();
      formData.append('documentType', idVerifyForm.documentType);
      formData.append('documentId', idVerifyForm.documentId.trim());
      formData.append('idImage', idVerifyForm.file);
      const res = await submitIdVerification(formData);
      if (!res?.data?.success) throw new Error(res?.data?.error || 'Unable to submit verification.');
      updateUser({ idVerificationStatus: 'pending' });
      showNotice('ID submitted. We will review it within 1-2 business days.');
      setIdVerifyForm({ documentType: 'passport', documentId: '', file: null });
    } catch (error) {
      setIdVerifyError(error.response?.data?.error || error.message || 'Unable to submit verification.');
    } finally {
      setIdVerifySaving(false);
    }
  };

  const handleDeleteAccount = async event => {
    event.preventDefault();
    setDeleteError('');
    const expectedConfirmation = `DELETE ${`${user.name || ''} ${user.lastname || ''}`.trim() || user.username}`.trim();
    if (!deleteForm.agree) {
      setDeleteError('You must agree to the consequences before deleting your account.');
      return;
    }
    if (!deleteForm.fullName.trim() || deleteForm.fullName.trim().toLowerCase() !== `${user.name || ''} ${user.lastname || ''}`.trim().toLowerCase()) {
      setDeleteError('Enter your full legal name exactly as shown on your account.');
      return;
    }
    if (deleteForm.confirmationText.trim().toUpperCase() !== expectedConfirmation.toUpperCase()) {
      setDeleteError(`Type "${expectedConfirmation}" exactly to confirm.`);
      return;
    }

    setDeleteSaving(true);
    try {
      const res = await deleteAccount({
        confirmation: true,
        fullName: deleteForm.fullName.trim(),
        confirmationText: deleteForm.confirmationText.trim()
      });
      if (!res?.data?.success) throw new Error(res?.data?.error || 'Unable to delete account.');
      logout();
      setDeleteModalOpen(false);
      navigate('/login');
      showNotice('Account deleted successfully.');
    } catch (error) {
      setDeleteError(error.response?.data?.error || error.message || 'Unable to delete account.');
    } finally {
      setDeleteSaving(false);
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
            <span className="media-upload-row"><span className="file-picker-button">Choose file</span><span className="file-picker-name">{profilePhotoFile?.name || 'No file chosen'}</span></span>
            <input className="visually-hidden-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setProfilePhotoFile(event.target.files?.[0] || null)} />
          </label>
          <label className="media-upload-control">
            <span className="media-upload-title">Background photo</span>
            <span className="media-upload-row"><span className="file-picker-button">Choose file</span><span className="file-picker-name">{backgroundPhotoFile?.name || 'No file chosen'}</span></span>
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
        <div className="profile-stat"><strong>{earnedBadges}/{badges.length || 6}</strong><span>badges earned</span></div>
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

          {badgesLoading && badges.length === 0 ? (
            <div className="empty-state">Loading badges...</div>
          ) : (
            <div className="profile-badge-grid">
              {badges.map(badge => (
                <article key={badge.id} className={`profile-badge-card ${badge.earned ? 'earned' : 'locked'}`}>
                  <div className="badge-icon">{BADGE_ICONS[badge.id] || '★'}</div>
                  <div>
                    <h4>{badge.title}</h4>
                    <p>{badge.text}</p>
                    <span>{badge.earned ? 'Earned' : 'Locked'}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
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
              <div><span>ID verification</span><strong>{user.idVerified ? '✅ Verified' : 'Not verified'}</strong></div>
            </div>
          </div>

          <div className="profile-panel">
            <div className="panel-heading">
              <div>
                <h3>ID verification</h3>
                <p>Upload a government ID to get the verified badge on your profile and listings.</p>
              </div>
            </div>
            {idVerificationStatus === 'approved' && (
              <div className="alert alert-success">✅ Your identity is verified.</div>
            )}
            {idVerificationStatus === 'pending' && (
              <div className="alert">Your ID is under review. This usually takes 1-2 business days.</div>
            )}
            {idVerificationStatus === 'rejected' && (
              <div className="alert">Your last submission was not approved{user.idVerificationRejectedReason ? `: ${user.idVerificationRejectedReason}` : '.'} You can submit again below.</div>
            )}
            {(idVerificationStatus === 'none' || idVerificationStatus === 'rejected') && (
              <form className="form" onSubmit={handleSubmitIdVerification}>
                {idVerifyError && <div className="alert">{idVerifyError}</div>}
                <select
                  value={idVerifyForm.documentType}
                  onChange={e => setIdVerifyForm(prev => ({ ...prev, documentType: e.target.value }))}
                >
                  <option value="passport">Passport</option>
                  <option value="national_id">National ID card</option>
                  <option value="drivers_license">Driver&apos;s license</option>
                </select>
                <input
                  type="text"
                  placeholder="Document ID number"
                  value={idVerifyForm.documentId}
                  onChange={e => setIdVerifyForm(prev => ({ ...prev, documentId: e.target.value }))}
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => setIdVerifyForm(prev => ({ ...prev, file: e.target.files?.[0] || null }))}
                />
                <button type="submit" className="btn primary" disabled={idVerifySaving}>
                  {idVerifySaving ? 'Submitting...' : 'Submit for verification'}
                </button>
              </form>
            )}
          </div>

          <div className="profile-panel">
            <div className="panel-heading">
              <div>
                <h3>Change username</h3>
                <p>{usernameChangeAllowed ? 'You can change your username once every 30 days. Your real name stays fixed and always matches your account holder.' : 'Username changes are locked for 30 days after the last update.'}</p>
              </div>
            </div>
            <form className="form" onSubmit={handleUpdateUsername}>
              {usernameError && <div className="alert">{usernameError}</div>}
              <input
                type="text"
                placeholder="Username"
                value={usernameForm.username}
                onChange={e => setUsernameForm({ username: e.target.value })}
                disabled={!usernameChangeAllowed}
              />
              <button type="submit" className="btn primary" disabled={usernameSaving || !usernameChangeAllowed}>
                {usernameSaving ? 'Saving...' : 'Update username'}
              </button>
            </form>
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

          <div className="profile-panel">
            <div className="panel-heading">
              <div>
                <h3>Delete account</h3>
                <p>This permanently removes your profile and all of your uploaded listings.</p>
              </div>
            </div>
            <button type="button" className="btn danger" onClick={() => setDeleteModalOpen(true)}>Delete account</button>
          </div>
        </section>
      )}

      {deleteModalOpen && (
        <div className="modal-backdrop" onClick={() => !deleteSaving && setDeleteModalOpen(false)}>
          <div className="modal-card" onClick={event => event.stopPropagation()}>
            <h3>Delete account</h3>
            <p className="small-text">This action permanently deletes your account. Your email will be blocked from creating a new account for 30 days and every listing you uploaded will be deleted.</p>
            <form className="form" onSubmit={handleDeleteAccount}>
              {deleteError && <div className="alert">{deleteError}</div>}
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={deleteForm.agree}
                  onChange={event => setDeleteForm(prev => ({ ...prev, agree: event.target.checked }))}
                />
                <span>I understand that my deleted account cannot be used to create a new account with this email for 30 days and all of my listings will be removed.</span>
              </label>
              <input
                type="text"
                placeholder="Enter your full name"
                value={deleteForm.fullName}
                onChange={event => setDeleteForm(prev => ({ ...prev, fullName: event.target.value }))}
              />
              <input
                type="text"
                placeholder={`Type DELETE ${`${user.name || ''} ${user.lastname || ''}`.trim() || user.username}`}
                value={deleteForm.confirmationText}
                onChange={event => setDeleteForm(prev => ({ ...prev, confirmationText: event.target.value }))}
              />
              <div className="modal-actions">
                <button type="button" className="btn secondary" onClick={() => setDeleteModalOpen(false)} disabled={deleteSaving}>Cancel</button>
                <button type="submit" className="btn danger" disabled={deleteSaving}>
                  {deleteSaving ? 'Deleting...' : 'Delete account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {roleLabel === 'admin' && (
        <Link to="/admin" className="btn secondary">Open Admin Panel</Link>
      )}
    </div>
  );
}
