import React from 'react';
import { waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { renderWithI18n } from '../../../test-utils/renderWithI18n';
import AccountPage from '../AccountPage';

jest.mock('../../../contexts/CustomerAuthContext', () => ({
  useCustomerAuth: () => ({ customer: { firstName: 'Ana', lastName: 'García', email: 'ana@example.com' }, logout: jest.fn() }),
}));

describe('AccountPage — noindex coverage', () => {
  it('renders noindex, nofollow via AccountLayout', async () => {
    renderWithI18n(<MemoryRouter><AccountPage /></MemoryRouter>);
    await waitFor(() =>
      expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow')
    );
  });
});
