import React from 'react';
import { render, screen } from '@testing-library/react';
import PriceTag from './PriceTag';

describe('PriceTag', () => {
  it('renders only publicPrice when no compareAtPrice', () => {
    const { container } = render(<PriceTag publicPrice={49.99} />);
    expect(screen.getByText(/49/)).toBeInTheDocument();
    expect(container.querySelector('.storefront-price__original')).toBeNull();
    expect(container.querySelector('.storefront-price__sale')).toBeNull();
  });

  it('renders both prices with strikethrough when compareAtPrice > publicPrice', () => {
    const { container } = render(
      <PriceTag publicPrice={39.99} compareAtPrice={59.99} />
    );
    expect(container.querySelector('.storefront-price__original')).toBeInTheDocument();
    expect(container.querySelector('.storefront-price__sale')).toBeInTheDocument();
  });

  it('does not show sale price when compareAtPrice <= publicPrice', () => {
    const { container } = render(
      <PriceTag publicPrice={59.99} compareAtPrice={49.99} />
    );
    expect(container.querySelector('.storefront-price__original')).toBeNull();
  });

  it('never renders supplier fields', () => {
    const { container } = render(<PriceTag publicPrice={49.99} compareAtPrice={59.99} />);
    const html = container.innerHTML;
    expect(html).not.toContain('supplierId');
    expect(html).not.toContain('supplierReference');
    expect(html).not.toContain('supplierCost');
  });
});
