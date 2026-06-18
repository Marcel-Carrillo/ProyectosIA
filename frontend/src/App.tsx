import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AdminAuthProvider } from './contexts/AdminAuthContext';
import { CustomerAuthProvider } from './contexts/CustomerAuthContext';
import { CartProvider } from './contexts/CartContext';
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
import ReturnRequestsPage from './pages/ReturnRequestsPage';
import RefundsPage from './pages/RefundsPage';
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
import ForgotPasswordPage from './pages/storefront/ForgotPasswordPage';
import ResetPasswordPage from './pages/storefront/ResetPasswordPage';
import TwoFactorSetupPage from './pages/storefront/TwoFactorSetupPage';

const CatalogPage = lazy(() => import('./pages/storefront/CatalogPage'));
const StorefrontProductPage = lazy(() => import('./pages/storefront/ProductPage'));

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AdminAuthProvider>
        <CustomerAuthProvider>
          <CartProvider>
            <Routes>
              <Route path="/admin/login" element={<AdminLoginPage />} />

              <Route element={<StorefrontLayout />}>
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
                <Route path="/account/wishlist" element={<RequireCustomerAuth><AccountWishlistPage /></RequireCustomerAuth>} />
                <Route path="/account/security/2fa" element={<RequireCustomerAuth><TwoFactorSetupPage /></RequireCustomerAuth>} />
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
                <Route path="return-requests" element={<ReturnRequestsPage />} />
                <Route path="refunds" element={<RefundsPage />} />
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
