import { vi } from 'vitest';
import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { renderWithI18n } from '../../../test-utils/renderWithI18n';
import LoginPage from '../LoginPage';
import { CustomerAuthProvider } from '../../../contexts/CustomerAuthContext';

vi.mock('../../../services/customerAuthService', () => ({
  customerLogin: vi.fn(),
  customerRefresh: vi.fn().mockRejectedValue(new Error('no session')),
  customerMe: vi.fn(),
  customerLogout: vi.fn(),
  customerRegister: vi.fn(),
  getCustomerAccessToken: vi.fn(),
  setCustomerAccessToken: vi.fn(),
  extractCustomerAuthError: vi.fn().mockReturnValue('Invalid'),
}));

describe('LoginPage', () => {
  it('renders sign in form', () => {
    renderWithI18n(
      <CustomerAuthProvider>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </CustomerAuthProvider>
    );
    expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'a@test.com' } });
    expect(screen.getByDisplayValue('a@test.com')).toBeInTheDocument();
  });
});
