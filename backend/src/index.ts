import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { healthRoutes, categoryRoutes } from './routes';
import productAdminRoutes from './routes/admin/productRoutes';
import supplierAdminRoutes from './routes/admin/supplierRoutes';
import customerAdminRoutes from './routes/admin/customerRoutes';
import productPublicRoutes from './routes/public/productRoutes';
import categoryPublicRoutes from './routes/public/categoryRoutes';
import { notFoundHandler, globalErrorHandler } from './middleware/errorHandler';
import { logger } from './infrastructure/logger';

const requiredEnvVars = ['DATABASE_URL', 'PORT'];
for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const app = express();

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3001,http://localhost:3002')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const isDev = process.env.NODE_ENV === 'development';
app.use(cors({
  origin: (origin, callback) => {
    if (isDev) return callback(null, true);
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json());

app.use('/health', healthRoutes);
app.use('/categories', categoryRoutes);

app.use('/api/admin/products', productAdminRoutes);
app.use('/api/admin/suppliers', supplierAdminRoutes);
app.use('/api/admin/customers', customerAdminRoutes);
// NOTE: No /api/public/suppliers route exists — suppliers are admin-only and must
// never be exposed on customer-facing surfaces.

// ─────────────────────────────────────────────────────────────────────────────
// /api/public routes
// Customer-facing endpoints for the storefront. These endpoints MUST NEVER expose
// supplier costs, supplier references, internal notes, or fulfillment data; the
// public serializer enforces a customer-safe allow-list.
// ─────────────────────────────────────────────────────────────────────────────
app.use('/api/public/products', productPublicRoutes);
app.use('/api/public/categories', categoryPublicRoutes);

app.use(notFoundHandler);
app.use(globalErrorHandler);

const PORT = parseInt(process.env.PORT as string, 10);
app.listen(PORT, () => {
  logger.info('Server started', { port: PORT, env: process.env.NODE_ENV });
});
