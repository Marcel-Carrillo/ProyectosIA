import React from 'react';
import { Link } from 'react-router-dom';

const NotFoundPage: React.FC = () => {
  return (
    <div>
      <h1>404 — Página no encontrada</h1>
      <p>La página que busca no existe.</p>
      <Link to="/products">Volver a productos</Link>
    </div>
  );
};

export default NotFoundPage;
