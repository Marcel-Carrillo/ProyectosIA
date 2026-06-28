const BRAND_NAME = 'Mavile';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface WelcomeEmailContent {
  subject: string;
  text: string;
  html: string;
}

export function buildWelcomeEmail(params: {
  firstName: string;
  couponCode: string;
  percent: number;
  expiresAt: Date;
  shopUrl: string;
}): WelcomeEmailContent {
  const { firstName, couponCode, percent, expiresAt, shopUrl } = params;

  const safeName = escapeHtml(firstName);
  const safeCode = escapeHtml(couponCode);
  const safeUrl = escapeHtml(shopUrl);
  const formattedExpiry = expiresAt.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const subject = `${BRAND_NAME} — Bienvenida a Mavile`;

  const text = [
    `${BRAND_NAME}`,
    '',
    `¡Hola, ${firstName}!`,
    '',
    `Como regalo de bienvenida, hemos creado un cupón exclusivo de ${percent}% de descuento para tu primera compra:`,
    '',
    `${couponCode}`,
    '',
    `El cupón es válido hasta el ${formattedExpiry} y tiene un solo uso.`,
    '',
    'Empieza a explorar nuestra colección:',
    shopUrl,
    '',
    `— ${BRAND_NAME}`,
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#faf9f7;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a18;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#faf9f7;padding:48px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;">
          <tr>
            <td style="padding-bottom:32px;text-align:center;">
              <span style="font-size:11px;letter-spacing:0.28em;text-transform:uppercase;color:#6b6a66;">${BRAND_NAME}</span>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;border:1px solid #e8e6e2;padding:40px 32px;">
              <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#6b6a66;">Bienvenida</p>
              <h1 style="margin:0 0 20px;font-size:26px;font-weight:500;line-height:1.15;letter-spacing:-0.02em;color:#1a1a18;">Tu regalo de bienvenida</h1>
              <p style="margin:0 0 28px;font-size:15px;line-height:1.65;color:#6b6a66;">
                ¡Hola, <strong style="color:#1a1a18;font-weight:500;">${safeName}</strong>! Nos alegra tenerte aquí. Como bienvenida, te regalamos un cupón exclusivo para tu primera compra.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 12px;">
                <tr>
                  <td style="background-color:#d4a853;border-radius:2px;padding:20px;text-align:center;">
                    <span style="font-size:22px;font-weight:600;letter-spacing:0.12em;color:#1a1a18;">${safeCode}</span>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 28px;font-size:13px;line-height:1.6;color:#6b6a66;text-align:center;">
                <strong style="color:#1a1a18;font-weight:500;">${percent}% de descuento</strong> — válido hasta el ${formattedExpiry} · Un solo uso
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 28px;">
                <tr>
                  <td style="background-color:#1a1a18;border-radius:2px;">
                    <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;font-size:13px;font-weight:500;letter-spacing:0.06em;text-transform:uppercase;text-decoration:none;color:#ffffff;">
                      Ir a la tienda
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:13px;line-height:1.6;color:#6b6a66;">
                Aplica el código en el carrito antes de finalizar tu compra. El cupón es de un solo uso y caduca en 30 días.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 8px 0;text-align:center;">
              <p style="margin:0;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#6b6a66;">
                © ${new Date().getFullYear()} ${BRAND_NAME}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}
