import React from 'react';
import { screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { renderWithI18n } from '../../../test-utils/renderWithI18n';
import CartPage from '../CartPage';
import { CartProvider } from '../../../contexts/CartContext';

describe('CartPage', () => {
  it('shows empty cart message', () => {
    renderWithI18n(
      <CartProvider>
        <MemoryRouter>
          <CartPage />
        </MemoryRouter>
      </CartProvider>
    );
    expect(screen.getByText(/cart is empty/i)).toBeInTheDocument();
  });
});
