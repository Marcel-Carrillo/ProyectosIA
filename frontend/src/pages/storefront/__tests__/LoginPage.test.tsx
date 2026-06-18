import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../LoginPage';
import { CustomerAuthProvider } from '../../../contexts/CustomerAuthContext';

jest.mock('../../../services/customerAuthService', () => ({
  customerLogin: jest.fn(),
  customerRefresh: jest.fn().mockRejectedValue(new Error('no session')),
  customerMe: jest.fn(),
  customerLogout: jest.fn(),
  customerRegister: jest.fn(),
  getCustomerAccessToken: jest.fn(),
  setCustomerAccessToken: jest.fn(),
  extractCustomerAuthError: jest.fn().mockReturnValue('Invalid'),
}));

describe('LoginPage', () => {
  it('renders sign in form', () => {
    render(
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
