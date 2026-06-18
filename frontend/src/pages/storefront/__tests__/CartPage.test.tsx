import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CartPage from '../CartPage';
import { CartProvider } from '../../../contexts/CartContext';

describe('CartPage', () => {
  it('shows empty cart message', () => {
    render(
      <CartProvider>
        <MemoryRouter>
          <CartPage />
        </MemoryRouter>
      </CartProvider>
    );
    expect(screen.getByText(/cart is empty/i)).toBeInTheDocument();
  });
});
