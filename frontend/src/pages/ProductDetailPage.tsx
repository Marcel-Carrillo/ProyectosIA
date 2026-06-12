import React from 'react';
import { useParams } from 'react-router-dom';

const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  return (
    <div>
      <h1>Product Detail</h1>
      <p>ID: {id}</p>
    </div>
  );
};

export default ProductDetailPage;
