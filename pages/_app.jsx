// Global stylesheets — Next.js only allows global CSS to be imported here in _app.
// index.css + App.css are the base; global.css is a generated barrel that @imports
// every component/page stylesheet (see scripts/migrate-css.js).
import '../src/index.css';
import '../src/App.css';
import '../src/global.css';
import 'react-toastify/dist/ReactToastify.css';
import 'lenis/dist/lenis.css';
import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import InstallPrompt from '../src/components/InstallPrompt';

export default function MyApp({ Component, pageProps }) {
  // In production, register the service worker so the app is installable
  // (Chrome only fires `beforeinstallprompt` — which powers the "Install
  // EventSphere" prompt — when an SW with a fetch handler + the manifest exist).
  // In dev, keep unregistering: the old CRA cache-first SW caused an HMR reload loop.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    if (process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/service-worker.js').catch(() => {});
    } else {
      navigator.serviceWorker.getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister()))
        .catch(() => {});
    }
  }, []);

  return (
    <>
      <Component {...pageProps} />
      {/* Rendered globally (not inside a layout) so the install prompt can appear
          on every page — login, home, and the admin dashboard alike. */}
      <InstallPrompt />
    </>
  );
}
