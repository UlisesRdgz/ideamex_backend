/**
 * @file Servicio de contacto.
 * Encapsula la lógica de base de datos y envío de correo de solicitudes de contacto.
 * 
 * @module api/contact/contact.service
 * @requires ../../config/db
 * @requires ../../config/email
 * @requires ../../models/ContactRequest
 * 
 * @author Ulises Rodríguez García
 */

import { pool } from '../../config/db';
import { emailTransporter } from '../../config/email';
import {
  buildEmailShell,
  buildLogoAttachment,
  buildSender,
  COLORS,
  EMAIL_FOOTER,
  escapeHTML,
} from '../../utils/emailLayout';
import { ContactRequest } from '../../models/ContactRequest';

/**
 * Guarda la solicitud de contacto en la base de datos.
 * 
 * @async
 * @function saveContactRequest
 * @param request - Objeto de solicitud de contacto (sin id ni fecha).
 */
export const saveContactRequest = async (
  request: Omit<ContactRequest, 'id_contact_request' | 'created_at'>
): Promise<void> => {
  const conn = await pool.getConnection();
  // Inserta solicitud de contacto para trazabilidad y seguimiento interno.
  const query = `
    INSERT INTO contact_requests (full_name, email, phone, subject, message)
    VALUES (?, ?, ?, ?, ?)
  `;
  try {
    await conn.query(query, [
      request.full_name,
      request.email,
      request.phone,
      request.subject,
      request.message,
    ]);
  } finally {
    conn.release();
  }
};

/**
 * Envía un correo de notificación al equipo de IDEAMEX.
 * 
 * @async
 * @function notifyAdminByEmail
 * @param request - Objeto de solicitud de contacto (sin id ni fecha).
 */
export const notifyAdminByEmail = async (
  request: Omit<ContactRequest, 'id_contact_request' | 'created_at'>
): Promise<void> => {
  // Este aviso lo lee el equipo de IDEAMEX, no el visitante: va siempre en
  // español y no sigue el idioma con el que se llenó el formulario.
  const fields: Array<{ label: string; value: string; preserveLineBreaks?: boolean }> = [
    { label: 'Nombre', value: request.full_name },
    { label: 'Correo', value: request.email },
    { label: 'Teléfono', value: request.phone },
    { label: 'Asunto', value: request.subject },
    { label: 'Mensaje', value: request.message, preserveLineBreaks: true },
  ];

  // Escapa todos los campos para evitar inyección HTML en el correo.
  const rows = fields
    .map(({ label, value, preserveLineBreaks }) => {
      const safeValue = preserveLineBreaks
        ? escapeHTML(value).replace(/\r?\n/g, '<br />')
        : escapeHTML(value);

      return `                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid ${COLORS.border};" valign="top">
                    <p style="margin:0 0 4px 0;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:${COLORS.mutedText};">${label}</p>
                    <p style="margin:0;font-size:15px;line-height:22px;color:${COLORS.bodyText};">${safeValue}</p>
                  </td>
                </tr>`;
    })
    .join('\n');

  const contentHTML = `              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:28px 40px 4px 40px;">
                    <p style="margin:0;font-size:20px;font-weight:bold;color:${COLORS.brand};">Nueva solicitud de contacto</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 40px 32px 40px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${rows}
                    </table>
                  </td>
                </tr>
              </table>`;

  const textBody = [
    'Nueva solicitud de contacto',
    '',
    ...fields.map(({ label, value }) => `${label}: ${value}`),
    '',
    EMAIL_FOOTER,
  ].join('\n');

  await emailTransporter.sendMail({
    from: buildSender(),
    // Configurable por entorno; el valor de respaldo es el buzón que se venía usando.
    to: process.env.CONTACT_NOTIFICATION_EMAIL || 'ideamex.unam@gmail.com',
    // Permite responder al visitante directamente desde el aviso.
    replyTo: request.email,
    subject: `Nueva solicitud de contacto: ${request.subject}`,
    text: textBody,
    html: buildEmailShell({
      language: 'es',
      title: 'Nueva solicitud de contacto',
      preheader: `${request.full_name} escribió sobre: ${request.subject}`,
      contentHTML,
    }),
    attachments: [buildLogoAttachment()],
  });
};
