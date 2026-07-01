export { default as healthRoutes } from './healthRoutes';
export { default as categoryRoutes } from './categoryRoutes';

// ─────────────────────────────────────────────────────────────────────────────
// /api/admin routes
// Backoffice routers for store administrators. These endpoints may expose
// internal data (supplier costs, fulfillment status, etc.).
// ─────────────────────────────────────────────────────────────────────────────
export { default as productAdminRoutes } from './admin/productRoutes';
export { default as supplierAdminRoutes } from './admin/supplierRoutes';
export { default as customerAdminRoutes } from './admin/customerRoutes';
export { default as customerOrderAdminRoutes } from './admin/customerOrderRoutes';

// ─────────────────────────────────────────────────────────────────────────────
// /api/public routes
// Customer-facing routers for the storefront. These endpoints MUST NEVER expose
// supplier costs, supplier references, internal notes, or fulfillment data.
// ─────────────────────────────────────────────────────────────────────────────
export { default as productPublicRoutes } from './public/productRoutes';
export { default as categoryPublicRoutes } from './public/categoryRoutes';
export { default as sitemapPublicRoutes } from './public/sitemapRoutes';
