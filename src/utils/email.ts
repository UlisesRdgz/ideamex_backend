/**
 * @file Utilidad para enviar correos electrónicos.
 * Contiene funciones para enviar correos relacionados con la autenticación de usuarios.
 *
 * Todos los mensajes van en inglés, igual que las respuestas de la API: IDEAMEX
 * lo usan grupos de investigación de distintos países y un solo idioma evita
 * mantener catálogos paralelos.
 *
 * @module utils/email
 * @requires nodemailer
 * @requires ../config/email
 *
 * @author Ulises Rodríguez García
 */

import { emailTransporter } from '../config/email';
import {
  buildEmailShell,
  buildLogoAttachment,
  buildSender,
  COLORS,
  EMAIL_FOOTER,
  escapeHTML,
} from './emailLayout';

/** Base pública del frontend a la que apuntan los enlaces de los correos. */
const FRONTEND_BASE_URL = 'https://iauusmb.ibt.unam.mx/ideamex2';

/** Textos de un correo transaccional con enlace de un solo uso. */
interface EmailCopy {
  subject: string;
  preheader: string;
  /** Titular: enuncia la acción, no saluda, porque compite con el asunto en la bandeja. */
  title: string;
  body: string;
  button: string;
  expiry: string;
  ignore: string;
}

/**
 * Textos del correo de activación de cuenta.
 */
const ACTIVATION_COPY: EmailCopy = {
  subject: 'Activate your IDEAMEX account',
  preheader: 'Confirm your email address to start using IDEAMEX.',
  title: 'Activate your account',
  body: 'Welcome to IDEAMEX. Confirm your email address to start using the platform.',
  button: 'Activate account',
  expiry: 'This link expires in 24 hours.',
  ignore: "If you didn't create this account, you can ignore this message.",
};

/**
 * Textos del correo de restablecimiento de contraseña.
 */
const PASSWORD_RESET_COPY: EmailCopy = {
  subject: 'Reset your IDEAMEX password',
  preheader: 'You asked to change your IDEAMEX password.',
  title: 'Reset your password',
  body: 'You asked to change your password. Choose a new one using the button below.',
  button: 'Reset password',
  expiry: 'This link expires in 1 hour.',
  ignore:
    "If you didn't request this change, you can ignore this message: your password won't change.",
};

/**
 * Compone el contenido de un correo transaccional con botón de acción.
 *
 * @param copy - Textos del mensaje.
 * @param actionLink - Enlace de un solo uso al que apunta el botón.
 * @returns Fragmento HTML sin encabezado ni pie.
 */
const buildTransactionalContent = (copy: EmailCopy, actionLink: string): string => {
  // El token viaja dentro del enlace y termina interpolado en el HTML, así que se
  // escapa por principio aunque hoy solo contenga caracteres hexadecimales.
  const safeLink = escapeHTML(actionLink);

  return `              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="left" style="padding:28px 40px 0 40px;">
                    <p style="margin:0;font-size:26px;line-height:34px;font-weight:bold;color:${COLORS.brand};">${copy.title}</p>
                  </td>
                </tr>
                <tr>
                  <td align="left" style="padding:14px 40px 0 40px;">
                    <p style="margin:0;font-size:16px;line-height:26px;color:${COLORS.bodyText};">${copy.body}</p>
                  </td>
                </tr>
                <tr>
                  <td align="left" style="padding:28px 40px 0 40px;">
                    <a href="${safeLink}"
                       style="display:inline-block;padding:14px 30px;background-color:${COLORS.brand};color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;border-radius:8px;">${copy.button}</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px 40px 0 40px;">
                    <div style="height:1px;background-color:${COLORS.border};font-size:0;line-height:0;">&nbsp;</div>
                  </td>
                </tr>
                <tr>
                  <td align="left" style="padding:18px 40px 32px 40px;">
                    <p style="margin:0;font-size:13px;line-height:20px;color:${COLORS.mutedText};">${copy.expiry} ${copy.ignore}</p>
                  </td>
                </tr>
              </table>`;
};

/**
 * Versión en texto plano del mensaje.
 *
 * Se envía junto al HTML para los clientes que no lo muestran y porque un correo
 * con ambas partes puntúa mejor en los filtros de spam. Aquí sí aparece el
 * enlace completo: en texto plano no hay botón sobre el que pulsar.
 */
const buildTransactionalText = (copy: EmailCopy, actionLink: string): string =>
  [
    copy.title,
    '',
    copy.body,
    actionLink,
    '',
    `${copy.expiry} ${copy.ignore}`,
    '',
    EMAIL_FOOTER,
  ].join('\n');

/**
 * Envía un correo transaccional con botón de acción.
 *
 * @param params.email - Destinatario.
 * @param params.copy - Textos del mensaje.
 * @param params.actionLink - Enlace de un solo uso.
 */
const sendTransactionalEmail = async (params: {
  email: string;
  copy: EmailCopy;
  actionLink: string;
}): Promise<void> => {
  await emailTransporter.sendMail({
    from: buildSender(),
    to: params.email,
    subject: params.copy.subject,
    text: buildTransactionalText(params.copy, params.actionLink),
    html: buildEmailShell({
      title: params.copy.subject,
      preheader: params.copy.preheader,
      contentHTML: buildTransactionalContent(params.copy, params.actionLink),
    }),
    attachments: [buildLogoAttachment()],
  });
};

/**
 * Envía un correo de activación al usuario con un enlace para activar su cuenta.
 *
 * @async
 * @function sendActivationEmail
 * @param email - Dirección de correo electrónico del destinatario.
 * @param token - Token de activación único.
 * @throws Error si ocurre un problema al enviar el correo.
 */
export const sendActivationEmail = async (email: string, token: string): Promise<void> => {
  // Link orientado al frontend público, no al endpoint API interno.
  await sendTransactionalEmail({
    email,
    copy: ACTIVATION_COPY,
    actionLink: `${FRONTEND_BASE_URL}/auth/activate?token=${encodeURIComponent(token)}`,
  });
};

/**
 * Envía un correo electrónico para restablecer la contraseña con un token único.
 *
 * @async
 * @function sendPasswordResetEmail
 * @param email - Dirección de correo electrónico del usuario.
 * @param token - Token generado para el restablecimiento de contraseña.
 * @throws Error si ocurre un problema al enviar el correo.
 */
export const sendPasswordResetEmail = async (email: string, token: string): Promise<void> => {
  // Token via query param para que el frontend renderice formulario de cambio de contraseña.
  await sendTransactionalEmail({
    email,
    copy: PASSWORD_RESET_COPY,
    actionLink: `${FRONTEND_BASE_URL}/auth/reset-password?token=${encodeURIComponent(token)}`,
  });
};
