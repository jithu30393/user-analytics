# User Analytics

A small full-stack app that tracks user interactions (page views and clicks) on a webpage and shows them in a dashboard with a sessions/journey view and a click heatmap.

## Tech stack

- **Tracker:** vanilla JavaScript (no dependencies), `tracker/tracker.js`
- **Backend:** Node.js, Express, Mongoose
- **Database:** MongoDB
- **Dashboard:** React 18 + Vite

## Project structure

```
tracker/tracker.js     Client-side tracking script
demo/                  Two demo pages that include the tracker
server/                Express API + MongoDB models + seed script
dashboard/             React dashboard (Sessions view, Heatmap view)
docker-compose.yml     Optional local MongoDB
```

## Setup

**Prerequisites:** Node.js 18+ and a MongoDB instance (local, Docker, or MongoDB Atlas).

1. **Start MongoDB** (skip if you already have one):
   ```bash
   docker compose up -d
   ```
2. **Backend**
   ```bash
   cd server
   cp .env.example .env      # adjust MONGODB_URI if needed
   npm install
   npm run seed              # optional: 25 fake sessions (use -- --reset to wipe first)
   npm start                 # http://localhost:4000
   ```
3. **Dashboard** (new terminal)
   ```bash
   cd dashboard
   npm install
   npm run dev               # http://localhost:5173 (proxies /api to :4000)
   ```
4. **Generate real data:** open http://localhost:4000/demo/index.html, click around, visit the Pricing page, then refresh the dashboard.

### Single-host build (optional)

```bash
cd dashboard && npm install && npm run build
cd ../server && npm start        # now serves the dashboard at http://localhost:4000
```

## Adding the tracker to any page

```html
<script src="https://YOUR_API_HOST/tracker.js" data-endpoint="https://YOUR_API_HOST/api/events"></script>
```

`data-endpoint` is optional; it defaults to `<script origin>/api/events`.

Each event contains: `session_id`, `type` (`page_view` | `click`), `url`, `timestamp` (ISO 8601), and for clicks `x` / `y` (document coordinates). It also sends viewport and page dimensions, which the heatmap uses for scaling.

## API

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/events` | Store one event (or an array of up to 100) |
| GET | `/api/sessions?page=1&limit=20` | Sessions with total / page-view / click counts, newest first |
| GET | `/api/sessions/:id/events` | All events of a session, in order |
| GET | `/api/pages` | Tracked pages with view and click counts |
| GET | `/api/heatmap?url=<page url>` | Click positions for a page |

Example event:

```json
{
  "session_id": "b6f1c2e0-...",
  "type": "click",
  "url": "http://localhost:4000/demo/index.html",
  "timestamp": "2026-10-12T10:15:30.000Z",
  "x": 640,
  "y": 260
}
```

## Data model

One `events` collection (see `server/src/models/Event.js`). Indexes: `{session_id, timestamp}` for journeys, `{page, type}` for heatmaps, `{timestamp}` for recency. Sessions are derived with an aggregation over events rather than stored separately.

## Assumptions and trade-offs

- **Sessions:** the id lives in `localStorage` (cookie fallback) and rotates after 30 minutes of inactivity.
- **Heatmap page key:** URLs are normalised to origin + pathname, so query strings and hashes share one heatmap.
- **Heatmap scaling:** clicks are stored in document pixels and drawn using the ratio `x / page_width`, `y / page_height`. This lines up clicks from different screen sizes, but responsive layouts that reflow will be approximate. The heatmap draws on a plain grid rather than a screenshot of the page.
- **Heatmap limits:** the 10,000 most recent clicks per page are returned.
- **No auth / rate limiting:** the ingestion endpoint is open and only validates input. A production version would add an API key per site, rate limiting, and bot filtering.
- **Sessions are computed on read:** simple and fine at this scale; at higher volume I would pre-aggregate into a `sessions` collection.
- **Delivery:** events are sent one by one with `fetch(..., { keepalive: true })`. Batching and retry queues were left out to keep the tracker small.
- **SPA support:** `history.pushState` / `popstate` navigation is tracked as additional `page_view` events.
- **Dashboard** is read-only and has no polling; refresh to see new data.
