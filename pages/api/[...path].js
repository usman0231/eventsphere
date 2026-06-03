// Every /api/* request is delegated to the existing Express app (lib/server/app.js),
// so all 16 route groups keep working unchanged. Express parses the body itself,
// so Next's body parser is disabled and the response is resolved externally.
const app = require('../../lib/server/app');
const connectDB = require('../../lib/server/db');

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};

export default async function handler(req, res) {
  try {
    await connectDB();
  } catch (err) {
    console.error('DB connect failed:', err.message);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, message: 'Database connection failed' }));
    return;
  }
  return app(req, res);
}
