import { buildWelcomeEmail } from '../welcomeEmail';

describe('buildWelcomeEmail', () => {
  const params = {
    firstName: 'Jane',
    couponCode: 'Bienvenida15',
    percent: 15,
    expiresAt: new Date('2026-07-28T00:00:00.000Z'),
    shopUrl: 'http://localhost:3001',
  };

  it('includes Mavile logo CID reference, firstName, coupon code and shop URL in HTML', () => {
    const { html, subject } = buildWelcomeEmail(params);
    expect(subject).toContain('Mavile');
    expect(html).toContain('cid:mavile-icon');
    expect(html).toContain('Mavile');
    expect(html).toContain('Jane');
    expect(html).toContain('Bienvenida15');
    expect(html).toContain('15');
    expect(html).toContain('http://localhost:3001');
    expect(html).toContain('#faf9f7');
  });

  it('includes coupon code and percent in plain-text fallback', () => {
    const { text } = buildWelcomeEmail(params);
    expect(text).toContain('Jane');
    expect(text).toContain('Bienvenida15');
    expect(text).toContain('15');
    expect(text).toContain('http://localhost:3001');
  });

  it('escapes HTML in firstName and couponCode', () => {
    const malicious = {
      ...params,
      firstName: '<script>alert(1)</script>',
      couponCode: 'Bienvenida<script>',
    };
    const { html } = buildWelcomeEmail(malicious);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
