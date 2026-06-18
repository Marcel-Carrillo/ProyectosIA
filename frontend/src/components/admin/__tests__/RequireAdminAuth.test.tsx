import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RequireAdminAuth from '../RequireAdminAuth';
import { AdminAuthProvider } from '../../../contexts/AdminAuthContext';

jest.mock('../../../services/adminAuthService', () => ({
  adminRefresh: jest.fn().mockRejectedValue(new Error('no session')),
  adminMe: jest.fn(),
  adminLogin: jest.fn(),
  adminLogout: jest.fn(),
  getAdminAccessToken: jest.fn().mockReturnValue(null),
  setAdminAccessToken: jest.fn(),
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
