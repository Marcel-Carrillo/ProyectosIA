import React from 'react';
import { Button, Stack } from 'react-bootstrap';

const API_BASE = process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:3000';

const OAuthButtons: React.FC = () => {
  return (
    <Stack gap={2} className="mt-3">
      <Button
        variant="outline-dark"
        size="sm"
        onClick={() => { window.location.href = `${API_BASE}/api/public/auth/google`; }}
      >
        Continue with Google
      </Button>
      <Button variant="outline-secondary" size="sm" disabled title="Configure Apple credentials in production">
        Continue with Apple
      </Button>
      <Button variant="outline-secondary" size="sm" disabled title="Configure Facebook credentials in production">
        Continue with Facebook
      </Button>
    </Stack>
  );
};

export default OAuthButtons;
