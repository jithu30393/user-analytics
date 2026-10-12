import React, { useEffect, useMemo, useState } from 'react';
import { getPages, getHeatmap } from '../api.js';

const CELL = 24; // grid cell size in rendered px

export default function Heatmap() {
  const [pages, setPages] = useState([]);
  const [url, setUrl] = useState('');
  const [data, setData] = useState(null);
  const [mode, setMode] = useState('dots');
  const [error, setError] = useState('');

  useEffect(() => {
    getPages()
      .then((d) => {
        setPages(d.pages);
        if (d.pages.length) setUrl(d.pages[0].page);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!url) return;
    setData(null);
    getHeatmap(url)
      .then((d) => { setData(d); setError(''); })
      .catch((e) => setError(e.message));
  }, [url]);

  // Canvas keeps the page's aspect ratio; clicks are placed by ratio so
  // different screen sizes line up.
  const aspect = data ? data.page_height / data.page_width : 1;

  const cells = useMemo(() => {
    if (!data || mode !== 'grid') return [];
    const cols = 40;
    const rows = Math.max(Math.round(cols * aspect), 1);
    const counts = new Map();
    for (const c of data.clicks) {
      if (c.xr == null || c.yr == null) continue;
      const cx = Math.min(Math.floor(c.xr * cols), cols - 1);
      const cy = Math.min(Math.floor(c.yr * rows), rows - 1);
      const key = `${cx},${cy}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const max = Math.max(...counts.values(), 1);
    return { cols, rows, items: [...counts].map(([k, n]) => ({ k, x: +k.split(',')[0], y: +k.split(',')[1], n, a: n / max })) };
  }, [data, mode, aspect]);

  return (
    <section className="panel wide">
      <div className="toolbar">
        <h2>Click heatmap</h2>
        <select value={url} onChange={(e) => setUrl(e.target.value)} disabled={!pages.length}>
          {pages.length === 0 && <option>No pages tracked yet</option>}
          {pages.map((p) => (
            <option key={p.page} value={p.page}>
              {p.page} ({p.clicks} clicks)
            </option>
          ))}
        </select>
        <div className="toggle">
          <button className={mode === 'dots' ? 'tab active' : 'tab'} onClick={() => setMode('dots')}>Dots</button>
          <button className={mode === 'grid' ? 'tab active' : 'tab'} onClick={() => setMode('grid')}>Grid</button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {data && (
        <p className="muted">
          {data.total} clicks · page ≈ {data.page_width}×{data.page_height}px
        </p>
      )}

      {data && (
        <div className="heat-wrap">
          <div className="heat" style={{ paddingTop: `${Math.min(aspect, 3) * 100}%` }}>
            {mode === 'dots' &&
              data.clicks.map((c, i) =>
                c.xr == null ? null : (
                  <span key={i} className="dot" style={{ left: `${c.xr * 100}%`, top: `${c.yr * 100}%` }} />
                )
              )}
            {mode === 'grid' &&
              cells.items &&
              cells.items.map((c) => (
                <span
                  key={c.k}
                  className="cell"
                  title={`${c.n} click${c.n > 1 ? 's' : ''}`}
                  style={{
                    left: `${(c.x / cells.cols) * 100}%`,
                    top: `${(c.y / cells.rows) * 100}%`,
                    width: `${100 / cells.cols}%`,
                    height: `${100 / cells.rows}%`,
                    background: `rgba(239, 68, 68, ${0.2 + c.a * 0.7})`
                  }}
                />
              ))}
          </div>
        </div>
      )}
      {data && data.total === 0 && <p className="muted">No clicks recorded for this page yet.</p>}
    </section>
  );
}
