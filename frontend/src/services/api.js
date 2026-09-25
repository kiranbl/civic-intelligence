const baseUrl = (import.meta.env?.VITE_API_BASE_URL || (import.meta.env?.PROD ? '/api' : 'http://localhost:3000/api')).replace(/\/$/, '');
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
  const districtRows = districts.status === 'fulfilled' ? districts.value.data : [];
  const analyticsValue = analytics.status === 'fulfilled' ? analytics.value : { data: [], methodology: null };
  const requests = await Promise.allSettled(districtRows.map(d => get('/districts/' + d.id + '/requests', signal)));
  return { connected: health.status === 'fulfilled', districts: districtRows, analytics: analyticsValue, districtsFailed: districts.status !== 'fulfilled', analyticsFailed: analytics.status !== 'fulfilled',
    requestCount: districts.status === 'fulfilled' && requests.every(r => r.status === 'fulfilled') ? requests.reduce((sum, r) => sum + r.value.data.length, 0) : null };
}

// The backend owns model retries. One browser action sends one POST only.
// Six backend attempts can take over three minutes, so allow the full budget.
async function post(path, body, expectedStatus) {
  let response;
  try {
    response = await fetch(baseUrl + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(210000),
    });
  } catch {
    throw new Error(expectedStatus === 201
      ? 'Submission could not be confirmed. Check the district request records before trying again to avoid a duplicate.'
      : 'Could not reach the backend. Check your connection and try again.');
  }
  if (response.status !== expectedStatus) {
    const messages = {
      400: 'Please check the selected district and request text.',
      404: 'The selected district is unavailable. Refresh the dashboard and select a district again.',
      413: 'The request is too long. Please use no more than 5,000 characters.',
      429: 'The AI service is temporarily busy. Please try again.',
      503: 'The AI service is temporarily busy. Please try again.',
      504: 'The AI service is temporarily busy. Please try again.',
      502: 'The AI service could not interpret this request. Please review the text and try again.',
    };
    throw new Error(messages[response.status] || 'The request could not be completed. Please try again later.');
  }
  try {
    const result = await response.json();
    if (!result.success || !result.data) throw new Error();
    return result.data;
  } catch {
    throw new Error(expectedStatus === 201
      ? 'Submission could not be confirmed. Check the district request records before trying again to avoid a duplicate.'
      : 'The analysis response could not be read. Please try again.');
  }
}
export const analyzeRequest = text => post('/citizen-requests/analyze', { text }, 200);
export const submitRequest = (districtId, text) => post('/citizen-requests', { districtId, text, channel: 'TEXT' }, 201);

export async function getDistrictRequests(id, signal) {
  const body = await get('/districts/' + id + '/requests', signal);
  if (!Array.isArray(body.data)) throw new Error('Request history unavailable');
  return body.data;
}

export async function getWaterPlanning(signal) {
  const body = await get('/analytics/water-planning', signal);
  if (!Array.isArray(body.data)) throw new Error('Planning unavailable');
  return body.data;
}
