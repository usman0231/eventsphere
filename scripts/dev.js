// Runs `next dev` and opens the site in the default browser once the server is ready.
const { spawn, exec } = require('child_process');
const http = require('http');

const port = process.env.PORT || 3000;
const url = `http://localhost:${port}`;

const child = spawn('npx', ['next', 'dev', '-p', String(port)], {
  stdio: 'inherit',
  shell: true,
});

let opened = false;
const openBrowser = () => {
  if (opened) return;
  opened = true;
  const cmd =
    process.platform === 'win32' ? `start "" "${url}"` :
    process.platform === 'darwin' ? `open "${url}"` :
    `xdg-open "${url}"`;
  exec(cmd);
};

// Poll until the dev server responds, then open the browser exactly once.
const timer = setInterval(() => {
  http
    .get(url, () => { clearInterval(timer); openBrowser(); })
    .on('error', () => {});
}, 800);

const stop = () => { clearInterval(timer); child.kill(); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
child.on('exit', (code) => { clearInterval(timer); process.exit(code ?? 0); });
