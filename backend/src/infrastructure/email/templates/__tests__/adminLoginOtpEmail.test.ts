import { buildAdminLoginOtpEmail } from '../adminLoginOtpEmail';

describe('buildAdminLoginOtpEmail', () => {
  it('includes the OTP in subject, text and html', () => {
    const { subject, text, html } = buildAdminLoginOtpEmail('482913');
    expect(subject).toMatch(/Código de acceso admin/i);
    expect(text).toContain('482913');
    expect(html).toContain('482913');
  });
});
