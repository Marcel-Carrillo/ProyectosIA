import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
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

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/products" replace />} />
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
    </BrowserRouter>
  );
};

export default App;
