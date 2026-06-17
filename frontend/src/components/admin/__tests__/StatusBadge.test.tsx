import React from 'react';
import { render, screen } from '@testing-library/react';
import StatusBadge from '../StatusBadge';

describe('StatusBadge', () => {
  it.each([
    ['Draft', 'bg-secondary'],
    ['Active', 'bg-success'],
    ['Inactive', 'bg-warning'],
    ['Archived', 'bg-dark'],
    ['Blocked', 'bg-danger'],
  ] as const)('renders %s with the %s variant', (status, cssClass) => {
    render(<StatusBadge status={status} data-testid="badge" />);
    const badge = screen.getByTestId('badge');
    expect(badge).toHaveTextContent(status);
    expect(badge).toHaveClass(cssClass);
  });
});
