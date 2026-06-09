import React, { useEffect, useState } from 'react';

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    if (isStandalone) return;

    if (localStorage.getItem('es_install_dismissed') === '1') return;

    // The `beforeinstallprompt` event is captured early in _document (before React
    // mounts), so by the time we get here it may already be waiting on window.
    // Pick it up if so, and also listen for it firing later this session.
    const show = () => {
      if (window.deferredInstallPrompt) {
        setDeferred(window.deferredInstallPrompt);
        setVisible(true);
      }
    };

    show();

    // `es-installable` is re-broadcast by the early capture script; we also listen
    // for the native event directly in case this mounts before it fires.
    const onCaptured = (e) => {
      if (e && e.preventDefault) {
        e.preventDefault();
        window.deferredInstallPrompt = e;
      }
      show();
    };
    const onInstalled = () => {
      window.deferredInstallPrompt = null;
      setVisible(false);
      setDeferred(null);
    };

    window.addEventListener('es-installable', onCaptured);
    window.addEventListener('beforeinstallprompt', onCaptured);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('es-installable', onCaptured);
      window.removeEventListener('beforeinstallprompt', onCaptured);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  // Auto-hide the prompt after 15s if the user doesn't interact.
  // This only hides it for the current session (no localStorage flag),
  // so it can reappear on the next visit — unlike "Not now".
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setVisible(false), 15000);
    return () => clearTimeout(timer);
  }, [visible]);

  const handleInstall = async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    window.deferredInstallPrompt = null;
    setDeferred(null);
    setVisible(false);
  };

  const handleDismiss = () => {
    localStorage.setItem('es_install_dismissed', '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="install-prompt">
      <div className="install-prompt-text">
        <strong>Install EventSphere</strong>
        <span>Add to your home screen for a faster, app-like experience.</span>
      </div>
      <div className="install-prompt-actions">
        <button className="install-btn" onClick={handleInstall}>Install</button>
        <button className="install-dismiss" onClick={handleDismiss}>Not now</button>
      </div>
    </div>
  );
}
