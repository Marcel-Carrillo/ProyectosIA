import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import { renderWithI18n } from '../../../test-utils/renderWithI18n';
import AdminLoginPage from '../AdminLoginPage';

const mockLogin = vi.fn();
const mockVerify2fa = vi.fn();

vi.mock('../../../contexts/AdminAuthContext', () => ({
  useAdminAuth: () => ({
    login: mockLogin,
    verify2fa: mockVerify2fa,
    admin: null,
    isLoading: false,
    isAuthenticated: false,
    logout: vi.fn(),
  }),
}));

function renderPage() {
  return renderWithI18n(
    <MemoryRouter initialEntries={['/admin/login']}>
      <Routes>
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/products" element={<div>products home</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdminLoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows OTP step after login returns mfaRequired', async () => {
    mockLogin.mockResolvedValue({ mfaRequired: true, mfaToken: 'mfa-token' });
    renderPage();

    fireEvent.change(screen.getByTestId('input-admin-email'), {
      target: { value: 'admin@example.com' },
    });
    fireEvent.change(screen.getByTestId('input-admin-password'), {
      target: { value: 'AdminPass1' },
    });
    fireEvent.submit(screen.getByTestId('admin-login-form'));

    expect(await screen.findByTestId('admin-otp-form')).toBeInTheDocument();
    expect(screen.getByTestId('input-admin-otp')).toBeInTheDocument();
  });

  it('verifies OTP and navigates to products', async () => {
    mockLogin.mockResolvedValue({ mfaRequired: true, mfaToken: 'mfa-token' });
    mockVerify2fa.mockResolvedValue(undefined);
    renderPage();

    fireEvent.change(screen.getByTestId('input-admin-email'), {
      target: { value: 'admin@example.com' },
    });
    fireEvent.change(screen.getByTestId('input-admin-password'), {
      target: { value: 'AdminPass1' },
    });
    fireEvent.submit(screen.getByTestId('admin-login-form'));
    await screen.findByTestId('admin-otp-form');

    fireEvent.change(screen.getByTestId('input-admin-otp'), { target: { value: '123456' } });
    fireEvent.submit(screen.getByTestId('admin-otp-form'));

    await waitFor(() => {
      expect(mockVerify2fa).toHaveBeenCalledWith('mfa-token', '123456');
    });
    expect(await screen.findByText('products home')).toBeInTheDocument();
  });
});
