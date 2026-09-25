export function validateProductionApiUrl(value) {
  let url;
  try { url = new URL(value); } catch { /* Do not echo configuration values. */ }
  if (!url || url.protocol !== 'https:' || url.username || url.password || url.search || url.hash
    || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.hostname.endsWith('.localhost')
    || url.pathname.replace(/\/$/, '') !== '/api') {
    throw new Error('Set VITE_API_BASE_URL to the HTTPS backend URL ending in /api before building for production');
  }
}
