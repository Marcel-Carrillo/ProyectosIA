import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigationType } from 'react-router-dom';
import { AdminAuthProvider } from './contexts/AdminAuthContext';
import { CustomerAuthProvider } from './contexts/CustomerAuthContext';
import { CartProvider } from './contexts/CartContext';
import { CookieConsentProvider } from './contexts/CookieConsentContext';
import Layout from './components/Layout';
import RequireAdminAuth from './components/admin/RequireAdminAuth';
import RequireCustomerAuth from './components/storefront/RequireCustomerAuth';
import ProductsPage from './pages/ProductsPage';
import ProductDetailPage from './pages/ProductDetailPage';
import CategoriesPage from './pages/CategoriesPage';
import SuppliersPage from './pages/SuppliersPage';
import CustomersPage from './pages/CustomersPage';
import CustomerOrdersPage from './pages/CustomerOrdersPage';
import CustomerOrderDetailPage from './pages/CustomerOrderDetailPage';
import SupplierOrdersPage from './pages/SupplierOrdersPage';
import SupplierOrderDetailPage from './pages/SupplierOrderDetailPage';
import ShipmentsPage from './pages/ShipmentsPage';
import ShipmentDetailPage from './pages/ShipmentDetailPage';
import ReturnRequestsPage from './pages/ReturnRequestsPage';
import ReturnRequestDetailPage from './pages/ReturnRequestDetailPage';
import RefundsPage from './pages/RefundsPage';
import RefundDetailPage from './pages/RefundDetailPage';
import NotFoundPage from './pages/NotFoundPage';
import AdminLoginPage from './pages/admin/AdminLoginPage';
import StorefrontLayout from './components/storefront/StorefrontLayout';
import LoginPage from './pages/storefront/LoginPage';
import RegisterPage from './pages/storefront/RegisterPage';
import CartPage from './pages/storefront/CartPage';
import CheckoutPage from './pages/storefront/CheckoutPage';
import OrderConfirmationPage from './pages/storefront/OrderConfirmationPage';
import AccountPage from './pages/storefront/AccountPage';
import AccountOrdersPage from './pages/storefront/AccountOrdersPage';
import AccountProfilePage from './pages/storefront/AccountProfilePage';
import AccountWishlistPage from './pages/storefront/AccountWishlistPage';
import AccountOrderDetailPage from './pages/storefront/AccountOrderDetailPage';
import ForgotPasswordPage from './pages/storefront/ForgotPasswordPage';
import ResetPasswordPage from './pages/storefront/ResetPasswordPage';
import TwoFactorSetupPage from './pages/storefront/TwoFactorSetupPage';
import ContentPage from './pages/storefront/ContentPage';

const CatalogPage = lazy(() => import('./pages/storefront/CatalogPage'));
const StorefrontProductPage = lazy(() => import('./pages/storefront/ProductPage'));

// Disable browser auto-restore so we control it manually
if (typeof window !== 'undefined') window.history.scrollRestoration = 'manual';

function ScrollManager() {
  const { key } = useLocation();
  const navType = useNavigationType();

  // Save on every scroll AND synchronously on cleanup (covers fast click after scroll)
  useEffect(() => {
    let rafId: number;
    const save = () => sessionStorage.setItem(`scroll:${key}`, String(Math.round(window.scrollY)));
    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(save);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(rafId);
      save(); // synchronous capture at navigation moment
    };
  }, [key]);

  // PUSH/REPLACE → scroll to top; POP → restore saved position
  useEffect(() => {
    if (navType !== 'POP') {
      window.scrollTo(0, 0);
      return;
    }

    const saved = sessionStorage.getItem(`scroll:${key}`);
    if (!saved || saved === '0') return;

    const y = parseInt(saved, 10);
    let done = false;

    // Stop retrying once window.scrollY actually reached y (page was tall enough)
    const attempt = () => {
      if (done) return;
      window.scrollTo(0, y);
      if (Math.abs(window.scrollY - y) < 2) done = true;
    };

    attempt();
    const raf = requestAnimationFrame(attempt);
    const t300 = setTimeout(attempt, 300);
    const t700 = setTimeout(attempt, 700);
    const t1200 = setTimeout(attempt, 1200);
    const t2500 = setTimeout(attempt, 2500);

    // Watch for page growth (lazy chunk + API response + images) up to 6 s
    const observer = new ResizeObserver(attempt);
    observer.observe(document.body);
    const observerStop = setTimeout(() => observer.disconnect(), 6000);

    return () => {
      done = true;
      cancelAnimationFrame(raf);
      clearTimeout(t300);
      clearTimeout(t700);
      clearTimeout(t1200);
      clearTimeout(t2500);
      clearTimeout(observerStop);
      observer.disconnect();
    };
  }, [key, navType]);

  return null;
}

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ScrollManager />
      <AdminAuthProvider>
        <CustomerAuthProvider>
          <CartProvider>
            <Routes>
              <Route path="/admin/login" element={<AdminLoginPage />} />

              <Route element={<CookieConsentProvider><StorefrontLayout /></CookieConsentProvider>}>
                <Route path="/" element={<Navigate to="/catalog" replace />} />
                <Route
                  path="/catalog"
                  element={
                    <Suspense fallback={<div style={{ minHeight: '60vh' }} />}>
                      <CatalogPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/catalog/:id"
                  element={
                    <Suspense fallback={<div style={{ minHeight: '60vh' }} />}>
                      <StorefrontProductPage />
                    </Suspense>
                  }
                />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/cart" element={<CartPage />} />
                <Route path="/checkout" element={<CheckoutPage />} />
                <Route path="/order-confirmation/:orderNumber" element={<OrderConfirmationPage />} />
                <Route path="/account" element={<RequireCustomerAuth><AccountPage /></RequireCustomerAuth>} />
                <Route path="/account/profile" element={<RequireCustomerAuth><AccountProfilePage /></RequireCustomerAuth>} />
                <Route path="/account/orders" element={<RequireCustomerAuth><AccountOrdersPage /></RequireCustomerAuth>} />
                <Route path="/account/orders/:id" element={<RequireCustomerAuth><AccountOrderDetailPage /></RequireCustomerAuth>} />
                <Route path="/account/wishlist" element={<RequireCustomerAuth><AccountWishlistPage /></RequireCustomerAuth>} />
                <Route path="/account/security/2fa" element={<RequireCustomerAuth><TwoFactorSetupPage /></RequireCustomerAuth>} />
                <Route path="/pages/:slug" element={<ContentPage />} />
              </Route>

              <Route
                path="/"
                element={
                  <RequireAdminAuth>
                    <Layout />
                  </RequireAdminAuth>
                }
              >
                <Route path="products" element={<ProductsPage />} />
                <Route path="products/:id" element={<ProductDetailPage />} />
                <Route path="categories" element={<CategoriesPage />} />
                <Route path="suppliers" element={<SuppliersPage />} />
                <Route path="customers" element={<CustomersPage />} />
                <Route path="customer-orders" element={<CustomerOrdersPage />} />
                <Route path="customer-orders/:id" element={<CustomerOrderDetailPage />} />
                <Route path="supplier-orders" element={<SupplierOrdersPage />} />
                <Route path="supplier-orders/:id" element={<SupplierOrderDetailPage />} />
                <Route path="shipments" element={<ShipmentsPage />} />
                <Route path="shipments/:id" element={<ShipmentDetailPage />} />
                <Route path="return-requests" element={<ReturnRequestsPage />} />
                <Route path="return-requests/:id" element={<ReturnRequestDetailPage />} />
                <Route path="refunds" element={<RefundsPage />} />
                <Route path="refunds/:id" element={<RefundDetailPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </CartProvider>
        </CustomerAuthProvider>
      </AdminAuthProvider>
    </BrowserRouter>
  );
};

export default App;
