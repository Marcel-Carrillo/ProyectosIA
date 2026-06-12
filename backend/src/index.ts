import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { healthRoutes, categoryRoutes } from './routes';
import productAdminRoutes from './routes/admin/productRoutes';
import { notFoundHandler, globalErrorHandler } from './middleware/errorHandler';
import { logger } from './infrastructure/logger';

const requiredEnvVars = ['DATABASE_URL', 'PORT'];
for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const app = express();

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3001,http://localhost:3002').split(',').map((s) => s.trim());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json());

app.use('/health', healthRoutes);
app.use('/categories', categoryRoutes);

app.use('/api/admin/products', productAdminRoutes);

// ─────────────────────────────────────────────────────────────────────────────
// FUTURE: /api/public routes
// Register customer-facing routers here. These endpoints MUST NEVER expose
// supplier costs, supplier references, internal notes, or fulfillment data.
// Example:
//   import productPublicRoutes from './routes/public/productRoutes';
//   app.use('/api/public/products', productPublicRoutes);
// ─────────────────────────────────────────────────────────────────────────────

app.use(notFoundHandler);
app.use(globalErrorHandler);

const PORT = parseInt(process.env.PORT as string, 10);
app.listen(PORT, () => {
  logger.info('Server started', { port: PORT, env: process.env.NODE_ENV });
});
