import React, { useEffect, useState } from 'react';
import { getSessions, getSessionEvents } from '../api.js';

const fmt = (d) => new Date(d).toLocaleString();
const shortUrl = (u) => {
  try {
    const x = new URL(u);
    return x.pathname + x.search + x.hash;
  } catch {
    return u;
  }
};

export default function Sessions() {
  const [data, setData] = useState({ sessions: [], total: 0, page: 1, limit: 15 });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    getSessions(page)
      .then((d) => { setData(d); setError(''); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => {
    if (!selected) return;
    setLoadingEvents(true);
    getSessionEvents(selected)
      .then((d) => setEvents(d.events))
      .catch((e) => setError(e.message))
      .finally(() => setLoadingEvents(false));
  }, [selected]);

  const pages = Math.max(Math.ceil(data.total / data.limit), 1);

  return (
    <div className="split">
      <section className="panel">
        <h2>Sessions <span className="muted">({data.total})</span></h2>
        {error && <p className="error">{error}</p>}
        {loading ? (
          <p className="muted">Loading…</p>
        ) : data.sessions.length === 0 ? (
          <p className="muted">No sessions yet. Open the demo page and click around, or run <code>npm run seed</code>.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Session</th><th>Events</th><th>Views</th><th>Clicks</th><th>Last seen</th></tr>
            </thead>
            <tbody>
              {data.sessions.map((s) => (
                <tr
                  key={s.session_id}
                  className={selected === s.session_id ? 'row selected' : 'row'}
                  onClick={() => setSelected(s.session_id)}
                >
                  <td title={s.session_id}><code>{s.session_id.slice(0, 8)}…</code></td>
                  <td>{s.total_events}</td>
                  <td>{s.page_views}</td>
                  <td>{s.clicks}</td>
                  <td>{fmt(s.last_seen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="pager">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
          <span className="muted">Page {page} of {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      </section>

      <section className="panel">
        <h2>User journey</h2>
        {!selected ? (
          <p className="muted">Select a session to see its events in order.</p>
        ) : loadingEvents ? (
          <p className="muted">Loading…</p>
        ) : (
          <>
            <p className="muted">Session <code>{selected}</code> · {events.length} events</p>
            <ol className="timeline">
              {events.map((e, i) => (
                <li key={e._id} className={`event ${e.type}`}>
                  <span className="step">{i + 1}</span>
                  <div>
                    <strong>{e.type === 'page_view' ? 'Page view' : 'Click'}</strong>
                    {e.type === 'click' && <span className="muted"> at ({e.x}, {e.y}){e.target ? ` on <${e.target}>` : ''}</span>}
                    <div className="url">{shortUrl(e.url)}</div>
                    <div className="muted small">{fmt(e.timestamp)}</div>
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}
      </section>
    </div>
  );
}
