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

export interface PasswordResetEmailContent {
  subject: string;
  text: string;
  html: string;
}

export function buildPasswordResetEmail(
  resetUrl: string,
  logoUrl: string = getMavileIconSrc(),
): PasswordResetEmailContent {
  const safeUrl = escapeHtml(resetUrl);
  const subject = `${BRAND_NAME} — Restablecer contraseña`;

  const text = [
    `${BRAND_NAME}`,
    '',
    'Has solicitado restablecer tu contraseña.',
    '',
    'Abre este enlace para elegir una nueva contraseña (válido durante 1 hora):',
    resetUrl,
    '',
    'Si no has sido tú, puedes ignorar este mensaje. Tu contraseña no cambiará.',
    '',
    `— ${BRAND_NAME}`,
  ].join('\n');

  const body = `
    <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:${COLORS.muted};font-family:${FONT};">
      Cuenta
    </p>
    <h1 style="margin:0 0 20px;font-size:24px;font-weight:500;line-height:1.2;letter-spacing:-0.02em;color:${COLORS.text};font-family:${FONT};">
      Restablecer contraseña
    </h1>
    <p style="margin:0 0 28px;font-size:15px;line-height:1.65;color:${COLORS.muted};font-family:${FONT};">
      Hemos recibido una solicitud para actualizar la contraseña de tu cuenta. Pulsa el botón para continuar de forma segura.
    </p>
    ${renderEmailButton(safeUrl, 'Elegir nueva contraseña')}
    <p style="margin:28px 0 12px;font-size:13px;line-height:1.65;color:${COLORS.muted};font-family:${FONT};">
      El enlace caduca en <strong style="color:${COLORS.text};font-weight:500;">1 hora</strong>.
    </p>
    <p style="margin:0;font-size:13px;line-height:1.65;color:${COLORS.muted};font-family:${FONT};">
      Si no has solicitado este cambio, ignora este correo. Tu contraseña permanecerá igual.
    </p>`;

  const footer = `
    <tr>
      <td style="padding:24px 8px 0;text-align:center;">
        <p style="margin:0 0 8px;font-size:12px;line-height:1.5;color:${COLORS.muted};font-family:${FONT};">
          ¿El botón no funciona? Copia y pega este enlace:
        </p>
        <p style="margin:0;font-size:11px;line-height:1.5;word-break:break-all;font-family:${FONT};">
          <a href="${safeUrl}" style="color:${COLORS.muted};text-decoration:underline;">${safeUrl}</a>
        </p>
      </td>
    </tr>
    ${renderEmailFooter()}`;

  const html = renderEmailShell({
    subject,
    header: renderMavileEmailHeader(logoUrl),
    body,
    footer,
  });

  return { subject, text, html };
}
