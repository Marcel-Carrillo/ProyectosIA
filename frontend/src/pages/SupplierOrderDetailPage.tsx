import React from 'react';
import { useParams } from 'react-router-dom';

const SupplierOrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  return (
    <div>
      <h1>Supplier Order Detail</h1>
      <p>ID: {id}</p>
    </div>
  );
};

export default SupplierOrderDetailPage;
