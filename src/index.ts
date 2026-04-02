import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import { connectMongo } from './config/mongo';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import linkRoutes from './routes/link';
import notificationsRoutes from './routes/notifications';
import medicinesRoutes from './routes/medicines';
import vitalsRoutes from './routes/vitals';
import moodsRoutes from './routes/moods';
import conditionsRoutes from './routes/conditions';
import caretakerRoutes from './routes/caretaker';
import locationRoutes from './routes/location';
import sosRoutes from './routes/sos';
import feedRoutes from './routes/feed';
import reportsRoutes from './routes/reports';
import settingsRoutes from './routes/settings';
import photosRoutes from './routes/photos';
import mlRoutes from './routes/ml';
import callsRoutes from './routes/calls';
import path from 'path';
import { Server as SocketIOServer } from 'socket.io';
import { registerSignaling } from './services/signalingService';
import { startBackgroundJobs } from './services/backgroundJobsService';
import { auditMiddleware } from './middleware/audit';
import aiRoutes from './routes/ai';

const PORT = process.env.PORT || 4000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: FRONTEND_ORIGIN,
    credentials: true,
  },
});
registerSignaling(io);

app.use(helmet());
app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));
// Global rate limiter
import { globalLimiter } from './middleware/rateLimiter';
app.use(globalLimiter);
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.get('/', (_req, res) => {
  res.json({ ok: true, name: 'EldiMind Backend (Auth scaffold)' });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/link', linkRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/medicines', medicinesRoutes);
app.use('/api/vitals', vitalsRoutes);
app.use('/api/moods', moodsRoutes);
app.use('/api/conditions', conditionsRoutes);
app.use('/api/caretaker', caretakerRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/sos', sosRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/photos', photosRoutes);
app.use('/api/ml', mlRoutes);
app.use('/api/calls', callsRoutes);

// audit middleware for sensitive routes
app.use(auditMiddleware);

// AI proxy routes
app.use('/api/ai', aiRoutes);

// global error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(err.status || 500).json({ ok: false, error: err.message || 'Internal Server Error' });
});

async function start() {
  await connectMongo();
  if (process.env.NODE_ENV !== 'test') {
    startBackgroundJobs();
  }
  server.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

if (require.main === module) {
  start().catch((err) => {
    console.error('Failed to start server', err);
    process.exit(1);
  });
}

export default app;
