/**
 * @file Controlador de contacto.
 * Maneja las solicitudes de contacto, incluyendo el almacenamiento en la base de datos 
 * y el envío de correos electrónicos.
 * 
 * @module controllers/contactController
 * @requires express
 * @requires nodemailer
 * @requires ../config/db
 * @requires ../utils/responseUtils
 * 
 * @author Ulises Rodríguez García
 */

import { Request, Response } from 'express';
import { sendErrorResponse, sendSuccessResponse } from '../utils/responseUtils';
import { pool } from '../config/db';
import nodemailer from 'nodemailer';

/**
 * Maneja la solicitud de contacto enviada desde la página de contacto.
 * 
 * @async
 * @function submitContactForm
 * @param {Request} req - Objeto de solicitud de Express.
 * @param {Response} res - Objeto de respuesta de Express.
 * @returns {Promise<void>} Respuesta indicando si la solicitud de contacto fue enviada correctamente.
 */
export const submitContactForm = async (req: Request, res: Response): Promise<void> => {
    const { fullName, email, phone, subject, message } = req.body;

    try {
        // Validar que todos los campos estén presentes
        if (!fullName || !email || !phone || !subject || !message) {
            sendErrorResponse(res, 'All fields are required', null, 400);
            return;
        }

        // Guardar en la base de datos
        const query = `
            INSERT INTO contact_requests (full_name, email, phone, subject, message)
            VALUES (?, ?, ?, ?, ?)
        `;

        const conn = await pool.getConnection();
        await conn.query(query, [fullName, email, phone, subject, message]);
        conn.release();

        // Enviar correo electrónico a ideamex.unam@gmail.com
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD,
            },
        });

        const mailOptions = {
            from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
            to: 'ideamex.unam@gmail.com',
            subject: `Nueva solicitud de contacto: ${subject}`,
            html: `
                <h1>Nueva solicitud de contacto</h1>
                <p><strong>Nombre completo:</strong> ${fullName}</p>
                <p><strong>Correo electrónico:</strong> ${email}</p>
                <p><strong>Teléfono:</strong> ${phone}</p>
                <p><strong>Asunto:</strong> ${subject}</p>
                <p><strong>Mensaje:</strong></p>
                <p>${message}</p>
            `,
        };

        await transporter.sendMail(mailOptions);

        sendSuccessResponse(res, 'Contact request submitted successfully', null, 201);
    } catch (error) {
        console.error('Error submitting contact form:', error);
        sendErrorResponse(res, 'Server error', null, 500);
    }
};