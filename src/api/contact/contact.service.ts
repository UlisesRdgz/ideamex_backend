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
import escapeHtml from 'escape-html';
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
  await emailTransporter.sendMail({
    from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
    to: 'ideamex.unam@gmail.com',
    subject: `Nueva solicitud de contacto: ${escapeHtml(request.subject)}`,
    html: `
      <h2>Solicitud de contacto</h2>
      <p><strong>Nombre:</strong> ${escapeHtml(request.full_name)}</p>
      <p><strong>Correo:</strong> ${escapeHtml(request.email)}</p>
      <p><strong>Teléfono:</strong> ${escapeHtml(request.phone)}</p>
      <p><strong>Asunto:</strong> ${escapeHtml(request.subject)}</p>
      <p><strong>Mensaje:</strong><br/>${escapeHtml(request.message)}</p>
    `,
  });
};
