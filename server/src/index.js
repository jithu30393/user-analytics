require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const apiRouter = require('./routes/api');

const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/user_analytics';
const origins = (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);

const root = path.join(__dirname, '..', '..');
const app = express();

app.use(cors(origins.length ? { origin: origins } : undefined));
app.use(express.json({ limit: '200kb' }));

// Tracking script + demo pages, served by the API so the demo works on one origin.
app.use('/tracker.js', express.static(path.join(root, 'tracker', 'tracker.js')));
app.use('/demo', express.static(path.join(root, 'demo')));

app.get('/health', (req, res) => res.json({ ok: true }));
app.use('/api', apiRouter);

// Optional: serve the built dashboard (single-host deploys).
const dist = path.join(root, 'dashboard', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(dist, 'index.html'));
  });
}

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`API listening on http://localhost:${PORT}`);
      console.log(`Demo page:  http://localhost:${PORT}/demo/index.html`);
    });
  })
  .catch((err) => {
    console.error('Could not connect to MongoDB:', err.message);
    process.exit(1);
  });
