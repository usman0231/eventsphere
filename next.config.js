/** @type {import('next').NextConfig} */
const nextConfig = {
  // The app uses three.js / window / React Router and renders client-only,
  // so StrictMode double-invocation is disabled to avoid 3D/socket churn.
  reactStrictMode: false,
  // CRA had its own lint pipeline; don't fail production builds on lint.
  eslint: { ignoreDuringBuilds: true },
  // Never cache the service worker itself, so browsers always fetch the latest
  // version on their update check (and pick up SW changes immediately).
  async headers() {
    return [
      {
        source: '/service-worker.js',
        headers: [{ key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' }],
      },
    ];
  },
};

module.exports = nextConfig;
