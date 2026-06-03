const mongoose = require('mongoose');

// Cached connection so repeated serverless invocations reuse one Mongo connection
// instead of opening a new one per request (which would exhaust Atlas connections).
let cached = global._mongoose;
if (!cached) cached = global._mongoose = { conn: null, promise: null };

async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/eventsphere';
    cached.promise = mongoose
      .connect(uri, { bufferCommands: false })
      .then((m) => m);
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

module.exports = connectDB;
