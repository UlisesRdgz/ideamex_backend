/**
 * @file Configuración del transporte de correo electrónico con Nodemailer.
 * Se exporta una instancia reutilizable para evitar duplicación de código.
 * 
 * @module config/email
 * @requires nodemailer
 * 
 * @author Ulises Rodríguez García
 */

import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

// Carga variables de entorno
dotenv.config();

/**
 * Instancia reutilizable del transporte de correo.
 * Se configura una única vez y se exporta para ser usada en toda la aplicación.
 */
export const emailTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
    },
});