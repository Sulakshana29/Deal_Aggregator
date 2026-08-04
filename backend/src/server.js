// Load environment variables from .env before anything else.
// In production (Docker / K8s) these come from the container environment —
// dotenv simply no-ops if the vars are already set.
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const dealsRouter = require('./routes/deals');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/deal-aggregator';
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

// ─── Middleware ───────────────────────────────────────────────────────────────

// CORS: allow requests from the configured frontend origin.
// CLIENT_ORIGIN="*" is used in Phase 4 (Minikube) — locked to a real host in Phase 5.
app.use(
  cors({
    origin: CLIENT_ORIGIN === '*' ? true : CLIENT_ORIGIN,
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type'],
  })
);

// Parse incoming JSON bodies (max 10kb — guards against body-size attacks)
app.use(express.json({ limit: '10kb' }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/deals', dealsRouter);

// Health-check endpoint — used by Kubernetes liveness probes in Phase 4
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Catch-all 404 for unknown routes
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─── Database connection ──────────────────────────────────────────────────────
async function startServer() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log(`✅ MongoDB connected: ${MONGO_URI}`);

    app.listen(PORT, () => {
      console.log(`🚀 Backend running on http://localhost:${PORT}`);
      console.log(`   CORS allowed from: ${CLIENT_ORIGIN}`);
    });
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
