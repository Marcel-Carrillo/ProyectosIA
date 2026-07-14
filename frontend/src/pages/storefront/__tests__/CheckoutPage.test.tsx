import { vi } from 'vitest';
import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { renderWithI18n } from '../../../test-utils/renderWithI18n';
import { CartProvider } from '../../../contexts/CartContext';

const mockList = vi.fn();
const mockCreate = vi.fn();

vi.mock('../../../services/addressService', () => ({
  addressService: {
    list: (...args: unknown[]) => mockList(...args),
    create: (...args: unknown[]) => mockCreate(...args),
  },
}));

vi.mock('../../../services/paymentService', () => ({
  getStripeConfig: vi.fn().mockResolvedValue({ publishableKey: 'pk_test_123' }),
}));

vi.mock('@stripe/stripe-js', () => ({ loadStripe: vi.fn().mockResolvedValue({}) }));
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

let mockIsAuthenticated = false;
let mockCustomer: { id: number; firstName: string; lastName: string; email: string; phone?: string | null } | null =
  null;

vi.mock('../../../contexts/CustomerAuthContext', () => ({
  useCustomerAuth: () => ({ isAuthenticated: mockIsAuthenticated, customer: mockCustomer }),
}));

// eslint-disable-next-line import/first -- must load after vi.mock() calls above
import CheckoutPage from '../CheckoutPage';

function seedCart() {
  localStorage.setItem(
    'storefront_cart',
    JSON.stringify([{ productVariantId: 1, quantity: 1, productName: 'Dress', publicPrice: '29.99' }])
  );
}

function renderPage() {
  return renderWithI18n(
    <MemoryRouter>
      <CartProvider>
        <CheckoutPage />
      </CartProvider>
    </MemoryRouter>,
    { lng: 'en' }
  );
}

describe('CheckoutPage — prefill', () => {
  beforeEach(() => {
    localStorage.clear();
    seedCart();
    vi.clearAllMocks();
    mockList.mockResolvedValue([]);
  });

  it('prefills shipping and billing from the buyer default addresses', async () => {
    mockIsAuthenticated = true;
    mockCustomer = { id: 1, firstName: 'Ana', lastName: 'García', email: 'ana@example.com', phone: '+34600000000' };
    mockList.mockResolvedValue([
      {
        id: 1,
        type: 'Shipping',
        isDefault: true,
        fullName: 'Ana García',
        phone: '+34600000000',
        streetLine1: 'Calle 1',
        streetLine2: null,
        city: 'Madrid',
        province: 'Madrid',
        postalCode: '28001',
        country: 'Spain',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 2,
        type: 'Billing',
        isDefault: true,
        fullName: 'Ana García SL',
        phone: null,
        streetLine1: 'Calle 2',
        streetLine2: null,
        city: 'Madrid',
        province: 'Madrid',
        postalCode: '28002',
        country: 'Spain',
        createdAt: '',
        updatedAt: '',
      },
    ]);

    renderPage();

    expect(await screen.findByDisplayValue('Calle 1')).toBeInTheDocument();
    expect(await screen.findByDisplayValue('Calle 2')).toBeInTheDocument();
  });

  it('falls back to profile-only prefill when no default address exists', async () => {
    mockIsAuthenticated = true;
    mockCustomer = { id: 1, firstName: 'Ana', lastName: 'García', email: 'ana@example.com', phone: '+34600000000' };
    mockList.mockResolvedValue([]);

    renderPage();

    const nameInputs = await screen.findAllByDisplayValue('Ana García');
    expect(nameInputs.length).toBeGreaterThan(0);
  });

  it('leaves guest forms empty with no server-sourced prefill', async () => {
    mockIsAuthenticated = false;
    mockCustomer = null;

    renderPage();

    await screen.findByText(/shipping address/i);
    expect(mockList).not.toHaveBeenCalled();
  });
});

describe('CheckoutPage — usar mismos datos', () => {
  beforeEach(() => {
    localStorage.clear();
    seedCart();
    vi.clearAllMocks();
    mockIsAuthenticated = false;
    mockCustomer = null;
    mockList.mockResolvedValue([]);
  });

  it('mirrors shipping into billing while enabled and keeps mirroring on further edits', async () => {
    renderPage();

    const shippingStreet = (await screen.findAllByLabelText(/street address/i))[0] as HTMLInputElement;
    fireEvent.change(shippingStreet, { target: { value: 'Gran Via 1' } });

    fireEvent.click(screen.getByTestId('checkbox-same-as-shipping'));
    const billingStreet = screen.getAllByLabelText(/street address/i)[1] as HTMLInputElement;
    expect(billingStreet.value).toBe('Gran Via 1');

    fireEvent.change(shippingStreet, { target: { value: 'Gran Via 2' } });
    expect(billingStreet.value).toBe('Gran Via 2');
  });

  it('disables the billing street field while the toggle is enabled', async () => {
    renderPage();
    await screen.findAllByLabelText(/street address/i);

    fireEvent.click(screen.getByTestId('checkbox-same-as-shipping'));
    const billingStreet = screen.getAllByLabelText(/street address/i)[1] as HTMLInputElement;
    expect(billingStreet).toBeDisabled();
  });
});

describe('CheckoutPage — save as default checkbox visibility', () => {
  beforeEach(() => {
    localStorage.clear();
    seedCart();
    vi.clearAllMocks();
    mockList.mockResolvedValue([]);
  });

  it('shows save-as-default checkboxes for authenticated buyers', async () => {
    mockIsAuthenticated = true;
    mockCustomer = { id: 1, firstName: 'Ana', lastName: 'García', email: 'ana@example.com' };

    renderPage();

    await screen.findByText(/shipping address/i);
    expect(screen.getByTestId('checkbox-save-shipping-default')).toBeInTheDocument();
    expect(screen.getByTestId('checkbox-save-billing-default')).toBeInTheDocument();
  });

  it('does not show save-as-default checkboxes for guest buyers', async () => {
    mockIsAuthenticated = false;
    mockCustomer = null;

    renderPage();

    await screen.findByText(/shipping address/i);
    expect(screen.queryByTestId('checkbox-save-shipping-default')).not.toBeInTheDocument();
    expect(screen.queryByTestId('checkbox-save-billing-default')).not.toBeInTheDocument();
  });
});
