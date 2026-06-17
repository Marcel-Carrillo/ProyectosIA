export { default as healthRoutes } from './healthRoutes';
export { default as categoryRoutes } from './categoryRoutes';

// ─────────────────────────────────────────────────────────────────────────────
// /api/admin routes
// Backoffice routers for store administrators. These endpoints may expose
// internal data (supplier costs, fulfillment status, etc.).
// ─────────────────────────────────────────────────────────────────────────────
export { default as productAdminRoutes } from './admin/productRoutes';

// ─────────────────────────────────────────────────────────────────────────────
// /api/public routes
// Customer-facing routers for the storefront. These endpoints MUST NEVER expose
// supplier costs, supplier references, internal notes, or fulfillment data.
// ─────────────────────────────────────────────────────────────────────────────
export { default as productPublicRoutes } from './public/productRoutes';
export { default as categoryPublicRoutes } from './public/categoryRoutes';
