import { buildWelcomeEmail } from '../welcomeEmail';

describe('buildWelcomeEmail', () => {
  const params = {
    firstName: 'Jane',
    couponCode: 'WELCOME-ABCDEF1234567890ABCDEF1234567890AB',
    percent: 15,
    expiresAt: new Date('2026-07-28T00:00:00.000Z'),
    shopUrl: 'http://localhost:3001',
  };

  it('includes Mavile branding, firstName, coupon code and shop URL in HTML', () => {
    const { html, subject } = buildWelcomeEmail(params);
    expect(subject).toContain('Mavile');
    expect(html).toContain('Jane');
    expect(html).toContain('WELCOME-ABCDEF1234567890ABCDEF1234567890AB');
    expect(html).toContain('15');
    expect(html).toContain('http://localhost:3001');
    expect(html).toContain('#faf9f7');
    expect(html).toContain('#d4a853');
  });

  it('includes coupon code and percent in plain-text fallback', () => {
    const { text } = buildWelcomeEmail(params);
    expect(text).toContain('Jane');
    expect(text).toContain('WELCOME-ABCDEF1234567890ABCDEF1234567890AB');
    expect(text).toContain('15');
    expect(text).toContain('http://localhost:3001');
  });

  it('escapes HTML in firstName and couponCode', () => {
    const malicious = {
      ...params,
      firstName: '<script>alert(1)</script>',
      couponCode: 'WELCOME-<b>BAD</b>',
    };
    const { html } = buildWelcomeEmail(malicious);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<b>BAD</b>');
    expect(html).toContain('&lt;b&gt;BAD&lt;/b&gt;');
  });
});
