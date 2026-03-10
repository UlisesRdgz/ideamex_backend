/**
 * @file Controlador del formulario de contacto.
 * Procesa y guarda las solicitudes enviadas desde el frontend.
 * 
 * @module api/contact/contact.controller
 * @requires express
 * @requires ../../models/ContactRequest
 * @requires ./contact.service
 * @requires ../../utils/response
 * 
 * @author Ulises Rodríguez García
 */

import { Request, Response } from 'express';
import { ContactRequest } from '../../models/ContactRequest';
import { saveContactRequest, notifyAdminByEmail } from './contact.service';
import { sendErrorResponse, sendSuccessResponse } from '../../utils/response';

/**
 * Maneja el envío de una solicitud de contacto.
 * Valida los campos, guarda en la base de datos y notifica por correo.
 * 
 * @function submitContactForm
 * @param req - Solicitud HTTP con los datos del formulario.
 * @param res - Respuesta HTTP al cliente.
 */
export const submitContactForm = async (req: Request, res: Response): Promise<void> => {
  const { fullName, email, phone, subject, message } = req.body;

  try {
    // Validación defensiva adicional (además de express-validator en rutas).
    if (!fullName || !email || !phone || !subject || !message) {
      sendErrorResponse(res, 'Todos los campos son obligatorios', null, 400);
      return;
    }

    // Mapea payload público (camelCase) al contrato de persistencia (snake_case).
    const contactData: Omit<ContactRequest, 'id_contact_request' | 'created_at'> = {
      full_name: fullName,
      email,
      phone,
      subject,
      message,
    };

    // Primero persiste en BD y luego notifica por correo al equipo.
    await saveContactRequest(contactData);
    await notifyAdminByEmail(contactData);

    sendSuccessResponse(res, 'Tu solicitud fue enviada exitosamente.', null, 201);
  } catch (error) {
    console.error('[CONTACT] Error al procesar la solicitud:', error);
    sendErrorResponse(res, 'Error del servidor al procesar el formulario', null, 500);
  }
};
