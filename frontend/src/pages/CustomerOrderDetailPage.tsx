import React from 'react';
import { useParams } from 'react-router-dom';

const CustomerOrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  return (
    <div>
      <h1>Customer Order Detail</h1>
      <p>ID: {id}</p>
    </div>
  );
};

export default CustomerOrderDetailPage;
