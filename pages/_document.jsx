import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.ico" />
        <meta name="theme-color" content="#0b0f1a" />
        {/* Fonts loaded here (not via CSS @import) so they sit in <head> and don't
            get dropped: a bundled @import that isn't first in the stylesheet is
            ignored by the browser. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@300;400;500;600&display=swap"
        />
        {/* Capture `beforeinstallprompt` as early as possible — it can fire before
            React mounts the <InstallPrompt> listener, which is why the prompt often
            never appeared. We stash the event on window and re-broadcast a custom
            event so the component can pick it up whenever it mounts. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.deferredInstallPrompt = null;
              window.addEventListener('beforeinstallprompt', function (e) {
                e.preventDefault();
                window.deferredInstallPrompt = e;
                window.dispatchEvent(new Event('es-installable'));
              });
              window.addEventListener('appinstalled', function () {
                window.deferredInstallPrompt = null;
              });
            `,
          }}
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
