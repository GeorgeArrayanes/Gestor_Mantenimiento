import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'node:path';
import { config } from './config.js';
import { authenticate } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/errors.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import busRoutes from './routes/buses.js';
import incidentRoutes from './routes/incidents.js';
import notificationRoutes from './routes/notifications.js';
import dashboardRoutes from './routes/dashboard.js';

export function createApp(pool) {
  const app = express();
  app.locals.db = pool;
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: config.frontendUrl, credentials: true }));
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  if (config.nodeEnv !== 'test') app.use(morgan('dev'));
  app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));
  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRoutes);
  app.use('/api/dashboard', authenticate, dashboardRoutes);
  app.use('/api/users', authenticate, userRoutes);
  app.use('/api/buses', authenticate, busRoutes);
  app.use('/api/incidents', authenticate, incidentRoutes);
  app.use('/api/notifications', authenticate, notificationRoutes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
