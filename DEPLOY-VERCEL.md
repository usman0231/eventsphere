# EventSphere on Vercel (single-folder Next.js app)

One Next.js project holds **everything** — React frontend + Express API — and
deploys to Vercel as a single project / single deploy.

## How it fits together

```
eventsphere/
├── package.json          # one package.json (Next + React + Express deps)
├── next.config.js
├── vercel.json           # functions + hourly cron
├── pages/
│   ├── _app.jsx          # global CSS lives here (Next requirement)
│   ├── _document.jsx     # manifest, favicon, theme-color
│   ├── [[...slug]].jsx   # renders the whole React-Router app (client-only)
│   └── api/[...path].js   # delegates every /api/* request to Express
├── src/                  # the existing React frontend (pages, components, context)
│   └── global.css        # generated barrel of all component CSS (see scripts/migrate-css.js)
├── lib/server/           # the Express backend (app.js, db.js, routes, models, utils, jobs)
└── public/               # static assets (manifest, logos, favicon)
```

- **Frontend:** the React-Router SPA is unchanged; it's loaded client-only via the
  optional catch-all `pages/[[...slug]].jsx`. React Router handles all in-app routing.
- **Backend:** `pages/api/[...path].js` hands each `/api/*` request to the existing
  Express app (`lib/server/app.js`), so all 16 route groups work as-is. Next's body
  parser is disabled so Express parses the body (and multipart uploads).
- **DB:** cached Mongo connection (`lib/server/db.js`) — one connection reused across
  serverless invocations.

## Serverless trade-offs (unchanged from before)

| Feature | Behaviour |
|---|---|
| Image uploads | **Cloudinary** (memory storage → `upload_stream`). Needs `CLOUDINARY_*`. |
| Real-time notifications | **Degraded** — saved to DB, shown on next fetch. No Socket.IO on serverless. Set `NEXT_PUBLIC_SOCKET_URL` only if you add a dedicated socket server. |
| Session reminders | **Vercel Cron** → `GET /api/cron/session-reminders` hourly, guarded by `CRON_SECRET`. |

## One-time setup

1. **MongoDB Atlas** — free cluster, network access `0.0.0.0/0`, copy URI → `MONGO_URI`.
2. **Cloudinary** — free account → `CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET`.
3. **Import the repo** into Vercel. It auto-detects **Next.js** — no build settings needed.
4. **Add environment variables** (see `.env.example`). Minimum: `MONGO_URI`,
   `JWT_SECRET`, `CLOUDINARY_*`, `CRON_SECRET`.
5. **Deploy.** One deploy brings up the frontend + API together.

## Local development

```
npm install                 # once
# create .env.local at the repo root with MONGO_URI, JWT_SECRET, CLOUDINARY_*, etc.
npm run dev                 # Next.js dev server on http://localhost:3000 (frontend + /api)
```

Everything (frontend and API) runs on one port — no separate backend process.
`npm run build` then `npm start` runs the production build locally.
