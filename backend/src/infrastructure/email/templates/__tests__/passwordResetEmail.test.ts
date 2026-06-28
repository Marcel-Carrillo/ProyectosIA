import { buildPasswordResetEmail } from '../passwordResetEmail';

describe('buildPasswordResetEmail', () => {
  const resetUrl = 'http://localhost:3001/reset-password?token=abc123';

  it('includes embedded Mavile logo and reset link in HTML', () => {
    const { html, subject } = buildPasswordResetEmail(resetUrl);
    expect(subject).toContain('Mavile');
    expect(html).toContain('data:image/png;base64,');
    expect(html).toContain('Mavile');
    expect(html).toContain('Restablecer contraseña');
    expect(html).toContain(resetUrl);
    expect(html).toContain('Elegir nueva contraseña');
    expect(html).toContain('#faf9f7');
  });

  it('includes plain-text fallback with reset URL', () => {
    const { text } = buildPasswordResetEmail(resetUrl);
    expect(text).toContain('Mavile');
    expect(text).toContain(resetUrl);
    expect(text).toContain('1 hora');
  });

  it('escapes HTML in the reset URL', () => {
    const malicious = 'http://x.test/reset?token=<script>alert(1)</script>';
    const { html } = buildPasswordResetEmail(malicious);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
