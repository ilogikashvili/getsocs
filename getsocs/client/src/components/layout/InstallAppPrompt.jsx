import React, { useEffect, useMemo, useState } from 'react';
import { Download, Share, X } from 'lucide-react';

const DISMISS_KEY = 'gs_install_prompt_dismissed';

function isStandaloneDisplay() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function getPlatform() {
  if (typeof window === 'undefined') return { isIOS: false, isMobile: false };
  const ua = window.navigator.userAgent || '';
  const isIOS = /iphone|ipad|ipod/i.test(ua) || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
  const isMobile = isIOS || /android|mobile/i.test(ua) || window.innerWidth <= 767;
  return { isIOS, isMobile };
}

export default function InstallAppPrompt() {
  const [{ isIOS, isMobile }, setPlatform] = useState(() => getPlatform());
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch (error) { return false; }
  });
  const [installed, setInstalled] = useState(() => isStandaloneDisplay());

  useEffect(() => {
    function handleResize() {
      setPlatform(getPlatform());
    }

    function handlePrompt(event) {
      event.preventDefault();
      setDeferredPrompt(event);
    }

    function handleInstalled() {
      setInstalled(true);
      setDeferredPrompt(null);
    }

    window.addEventListener('resize', handleResize);
    window.addEventListener('beforeinstallprompt', handlePrompt);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('beforeinstallprompt', handlePrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const secureContext = typeof window !== 'undefined' && window.isSecureContext;
  const copy = useMemo(() => {
    if (!secureContext) {
      return {
        title: 'Install needs HTTPS',
        detail: 'Open the deployed HTTPS site on your phone to add Getsocs.'
      };
    }
    if (isIOS) {
      return {
        title: 'Add Getsocs widget',
        detail: 'iPhone needs one Safari step to add it to your Home Screen.'
      };
    }
    return {
      title: 'Add Getsocs widget',
      detail: deferredPrompt ? 'Add the app to your phone home screen.' : 'Open browser menu, then Install app.'
    };
  }, [deferredPrompt, isIOS, secureContext]);

  if (!isMobile || dismissed || installed) return null;

  async function installApp() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice.catch(() => null);
    setDeferredPrompt(null);
  }

  function dismissPrompt() {
    setDismissed(true);
    setGuideOpen(false);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch (error) {}
  }

  const guideSteps = isIOS
    ? ['Open getsocs.com in Safari.', 'Tap the Share button at the bottom of Safari.', 'Scroll if needed and tap Add to Home Screen.', 'Tap Add.']
    : ['Open the browser menu.', 'Tap Install app or Add to Home screen.', 'Confirm Install.'];

  return (
    <>
      <section className="install-app-prompt" aria-label="Install Getsocs">
        <div className="install-app-icon" aria-hidden="true">
          {isIOS && !deferredPrompt ? <Share size={18} /> : <Download size={18} />}
        </div>
        <div className="install-app-copy">
          <strong>{copy.title}</strong>
          <span>{copy.detail}</span>
        </div>
        {secureContext && (
          deferredPrompt ? (
            <button type="button" className="install-app-action" onClick={installApp}>
              <Download size={16} />
              Add Widget
            </button>
          ) : (
            <button type="button" className="install-app-action" onClick={() => setGuideOpen(true)}>
              {isIOS ? <Share size={16} /> : <Download size={16} />}
              Add Widget
            </button>
          )
        )}
        <button type="button" className="install-app-close" onClick={dismissPrompt} aria-label="Dismiss install prompt">
          <X size={16} />
        </button>
      </section>
      {guideOpen && (
        <div className="install-guide-backdrop" role="presentation" onClick={() => setGuideOpen(false)}>
          <section className="install-guide" role="dialog" aria-modal="true" aria-label="Add Getsocs widget" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="install-guide-close" onClick={() => setGuideOpen(false)} aria-label="Close install guide">
              <X size={16} />
            </button>
            <div className="install-guide-icon" aria-hidden="true">
              {isIOS ? <Share size={22} /> : <Download size={22} />}
            </div>
            <h2>Add Getsocs widget</h2>
            {isIOS && <p>Apple does not let websites install automatically. These taps add the widget to your iPhone Home Screen.</p>}
            <ol>
              {guideSteps.map((step) => <li key={step}>{step}</li>)}
            </ol>
          </section>
        </div>
      )}
    </>
  );
}
