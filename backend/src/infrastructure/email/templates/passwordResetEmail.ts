const BRAND_NAME = 'Mavile';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface PasswordResetEmailContent {
  subject: string;
  text: string;
  html: string;
}

export function buildPasswordResetEmail(resetUrl: string): PasswordResetEmailContent {
  const safeUrl = escapeHtml(resetUrl);
  const subject = `${BRAND_NAME} — Restablecer contraseña`;

  const text = [
    `${BRAND_NAME}`,
    '',
    'Has solicitado restablecer tu contraseña.',
    '',
    `Abre este enlace para elegir una nueva contraseña (válido durante 1 hora):`,
    resetUrl,
    '',
    'Si no has sido tú, puedes ignorar este mensaje. Tu contraseña no cambiará.',
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
              <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#6b6a66;">Cuenta</p>
              <h1 style="margin:0 0 20px;font-size:26px;font-weight:500;line-height:1.15;letter-spacing:-0.02em;color:#1a1a18;">Restablecer contraseña</h1>
              <p style="margin:0 0 28px;font-size:15px;line-height:1.65;color:#6b6a66;">
                Hemos recibido una solicitud para actualizar la contraseña de tu cuenta. Pulsa el botón para continuar.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 28px;">
                <tr>
                  <td style="background-color:#1a1a18;border-radius:2px;">
                    <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;font-size:13px;font-weight:500;letter-spacing:0.06em;text-transform:uppercase;text-decoration:none;color:#ffffff;">
                      Elegir nueva contraseña
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:#6b6a66;">
                El enlace caduca en <strong style="color:#1a1a18;font-weight:500;">1 hora</strong>.
              </p>
              <p style="margin:0;font-size:13px;line-height:1.6;color:#6b6a66;">
                Si no has solicitado este cambio, ignora este correo. Tu contraseña permanecerá igual.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 8px 0;text-align:center;">
              <p style="margin:0 0 8px;font-size:12px;line-height:1.5;color:#6b6a66;">
                ¿El botón no funciona? Copia y pega este enlace en tu navegador:
              </p>
              <p style="margin:0;font-size:11px;line-height:1.5;word-break:break-all;">
                <a href="${safeUrl}" style="color:#6b6a66;text-decoration:underline;">${safeUrl}</a>
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
