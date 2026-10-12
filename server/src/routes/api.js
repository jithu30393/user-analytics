const express = require('express');
const Event = require('../models/Event');

const router = express.Router();

// Strip query string and hash so /pricing?a=1#x and /pricing share one heatmap.
function normalizePage(url) {
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch (e) {
    return String(url).split(/[?#]/)[0];
  }
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function sanitize(raw, userAgent) {
  if (!raw || typeof raw !== 'object') return { error: 'event must be an object' };

  const { session_id, type, url } = raw;
  if (typeof session_id !== 'string' || !session_id.trim()) return { error: 'session_id is required' };
  if (!Event.EVENT_TYPES.includes(type)) return { error: `type must be one of: ${Event.EVENT_TYPES.join(', ')}` };
  if (typeof url !== 'string' || !url.trim()) return { error: 'url is required' };

  let timestamp = raw.timestamp ? new Date(raw.timestamp) : new Date();
  if (isNaN(timestamp.getTime())) timestamp = new Date();

  const doc = {
    session_id: session_id.trim().slice(0, 100),
    type,
    url: url.slice(0, 2048),
    page: normalizePage(url).slice(0, 2048),
    timestamp,
    viewport_width: num(raw.viewport_width),
    viewport_height: num(raw.viewport_height),
    page_width: num(raw.page_width),
    page_height: num(raw.page_height),
    referrer: typeof raw.referrer === 'string' ? raw.referrer.slice(0, 2048) : undefined,
    title: typeof raw.title === 'string' ? raw.title.slice(0, 300) : undefined,
    user_agent: userAgent ? String(userAgent).slice(0, 300) : undefined
  };

  if (type === 'click') {
    const x = num(raw.x);
    const y = num(raw.y);
    if (x === undefined || y === undefined) return { error: 'click events require numeric x and y' };
    doc.x = x;
    doc.y = y;
    doc.client_x = num(raw.client_x);
    doc.client_y = num(raw.client_y);
    doc.target = typeof raw.target === 'string' ? raw.target.slice(0, 50) : undefined;
  }

  return { doc };
}

// POST /api/events  – accepts a single event or an array of events
router.post('/events', async (req, res) => {
  try {
    const items = Array.isArray(req.body) ? req.body : [req.body];
    if (items.length === 0 || items.length > 100) {
      return res.status(400).json({ error: 'send between 1 and 100 events' });
    }

    const docs = [];
    for (const item of items) {
      const { doc, error } = sanitize(item, req.get('user-agent'));
      if (error) return res.status(400).json({ error });
      docs.push(doc);
    }

    await Event.insertMany(docs);
    res.status(201).json({ ok: true, stored: docs.length });
  } catch (err) {
    console.error('POST /events failed:', err);
    res.status(500).json({ error: 'internal error' });
  }
});

// GET /api/sessions?page=1&limit=20  – sessions with event counts
router.get('/sessions', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

    const [result] = await Event.aggregate([
      {
        $group: {
          _id: '$session_id',
          total_events: { $sum: 1 },
          page_views: { $sum: { $cond: [{ $eq: ['$type', 'page_view'] }, 1, 0] } },
          clicks: { $sum: { $cond: [{ $eq: ['$type', 'click'] }, 1, 0] } },
          first_seen: { $min: '$timestamp' },
          last_seen: { $max: '$timestamp' }
        }
      },
      { $sort: { last_seen: -1 } },
      {
        $facet: {
          rows: [{ $skip: (page - 1) * limit }, { $limit: limit }],
          total: [{ $count: 'count' }]
        }
      }
    ]);

    const sessions = result.rows.map((r) => ({
      session_id: r._id,
      total_events: r.total_events,
      page_views: r.page_views,
      clicks: r.clicks,
      first_seen: r.first_seen,
      last_seen: r.last_seen
    }));
    const total = result.total[0] ? result.total[0].count : 0;

    res.json({ sessions, total, page, limit });
  } catch (err) {
    console.error('GET /sessions failed:', err);
    res.status(500).json({ error: 'internal error' });
  }
});

// GET /api/sessions/:id/events  – ordered user journey
router.get('/sessions/:id/events', async (req, res) => {
  try {
    const events = await Event.find({ session_id: req.params.id })
      .sort({ timestamp: 1, _id: 1 })
      .limit(5000)
      .lean();
    res.json({ session_id: req.params.id, count: events.length, events });
  } catch (err) {
    console.error('GET /sessions/:id/events failed:', err);
    res.status(500).json({ error: 'internal error' });
  }
});

// GET /api/pages  – distinct pages with view/click counts (for the heatmap selector)
router.get('/pages', async (req, res) => {
  try {
    const rows = await Event.aggregate([
      {
        $group: {
          _id: '$page',
          views: { $sum: { $cond: [{ $eq: ['$type', 'page_view'] }, 1, 0] } },
          clicks: { $sum: { $cond: [{ $eq: ['$type', 'click'] }, 1, 0] } }
        }
      },
      { $sort: { clicks: -1 } }
    ]);
    res.json({ pages: rows.map((r) => ({ page: r._id, views: r.views, clicks: r.clicks })) });
  } catch (err) {
    console.error('GET /pages failed:', err);
    res.status(500).json({ error: 'internal error' });
  }
});

// GET /api/heatmap?url=<page url>  – click positions for a page
router.get('/heatmap', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'url query param is required' });

    const page = normalizePage(url);
    const clicks = await Event.find({ type: 'click', page })
      .select('x y page_width page_height viewport_width timestamp -_id')
      .sort({ timestamp: -1 })
      .limit(10000)
      .lean();

    const withDims = clicks.filter((c) => c.page_width > 0 && c.page_height > 0);
    const avg = (key) =>
      withDims.length ? Math.round(withDims.reduce((s, c) => s + c[key], 0) / withDims.length) : 1200;

    res.json({
      page,
      total: clicks.length,
      page_width: avg('page_width'),
      page_height: avg('page_height'),
      clicks: clicks.map((c) => ({
        x: c.x,
        y: c.y,
        // Ratios let clicks from different screen sizes line up on one canvas.
        xr: c.page_width > 0 ? Math.min(c.x / c.page_width, 1) : null,
        yr: c.page_height > 0 ? Math.min(c.y / c.page_height, 1) : null
      }))
    });
  } catch (err) {
    console.error('GET /heatmap failed:', err);
    res.status(500).json({ error: 'internal error' });
  }
});

module.exports = router;
