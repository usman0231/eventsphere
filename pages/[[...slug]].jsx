import dynamic from 'next/dynamic';

// The entire app is the existing React-Router SPA. It relies on the browser
// (window, three.js, leaflet, BrowserRouter), so it is loaded client-only.
// This optional catch-all route matches "/" and every client-side path; React
// Router then takes over routing in the browser. /api/* is handled separately
// by pages/api/[...path].js and never reaches here.
const App = dynamic(() => import('../src/App'), { ssr: false });

export default function CatchAll() {
  return <App />;
}
