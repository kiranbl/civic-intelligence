const baseUrl = (import.meta.env?.VITE_API_BASE_URL || 'http://localhost:3000/api').replace(/\/$/, '');
async function get(path, signal) {
  const response = await fetch(baseUrl + path, { signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]) });
  if (!response.ok) throw new Error('Data unavailable');
  const body = await response.json();
  if (!body.success) throw new Error('Data unavailable');
  return body;
}
export async function loadDashboard(signal) {
  const [health, districts, analytics] = await Promise.allSettled([
    get('/health', signal), get('/districts', signal), get('/analytics/water-priority', signal),
  ]);
  if (districts.status !== 'fulfilled' || analytics.status !== 'fulfilled') throw new Error('Data unavailable');
  const requests = await Promise.allSettled(districts.value.data.map(d => get('/districts/' + d.id + '/requests', signal)));
  return { connected: health.status === 'fulfilled', districts: districts.value.data, analytics: analytics.value,
    requestCount: requests.every(r => r.status === 'fulfilled') ? requests.reduce((sum, r) => sum + r.value.data.length, 0) : null };
}
