import mongoose from "mongoose";

const cached = global.mongoose || (global.mongoose = { conn: null, promise: null, uri: null });

export async function connectDB() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw Object.assign(
      new Error("MongoDB is not configured. Set MONGODB_URI in .env.local."),
      { status: 503 },
    );
  }
  if (cached.uri !== uri) {
    cached.conn = null;
    cached.promise = null;
    cached.uri = uri;
  }
  if (cached.conn?.readyState === 1) return cached.conn;
  if (cached.promise && (!cached.conn || cached.conn.readyState === 2))
    return cached.promise;

  cached.conn = null;
  const timer = `[mongodb] connect ${Date.now()}`;
  console.time(timer);
  cached.promise = mongoose
    .connect(uri, {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
    })
    .then((connection) => {
      cached.conn = connection;
      cached.promise = null;
      return connection;
    })
    .catch((cause) => {
      cached.conn = null;
      cached.promise = null;
      throw Object.assign(
        new Error(
          "Could not connect to MongoDB. Check the Atlas URI, database user credentials, IP access list, and network access.",
        ),
        { status: 503, cause },
      );
    })
    .finally(() => {
      console.timeEnd(timer);
    });
  return cached.promise;
}