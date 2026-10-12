// Set VITE_API_URL when the dashboard and API are on different origins.
const BASE = import.meta.env.VITE_API_URL || '';

async function get(path) {
  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

export const getSessions = (page = 1, limit = 15) => get(`/api/sessions?page=${page}&limit=${limit}`);
export const getSessionEvents = (id) => get(`/api/sessions/${encodeURIComponent(id)}/events`);
export const getPages = () => get('/api/pages');
export const getHeatmap = (url) => get(`/api/heatmap?url=${encodeURIComponent(url)}`);
