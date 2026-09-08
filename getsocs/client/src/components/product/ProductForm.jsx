import React, { useState, useEffect, useMemo } from 'react';
import { createProduct, lookupChannel } from '../../services/productService';
import { getMeta } from '../../services/metaService';
import { validatePhoto, PHOTO_CONSTRAINTS } from '../../utils/photoValidation';

// Platforms we can automatically verify ownership of and pull real stats
// from (bio-code check, same idea for all of them). Keep in sync with
// services/channelVerificationService.js on the backend.
const AUTO_VERIFIABLE_PLATFORMS = ['YouTube', 'Telegram', 'TikTok'];

function generateRandomString(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default function ProductForm({ onSuccess }) {
  const [form, setForm] = useState({ title: '', description: '', price: '', platform: 'YouTube', followers: '', avgViews: '', topic: 'Other', monetized: false, channelUrl: '' });
  const [images, setImages] = useState([]);
  const [platformOptions, setPlatformOptions] = useState(['YouTube','Telegram','TikTok']);
  const [channelLookupState, setChannelLookupState] = useState({ loading: false, error: '', fetched: false, verified: false });
  const [uploadSessionCode, setUploadSessionCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [uploadedProduct, setUploadedProduct] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validatingImages, setValidatingImages] = useState(false);
  const platformSupportsAutoVerify = AUTO_VERIFIABLE_PLATFORMS.includes(form.platform);
  const platformSupportsMonetization = form.platform === 'YouTube';
  const channelInfoLocked = platformSupportsAutoVerify && channelLookupState.verified;

  async function submit(e) {
    e.preventDefault();
    setError('');
    setGeneratedCode('');
    setUploadedProduct(null);
    if (images.length < 3) {
      setError('Please attach at least 3 images.');
      return;
    }
    if (platformSupportsAutoVerify && form.channelUrl.trim()) {
      if (!channelLookupState.verified) {
        setError(`Verify the ${form.platform} channel bio first by adding the verification code to the channel bio.`);
        return;
      }
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('title', form.title);
      formData.append('description', form.description);
      formData.append('price', form.price);
      formData.append('platform', form.platform);
      formData.append('followers', form.followers || 0);
      formData.append('avgViews', form.avgViews || 0);
      formData.append('topic', form.topic);
      formData.append('monetized', platformSupportsMonetization && form.monetized ? '1' : '0');
      formData.append('uploadSessionCode', uploadSessionCode);
      formData.append('channelUrl', form.channelUrl || '');
      images.forEach((file) => formData.append('images', file));

      const res = await createProduct(formData);

      if (res.data && res.data.success) {
        const prod = res.data.data;
        setGeneratedCode(prod.code);
        setUploadedProduct(prod);
        setForm({ title: '', description: '', price: '', platform: 'YouTube', followers: '', avgViews: '', topic: 'Other', monetized: false, channelUrl: '' });
        setChannelLookupState({ loading: false, error: '', fetched: false, verified: false });
        setImages([]);
        if (typeof onSuccess === 'function') onSuccess(prod);
      } else {
        setError(res.data?.error || 'Upload failed');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Network error.');
    } finally {
      setLoading(false);
    }
  }

  const MAX_IMAGES = 7;

  async function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;

    setValidatingImages(true);
    const accepted = [];
    const rejectionMessages = [];

    for (const file of files) {
      const result = await validatePhoto(file).catch(() => undefined);
      const validation = result || { valid: false, errors: ['Photo validation failed'] };
      if (validation.valid) {
        accepted.push(file);
      } else {
        rejectionMessages.push(`"${file.name}": ${validation.errors.join('; ')}`);
      }
    }
    setValidatingImages(false);

    if (rejectionMessages.length) {
      setError(rejectionMessages.join('\n'));
    } else {
      setError('');
    }

    let nextFiles = [...images, ...accepted].filter((file, index, list) => {
      return index === list.findIndex(other => other.name === file.name && other.size === file.size && other.lastModified === file.lastModified);
    });

    if (nextFiles.length > MAX_IMAGES) {
      setError(prev => {
        const capMsg = `You can attach a maximum of ${MAX_IMAGES} images per listing.`;
        return prev ? `${prev}\n${capMsg}` : capMsg;
      });
      nextFiles = nextFiles.slice(0, MAX_IMAGES);
    }

    setImages(nextFiles);
  }

  function removeImage(indexToRemove) {
    setImages(prev => prev.filter((_, index) => index !== indexToRemove));
  }

  const imagePreviews = useMemo(() => {
    return images.map(file => ({
      file,
      src: URL.createObjectURL(file)
    }));
  }, [images]);
  const imagePickerLabel = images.length === 0
    ? 'No file chosen'
    : `${images.length} ${images.length === 1 ? 'file' : 'files'} selected`;

  async function handleFetchChannelInfo() {
    if (!form.channelUrl.trim()) {
      setChannelLookupState({ loading: false, error: 'Paste a channel link first.', fetched: false, verified: false });
      return;
    }
    setChannelLookupState({ loading: true, error: '', fetched: false, verified: false });
    try {
      const res = await lookupChannel(form.platform, form.channelUrl.trim(), uploadSessionCode);
      if (res.data.success) {
        const { title, followerCount, avgViews } = res.data.data;
        setForm(prev => ({
          ...prev,
          title: title || prev.title,
          followers: followerCount || prev.followers,
          avgViews: avgViews || prev.avgViews
        }));
        setChannelLookupState({ loading: false, error: '', fetched: true, verified: true });
      } else {
        setForm(prev => ({ ...prev, title: '', followers: '', avgViews: '' }));
        setChannelLookupState({ loading: false, error: res.data.error || 'Could not fetch channel info.', fetched: false, verified: false });
      }
    } catch (err) {
      setForm(prev => ({ ...prev, title: '', followers: '', avgViews: '' }));
      const fallbackMessage = err.response?.data?.error || `${form.platform} lookup is unavailable right now. You can continue filling the fields manually.`;
      setChannelLookupState({ loading: false, error: fallbackMessage, fetched: false, verified: false });
    }
  }

  function handlePlatformChange(platform) {
    setForm(prev => ({ ...prev, platform, monetized: platform === 'YouTube' ? prev.monetized : false }));
    setChannelLookupState({ loading: false, error: '', fetched: false, verified: false });
  }

  function handleChannelUrlChange(channelUrl) {
    setForm(prev => ({ ...prev, channelUrl }));
    // A successful lookup only applies to the exact channel that was checked.
    setChannelLookupState(prev => prev.verified
      ? { loading: false, error: '', fetched: false, verified: false }
      : prev);
  }

  useEffect(() => {
    return () => {
      imagePreviews.forEach(preview => URL.revokeObjectURL(preview.src));
    };
  }, [imagePreviews]);

  useEffect(() => {
    let mounted = true;
    setUploadSessionCode(generateRandomString(6));

    async function loadMeta() {
      try {
        const result = typeof getMeta === 'function'
          ? await getMeta()
          : { data: { data: { platforms: [] } } };

        if (!mounted) return;
        if (result?.data?.data && Array.isArray(result.data.data.platforms)) {
          setPlatformOptions(result.data.data.platforms);
          setForm(prev => result.data.data.platforms.includes(prev.platform)
            ? prev
            : { ...prev, platform: result.data.data.platforms[0] || prev.platform });
        }
      } catch (error) {
        // Ignore metadata load failures; keep default platform options.
      }
    }

    loadMeta();
    return () => { mounted = false; };
  }, []);

  return (
    <form className="form" onSubmit={submit}>
      <h3>Upload Product</h3>
      {error && <div className="alert">{error}</div>}
      <select
        aria-label="Platform"
        value={form.platform}
        onChange={e => handlePlatformChange(e.target.value)}
        style={{
          padding: '12px',
          borderRadius: '10px',
          border: '1px solid rgba(255,255,255,0.2)',
          background: 'rgba(255,255,255,0.05)',
          color: '#fff',
          fontSize: '14px',
          minWidth: '140px',
          cursor: 'pointer'
        }}
      >
        {platformOptions.map(p => <option key={p} value={p}>{p}</option>)}
      </select>
      {platformSupportsAutoVerify && (
        <div className="youtube-lookup-row">
          {uploadSessionCode && (
            <div className="youtube-lookup-success youtube-verification-code">
              <strong>Step 1 — add this verification code to your {form.platform} bio:</strong>
              <span>{uploadSessionCode}</span>
              <button type="button" className="btn secondary small" onClick={() => navigator.clipboard.writeText(uploadSessionCode)}>Copy code</button>
            </div>
          )}
          <input
            name="channelUrl"
            aria-label={`${form.platform} channel link`}
            placeholder={`Paste the ${form.platform} channel link`}
            value={form.channelUrl}
            onChange={e => handleChannelUrlChange(e.target.value)}
          />
          <button type="button" className="btn secondary" onClick={handleFetchChannelInfo} disabled={channelLookupState.loading}>
            {channelLookupState.loading ? 'Fetching...' : 'Fetch channel info'}
          </button>
          {channelLookupState.error && <div className="alert youtube-lookup-alert">{channelLookupState.error}</div>}
          {channelLookupState.fetched && <div className="youtube-lookup-success">Channel information was verified and saved below. These fields are locked to protect buyers from altered account statistics.</div>}
        </div>
      )}
      <input name="title" aria-label="Listing title" placeholder="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required readOnly={channelInfoLocked} />
      <textarea name="description" aria-label="Listing description" placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} maxLength={5000} />
      <input name="price" aria-label="Listing price" type="number" min="0" max="5000000" step="0.01" placeholder="Price" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} required />

      <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'center'}}>
        <input name="followers" aria-label="Follower count" type="number" placeholder="Followers" value={form.followers} onChange={e => setForm({ ...form, followers: e.target.value })} readOnly={channelInfoLocked} />
        <input name="avgViews" aria-label="Average views" type="number" placeholder="Avg views" value={form.avgViews} onChange={e => setForm({ ...form, avgViews: e.target.value })} readOnly={channelInfoLocked} />
        <select 
          value={form.topic} 
          aria-label="Listing topic"
          onChange={e=>setForm({...form,topic:e.target.value})}
          style={{
            padding: '12px',
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(255,255,255,0.05)',
            color: '#fff',
            fontSize: '14px',
            minWidth: '140px',
            cursor: 'pointer'
          }}
        >
          <option>Other</option>
          <option>Gaming</option>
          <option>Fashion</option>
          <option>Tech</option>
          <option>Education</option>
        </select>
        {platformSupportsMonetization && (
          <label style={{display:'inline-flex',alignItems:'center',gap:8}}>
            <input type="checkbox" checked={form.monetized} onChange={e=>setForm({...form,monetized:e.target.checked})} /> Monetized
          </label>
        )}
      </div>

      <label className="file-upload upload-image-picker">
        <span className="file-upload-title">Attach product images (3-7 images, {PHOTO_CONSTRAINTS.MAX_SIZE_MB}MB max each, JPEG/PNG/WebP)</span>
        <span className="media-upload-row">
          <span className="file-picker-button">Choose files</span>
          <span className="file-picker-name">{validatingImages ? 'Checking images…' : imagePickerLabel}</span>
        </span>
        <input className="visually-hidden-file" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleFiles} disabled={validatingImages} />
      </label>
      <div className="file-help">Selected images: {images.length}</div>
      {images.length > 0 && (
        <div className="image-preview-grid">
          {imagePreviews.map((preview, idx) => (
            <div key={`${preview.file.name}-${preview.file.size}-${preview.file.lastModified}`} className="image-preview-card">
              <img src={preview.src} alt={`Preview ${idx + 1}`} className="image-preview" />
              <button type="button" className="btn btn-secondary small" onClick={() => removeImage(idx)}>Remove</button>
            </div>
          ))}
        </div>
      )}
      {generatedCode && (
        <div className="info-banner">
          <p>Product uploaded and is now pending escrow approval.</p>
          <p>Share this code with escrow to confirm your listing:</p>
          <div className="code-box">
            <strong>{generatedCode}</strong>
            <button type="button" className="btn btn-secondary small" onClick={() => navigator.clipboard.writeText(generatedCode)}>Copy code</button>
          </div>
          {uploadedProduct && (
            <p>
              <a href={`/product/${uploadedProduct.id}`} className="link">View pending listing</a>
            </p>
          )}
        </div>
      )}
      <button className="btn primary upload-submit-btn" type="submit" disabled={loading}>{loading ? 'Uploading...' : 'Upload'}</button>
    </form>
  );
}
