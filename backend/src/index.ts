import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { healthRoutes, categoryRoutes } from './routes';
import productAdminRoutes from './routes/admin/productRoutes';
import supplierAdminRoutes from './routes/admin/supplierRoutes';
import customerAdminRoutes from './routes/admin/customerRoutes';
import customerOrderAdminRoutes from './routes/admin/customerOrderRoutes';
import supplierOrderAdminRoutes from './routes/admin/supplierOrderRoutes';
import refundAdminRoutes from './routes/admin/refundRoutes';
import shipmentAdminRoutes from './routes/admin/shipmentRoutes';
import returnRequestAdminRoutes from './routes/admin/returnRequestRoutes';
import adminAuthRoutes from './routes/admin/adminAuthRoutes';
import productPublicRoutes from './routes/public/productRoutes';
import categoryPublicRoutes from './routes/public/categoryRoutes';
import authPublicRoutes from './routes/public/authRoutes';
import accountPublicRoutes from './routes/public/accountRoutes';
import checkoutPublicRoutes from './routes/public/checkoutRoutes';
import couponPublicRoutes from './routes/public/couponRoutes';
import paymentPublicRoutes from './routes/public/paymentRoutes';
import { notFoundHandler, globalErrorHandler } from './middleware/errorHandler';
import { requireAdminAuth } from './middleware/requireAdminAuth';
import { logger } from './infrastructure/logger';

const requiredEnvVars = ['DATABASE_URL'];
for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

if (process.env.NODE_ENV === 'production') {
  const productionRequiredVars = [
    'ADMIN_JWT_SECRET',
    'CUSTOMER_JWT_SECRET',
    'COOKIE_SECRET',
    'SMTP_HOST',
    'SMTP_USER',
    'SMTP_PASS',
    'SMTP_FROM',
  ];
  const missingProdVars = productionRequiredVars.filter((key) => !process.env[key]);
  if (missingProdVars.length > 0) {
    throw new Error(
      `Missing required production environment variables: ${missingProdVars.join(', ')}`
    );
  }
}

if (process.env.NODE_ENV !== 'test') {
  const stripeRequiredVars = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PUBLISHABLE_KEY'];
  const missingStripeVars = stripeRequiredVars.filter((key) => !process.env[key]);
  if (missingStripeVars.length > 0) {
    throw new Error(
      `Missing required Stripe environment variables: ${missingStripeVars.join(', ')}`
    );
  }
}

if (process.env.NODE_ENV !== 'test') {
  const printfulRequiredVars = ['PRINTFUL_API_KEY'];
  const missingPrintfulVars = printfulRequiredVars.filter((key) => !process.env[key]);
  if (missingPrintfulVars.length > 0) {
    throw new Error(
      `Missing required Printful environment variables: ${missingPrintfulVars.join(', ')}`
    );
  }
}

export const app = express();

// Trust exactly one proxy hop in prod (API Gateway/CloudFront); loopback only in dev
// (CRA dev proxy). Prevents express-rate-limit ERR_ERL_UNEXPECTED_X_FORWARDED_FOR.
app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : 'loopback');

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

// IMPORTANT: express.raw() on webhook path BEFORE express.json().
// Stripe signature verification requires the original raw body bytes.
app.use(
  '/api/public/payments/webhook',
  express.raw({ type: 'application/json' })
);

app.use(express.json());
app.use(cookieParser(process.env.COOKIE_SECRET || process.env.JWT_SECRET || 'change-me-in-production'));

const swaggerDocument = yaml.load(fs.readFileSync(`${__dirname}/api-spec.yml`, 'utf8')) as object;
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use('/health', healthRoutes);
app.use('/categories', categoryRoutes);

const adminRouter = express.Router();
adminRouter.use('/auth', adminAuthRoutes);
adminRouter.use(requireAdminAuth);
adminRouter.use('/products', productAdminRoutes);
adminRouter.use('/suppliers', supplierAdminRoutes);
adminRouter.use('/customers', customerAdminRoutes);
adminRouter.use('/customer-orders', customerOrderAdminRoutes);
adminRouter.use('/supplier-orders', supplierOrderAdminRoutes);
adminRouter.use('/refunds', refundAdminRoutes);
adminRouter.use('/shipments', shipmentAdminRoutes);
adminRouter.use('/return-requests', returnRequestAdminRoutes);
app.use('/api/admin', adminRouter);
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
app.use('/api/public/auth', authPublicRoutes);
app.use('/api/public/account', accountPublicRoutes);
app.use('/api/public/checkout', checkoutPublicRoutes);
app.use('/api/public/coupons', couponPublicRoutes);
app.use('/api/public/payments', paymentPublicRoutes);

app.use(notFoundHandler);
app.use(globalErrorHandler);

const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;
const PORT = parseInt(process.env.PORT as string, 10) || 3000;
if (process.env.NODE_ENV !== 'test' && !isLambda) {
  app.listen(PORT, () => {
    logger.info('Server started', { port: PORT, env: process.env.NODE_ENV });
  });
}
