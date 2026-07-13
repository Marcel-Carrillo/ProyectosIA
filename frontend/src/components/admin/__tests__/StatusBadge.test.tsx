import React from 'react';
import { render, screen } from '@testing-library/react';
import StatusBadge from '../StatusBadge';

describe('StatusBadge', () => {
  it.each([
    ['Draft', 'Borrador', 'bg-secondary'],
    ['Active', 'Activo', 'bg-success'],
    ['Inactive', 'Inactivo', 'bg-warning'],
    ['Archived', 'Archivado', 'bg-dark'],
    ['Blocked', 'Bloqueado', 'bg-danger'],
  ] as const)('renders %s as %s with the %s variant', (status, label, cssClass) => {
    render(<StatusBadge status={status} data-testid="badge" />);
    const badge = screen.getByTestId('badge');
    expect(badge).toHaveTextContent(label);
    expect(badge).toHaveClass(cssClass);
  });
});
