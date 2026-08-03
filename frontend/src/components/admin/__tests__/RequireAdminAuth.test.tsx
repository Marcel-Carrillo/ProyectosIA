import { vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RequireAdminAuth from '../RequireAdminAuth';
import { AdminAuthProvider } from '../../../contexts/AdminAuthContext';

vi.mock('../../../services/adminAuthService', () => ({
  adminRefresh: vi.fn().mockRejectedValue(new Error('no session')),
  adminMe: vi.fn(),
  adminLogin: vi.fn(),
  adminVerify2fa: vi.fn(),
  adminLogout: vi.fn(),
  getAdminAccessToken: vi.fn().mockReturnValue(null),
  setAdminAccessToken: vi.fn(),
}));

const Protected = () => <div>Protected content</div>;

describe('RequireAdminAuth', () => {
  it('redirects unauthenticated users to /admin/login', async () => {
    render(
      <AdminAuthProvider>
        <MemoryRouter initialEntries={['/customers']}>
          <Routes>
            <Route
              path="/customers"
              element={
                <RequireAdminAuth>
                  <Protected />
                </RequireAdminAuth>
              }
            />
            <Route path="/admin/login" element={<div>Login page</div>} />
          </Routes>
        </MemoryRouter>
      </AdminAuthProvider>
    );
    expect(await screen.findByText('Login page')).toBeInTheDocument();
  });
});
