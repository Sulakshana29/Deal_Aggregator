// Load environment variables from .env before anything else.
// In production (Docker / K8s) these come from the container environment —
// dotenv simply no-ops if the vars are already set.
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const client = require('prom-client');

// Initialize default Node.js metrics collection (memory, CPU, event loop, etc.)
client.collectDefaultMetrics();

const dealsRouter = require('./routes/deals');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/deal-aggregator';
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const SHUTDOWN_TIMEOUT_MS = 10000;

// ─── Middleware ───────────────────────────────────────────────────────────────

// Hide the "X-Powered-By: Express" header so attackers can't fingerprint the stack
app.disable('x-powered-by');

// Trust exactly one proxy hop (the nginx frontend / K8s Ingress) so req.ip is the
// real client IP from X-Forwarded-For — otherwise every user shares nginx's IP
// and therefore one rate-limit bucket.
app.set('trust proxy', 1);

// Standard security headers (X-Content-Type-Options, HSTS, frame protection, ...)
app.use(helmet());

// CORS: allow requests from the configured frontend origin.
// The API is read-only, so only GET is allowed cross-origin.
app.use(
  cors({
    origin: CLIENT_ORIGIN === '*' ? true : CLIENT_ORIGIN,
    methods: ['GET'],
    allowedHeaders: ['Content-Type'],
  })
);

// Parse incoming JSON bodies (max 10kb — guards against body-size attacks)
app.use(express.json({ limit: '10kb' }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/deals', dealsRouter);

// Liveness — "is the process alive?" Never checks dependencies: if MongoDB is down,
// restarting this pod would not help, so liveness must stay green.
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Readiness — "can this instance serve traffic right now?" Returns 503 while the
// MongoDB connection is down, so K8s stops routing requests here until it recovers.
app.get('/ready', (_req, res) => {
  const dbReady = mongoose.connection.readyState === 1;
  res.status(dbReady ? 200 : 503).json({ status: dbReady ? 'ready' : 'not ready', db: dbReady });
});

// Prometheus metrics endpoint — scraped internally by Prometheus.
// Blocked from the public internet at the nginx layer (see frontend/nginx.conf).
app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

// Catch-all 404 for unknown routes
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────
// Docker / K8s send SIGTERM before killing a container (e.g. on every rolling
// update). Stop accepting new connections, let in-flight requests finish, close
// the DB connection, then exit. A timer force-exits if draining hangs.
function registerShutdown(server) {
  const shutdown = (signal) => {
    console.log(`${signal} received — shutting down gracefully`);
    setTimeout(() => {
      console.error('Graceful shutdown timed out — forcing exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS).unref();

    server.close(async () => {
      await mongoose.disconnect();
      console.log('HTTP server and MongoDB connection closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// ─── Database connection ──────────────────────────────────────────────────────
async function startServer() {
  try {
    await mongoose.connect(MONGO_URI);
    // Log only the host — MONGO_URI contains credentials
    console.log(`✅ MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);

    const server = app.listen(PORT, () => {
      console.log(`🚀 Backend running on http://localhost:${PORT}`);
      console.log(`   CORS allowed from: ${CLIENT_ORIGIN}`);
    });
    registerShutdown(server);
  } catch (err) {
    console.error('❌ Failed to connect to MongoDB:', err.message);
    // Exit with non-zero code so Docker / K8s knows the container failed
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = app;
