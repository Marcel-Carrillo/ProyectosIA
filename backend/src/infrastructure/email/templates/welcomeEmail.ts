import {
  BRAND_NAME,
  COLORS,
  escapeHtml,
  FONT,
  getMavileIconSrc,
  renderEmailButton,
  renderEmailFooter,
  renderEmailShell,
  renderMavileEmailHeader,
} from './emailBranding';

export interface WelcomeEmailContent {
  subject: string;
  text: string;
  html: string;
}

export function buildWelcomeEmail(params: {
  firstName: string;
  couponCode: string;
  percent: number;
  expiresAt: Date | null;
  shopUrl: string;
  logoUrl?: string;
}): WelcomeEmailContent {
  const {
    firstName,
    couponCode,
    percent,
    expiresAt,
    shopUrl,
    logoUrl = getMavileIconSrc(),
  } = params;

  const safeName = escapeHtml(firstName);
  const safeCode = escapeHtml(couponCode);
  const safeUrl = escapeHtml(shopUrl);
  const expiryLine = expiresAt
    ? expiresAt.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  const subject = `${BRAND_NAME} — Bienvenida`;

  const text = [
    `${BRAND_NAME}`,
    '',
    `¡Hola, ${firstName}!`,
    '',
    `Tu cupón de bienvenida — ${percent}% de descuento en tu primera compra:`,
    '',
    couponCode,
    '',
    expiryLine
      ? `Válido hasta el ${expiryLine}. Un solo uso por cuenta.`
      : 'Un solo uso por cuenta.',
    '',
    'Empieza a explorar nuestra colección:',
    shopUrl,
    '',
    `— ${BRAND_NAME}`,
  ].join('\n');

  const expiryHtml = expiryLine
    ? `${percent}% de descuento — válido hasta el ${expiryLine} · Un solo uso por cuenta`
    : `${percent}% de descuento · Un solo uso por cuenta`;

  const body = `
    <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:${COLORS.muted};font-family:${FONT};">
      Bienvenida
    </p>
    <h1 style="margin:0 0 20px;font-size:24px;font-weight:500;line-height:1.2;letter-spacing:-0.02em;color:${COLORS.text};font-family:${FONT};">
      Tu regalo de bienvenida
    </h1>
    <p style="margin:0 0 28px;font-size:15px;line-height:1.65;color:${COLORS.muted};font-family:${FONT};">
      ¡Hola, <strong style="color:${COLORS.text};font-weight:500;">${safeName}</strong>! Nos alegra tenerte aquí. Este cupón es para tu primera compra.
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 12px;">
      <tr>
        <td style="background-color:${COLORS.offWhite};border:1px solid ${COLORS.border};border-radius:2px;padding:24px 20px;text-align:center;">
          <p style="margin:0 0 8px;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:${COLORS.muted};font-family:${FONT};">
            Código
          </p>
          <span style="font-size:26px;font-weight:600;letter-spacing:0.16em;color:${COLORS.navy};font-family:${FONT};">
            ${safeCode}
          </span>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 32px;font-size:13px;line-height:1.6;color:${COLORS.muted};text-align:center;font-family:${FONT};">
      ${expiryHtml}
    </p>
    ${renderEmailButton(safeUrl, 'Ir a la tienda')}
    <p style="margin:28px 0 0;font-size:13px;line-height:1.65;color:${COLORS.muted};font-family:${FONT};">
      Introduce el código en el carrito antes de pagar. Disponible para todos los nuevos registros, con un solo uso por cuenta.
    </p>`;

  const html = renderEmailShell({
    subject,
    header: renderMavileEmailHeader(logoUrl),
    body,
    footer: renderEmailFooter(),
  });

  return { subject, text, html };
}
