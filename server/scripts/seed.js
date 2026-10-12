// Generates fake sessions so the dashboard has something to show.
// Usage: npm run seed   (add --reset to wipe existing events first)
require('dotenv').config();
const mongoose = require('mongoose');
const crypto = require('crypto');
const Event = require('../src/models/Event');

const ORIGIN = process.env.SEED_ORIGIN || 'http://localhost:4000';
const PAGES = [
  { path: '/demo/index.html', w: 1280, h: 1400, hot: [[640, 260], [250, 640], [640, 640], [1030, 640]] },
  { path: '/demo/pricing.html', w: 1280, h: 700, hot: [[270, 330], [640, 330], [1010, 330]] }
];

const rand = (n) => Math.floor(Math.random() * n);
const jitter = (v, r) => Math.max(0, Math.round(v + (Math.random() - 0.5) * r));

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/user_analytics');
  if (process.argv.includes('--reset')) await Event.deleteMany({});

  const docs = [];
  for (let s = 0; s < 25; s++) {
    const sid = crypto.randomUUID();
    let t = Date.now() - rand(3 * 24 * 3600 * 1000);
    const steps = 1 + rand(3);
    for (let p = 0; p < steps; p++) {
      const page = PAGES[rand(PAGES.length)];
      const url = ORIGIN + page.path;
      const base = { session_id: sid, url, page: url, page_width: page.w, page_height: page.h, viewport_width: 1280, viewport_height: 720 };
      docs.push({ ...base, type: 'page_view', timestamp: new Date((t += 1000 + rand(3000))) });
      const clicks = 1 + rand(6);
      for (let c = 0; c < clicks; c++) {
        const [hx, hy] = Math.random() < 0.7 ? page.hot[rand(page.hot.length)] : [rand(page.w), rand(page.h)];
        docs.push({ ...base, type: 'click', x: jitter(hx, 80), y: jitter(hy, 60), timestamp: new Date((t += 800 + rand(5000))) });
      }
    }
  }
  await Event.insertMany(docs);
  console.log(`Inserted ${docs.length} events across 25 sessions.`);
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
