import {
  BRAND_NAME,
  COLORS,
  escapeHtml,
  FONT,
  getMavileIconSrc,
  renderEmailFooter,
  renderEmailShell,
  renderMavileEmailHeader,
} from './emailBranding';

export interface AdminLoginOtpEmailContent {
  subject: string;
  text: string;
  html: string;
}

export function buildAdminLoginOtpEmail(
  code: string,
  logoUrl: string = getMavileIconSrc(),
): AdminLoginOtpEmailContent {
  const safeCode = escapeHtml(code);
  const subject = `${BRAND_NAME} — Código de acceso admin`;

  const text = [
    `${BRAND_NAME}`,
    '',
    'Tu código de verificación para el panel de administración es:',
    '',
    code,
    '',
    'Caduca en 10 minutos. Si no has iniciado sesión, ignora este mensaje.',
    '',
    `— ${BRAND_NAME}`,
  ].join('\n');

  const body = `
    <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:${COLORS.muted};font-family:${FONT};">
      Administración
    </p>
    <h1 style="margin:0 0 20px;font-size:24px;font-weight:500;line-height:1.2;letter-spacing:-0.02em;color:${COLORS.text};font-family:${FONT};">
      Código de acceso
    </h1>
    <p style="margin:0 0 28px;font-size:15px;line-height:1.65;color:${COLORS.muted};font-family:${FONT};">
      Usa este código para completar el inicio de sesión en el panel de administración.
    </p>
    <p style="margin:0 0 28px;text-align:center;font-size:32px;font-weight:600;letter-spacing:0.35em;color:${COLORS.text};font-family:${FONT};">
      ${safeCode}
    </p>
    <p style="margin:0;font-size:13px;line-height:1.65;color:${COLORS.muted};font-family:${FONT};">
      El código caduca en <strong style="color:${COLORS.text};font-weight:500;">10 minutos</strong>.
      Si no has solicitado acceso, ignora este correo.
    </p>`;

  const html = renderEmailShell({
    subject,
    header: renderMavileEmailHeader(logoUrl),
    body,
    footer: renderEmailFooter(),
  });

  return { subject, text, html };
}
