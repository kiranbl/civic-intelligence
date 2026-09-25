const LOCAL_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];

// Exact origins only: no wildcard Vercel previews or credential reflection.
export function corsOptions(env = process.env) {
  const configured = env.CORS_ALLOWED_ORIGINS?.trim();
  if (env.NODE_ENV === 'production' && !configured) {
    throw new Error('CORS_ALLOWED_ORIGINS is required in production');
  }
  const origins = configured ? configured.split(',').map(value => value.trim()) : LOCAL_ORIGINS;
  for (const origin of origins) {
    let url;
    try { url = new URL(origin); } catch { /* Report only configuration field, never its value. */ }
    if (!url || !['http:', 'https:'].includes(url.protocol) || url.origin !== origin
      || url.username || url.password || origin.includes('*')
      || (env.NODE_ENV === 'production' && url.protocol !== 'https:')) {
      throw new Error('CORS_ALLOWED_ORIGINS must contain exact origins (HTTPS in production)');
    }
  }
  return {
    origin(origin, callback) {
      // Health checks and server-to-server clients need not send Origin.
      if (!origin || origins.includes(origin)) return callback(null, true);
      const error = new Error('Origin not allowed');
      error.status = 403;
      callback(error);
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  };
}
