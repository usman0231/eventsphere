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

export default function MyApp({ Component, pageProps }) {
  // The app migrated off CRA's PWA — proactively unregister any leftover service
  // worker so its stale cache-first chunks can't trigger an HMR reload loop in dev.
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister()))
        .catch(() => {});
    }
  }, []);

  return <Component {...pageProps} />;
}
