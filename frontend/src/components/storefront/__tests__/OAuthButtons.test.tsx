import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import OAuthButtons from '../OAuthButtons';
import { renderWithI18n } from '../../../test-utils/renderWithI18n';

describe('OAuthButtons', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a Google icon button instead of long text when Google is enabled', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { google: true, apple: false, facebook: false } }),
      }),
    );

    renderWithI18n(<OAuthButtons />, { lng: 'es' });

    const btn = await screen.findByTestId('oauth-google');
    expect(btn).toHaveAttribute('aria-label', 'Continuar con Google');
    expect(btn.querySelector('svg')).toBeTruthy();
    expect(screen.queryByText('Continuar con Google')).not.toBeInTheDocument();
  });

  it('renders nothing when no providers are enabled', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { google: false, apple: false, facebook: false } }),
      }),
    );

    const { container } = renderWithI18n(<OAuthButtons />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
