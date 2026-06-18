import React, { useEffect, useState } from 'react';
import { Button, Stack } from 'react-bootstrap';

const API_BASE = process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:3000';

type OAuthProviders = {
  google: boolean;
  apple: boolean;
  facebook: boolean;
};

const defaultProviders: OAuthProviders = {
  google: false,
  apple: false,
  facebook: false,
};

const OAuthButtons: React.FC = () => {
  const [providers, setProviders] = useState<OAuthProviders>(defaultProviders);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/public/auth/oauth/providers`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!cancelled && body?.data) {
          setProviders(body.data as OAuthProviders);
        }
      })
      .catch(() => {
        // keep buttons hidden when API is unavailable
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const anyEnabled = providers.google || providers.apple || providers.facebook;
  if (!anyEnabled) {
    return null;
  }

  return (
    <Stack gap={2} className="mt-3">
      {providers.google && (
        <Button
          variant="outline-dark"
          size="sm"
          onClick={() => { window.location.href = `${API_BASE}/api/public/auth/google`; }}
        >
          Continue with Google
        </Button>
      )}
      {providers.apple && (
        <Button
          variant="outline-dark"
          size="sm"
          onClick={() => { window.location.href = `${API_BASE}/api/public/auth/apple`; }}
        >
          Continue with Apple
        </Button>
      )}
      {providers.facebook && (
        <Button
          variant="outline-dark"
          size="sm"
          onClick={() => { window.location.href = `${API_BASE}/api/public/auth/facebook`; }}
        >
          Continue with Facebook
        </Button>
      )}
    </Stack>
  );
};

export default OAuthButtons;
