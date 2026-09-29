import express from 'express';
import cors from 'cors';
import { corsOptions } from './config/cors.js';
import healthRoutes from './routes/health.routes.js';
import districtRoutes from './routes/district.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import citizenRequestRoutes from './routes/citizenRequest.routes.js';
import speechRoutes from './routes/speech.routes.js';
import { proxyHops } from './config/speech.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
app.set('trust proxy', proxyHops());

app.use(cors(corsOptions()));
app.use(express.json({ limit: '100kb' }));

app.use('/api/health', healthRoutes);
app.use('/api/districts', districtRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/citizen-requests', citizenRequestRoutes);
app.use('/api/speech', speechRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.use(errorHandler);

export default app;
