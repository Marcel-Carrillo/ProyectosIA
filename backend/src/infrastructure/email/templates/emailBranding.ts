const BRAND_NAME = 'Mavile';

/** Mavile storefront palette */
const COLORS = {
  background: '#faf9f7',
  surface: '#ffffff',
  border: '#e8e6e2',
  offWhite: '#f5f4f1',
  text: '#1a1a18',
  muted: '#6b6a66',
  navy: '#0D1B2A',
  beige: '#D8C7B3',
} as const;

const FONT =
  "Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** CID reference for nodemailer inline attachment (works in Gmail, Outlook, Apple Mail). */
export function getMavileIconSrc(): string {
  return 'cid:mavile-icon';
}

/** @deprecated Use getMavileIconSrc */
export function getMavileIconUrl(): string {
  return getMavileIconSrc();
}

/** @deprecated Use getMavileIconSrc */
export function getMavileLogoUrl(): string {
  return getMavileIconSrc();
}

export function renderMavileEmailHeader(iconSrc: string = getMavileIconSrc()): string {
  return `
    <tr>
      <td style="padding:8px 0 36px;text-align:center;">
        <img src="${iconSrc}" width="48" height="44" alt="${BRAND_NAME}" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;" />
        <p style="margin:14px 0 0;font-size:17px;font-weight:400;letter-spacing:0.18em;text-transform:uppercase;color:${COLORS.navy};font-family:${FONT};">
          ${BRAND_NAME}
        </p>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:12px auto 0;">
          <tr>
            <td style="width:40px;height:1px;background-color:${COLORS.beige};font-size:0;line-height:0;">&nbsp;</td>
          </tr>
        </table>
      </td>
    </tr>`;
}

export function renderEmailButton(href: string, label: string): string {
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto;">
      <tr>
        <td style="background-color:${COLORS.text};border-radius:2px;">
          <a href="${safeHref}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 32px;font-size:12px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;text-decoration:none;color:#ffffff;font-family:${FONT};">
            ${safeLabel}
          </a>
        </td>
      </tr>
    </table>`;
}

export function renderEmailShell(params: {
  subject: string;
  header?: string;
  body: string;
  footer?: string;
}): string {
  const { subject, header = renderMavileEmailHeader(), body, footer = '' } = params;
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:${COLORS.background};font-family:${FONT};color:${COLORS.text};-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${COLORS.background};padding:48px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;">
          ${header}
          <tr>
            <td style="background-color:${COLORS.surface};border:1px solid ${COLORS.border};padding:40px 36px;">
              ${body}
            </td>
          </tr>
          ${footer}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderEmailFooter(): string {
  return `
    <tr>
      <td style="padding:28px 8px 0;text-align:center;">
        <p style="margin:0;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${COLORS.muted};font-family:${FONT};">
          © ${new Date().getFullYear()} ${BRAND_NAME}
        </p>
      </td>
    </tr>`;
}

export { BRAND_NAME, COLORS, escapeHtml, FONT };
