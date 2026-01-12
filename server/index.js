import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { createLogger } from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { db } from './db/connection.js';

// Routes
import runsRouter from './routes/runs.js';
import policiesRouter from './routes/policies.js';
import evalsRouter from './routes/evals.js';
import tracesRouter from './routes/traces.js';
import approvalsRouter from './routes/approvals.js';
import metricsRouter from './routes/metrics.js';

dotenv.config();

const app = express();
const logger = createLogger();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(rateLimiter);

// Health check
app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    res.status(503).json({ status: 'unhealthy', error: error.message });
  }
});

// API Routes
app.use('/v1/runs', runsRouter);
app.use('/v1/policies', policiesRouter);
app.use('/v1/evals', evalsRouter);
app.use('/v1/traces', tracesRouter);
app.use('/v1/approvals', approvalsRouter);
app.use('/v1/metrics', metricsRouter);

// Error handling
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

export default app;
