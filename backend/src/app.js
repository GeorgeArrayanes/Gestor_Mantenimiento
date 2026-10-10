import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config.js';
import { authenticate } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/errors.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import incidentRoutes from './routes/incidents.js';
import dashboardRoutes from './routes/dashboard.js';
import personnelRoutes from './routes/personnel.js';
import spaceRoutes from './routes/spaces.js';
import evidenceRoutes from './routes/evidences.js';

export function createApp(pool) {
  const app = express();
  app.locals.db = pool;
  if (config.nodeEnv === 'production') app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: config.frontendUrl, credentials: true }));
  app.use(cookieParser());
  app.use((req, res, next) => {
    if (!['GET','HEAD','OPTIONS'].includes(req.method) && req.headers.origin && req.headers.origin !== config.frontendUrl) return res.status(403).json({ message: 'Origen de solicitud no autorizado.' });
    next();
  });
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  if (config.nodeEnv !== 'test') app.use(morgan('dev'));
  app.get('/api/health', (req, res) => res.json({ ok: true, keepAlive: Boolean(config.keepAliveUrl) }));
  app.use('/api/auth', authRoutes);
  app.use('/api/dashboard', authenticate, dashboardRoutes);
  app.use('/api/users', authenticate, userRoutes);
  app.use('/api/incidents', authenticate, incidentRoutes);
  app.use('/api/personnel', authenticate, personnelRoutes);
  app.use('/api/spaces', authenticate, spaceRoutes);
  app.use('/api/evidences', authenticate, evidenceRoutes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
