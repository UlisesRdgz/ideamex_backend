/**
 * @file Utilidad para enviar correos electrónicos.
 * Contiene funciones para enviar correos relacionados con la autenticación de usuarios.
 * 
 * @module utils/emailUtils
 * @requires nodemailer
 * 
 * @author Ulises Rodríguez García
 */

import nodemailer from 'nodemailer';

/**
 * Envía un correo de activación al usuario con un enlace para activar su cuenta.
 * 
 * @async
 * @function sendActivationEmail
 * @param {string} email - Dirección de correo electrónico del destinatario.
 * @param {string} token - Token de activación único.
 * @throws {Error} Si ocurre un problema al enviar el correo.
 */
export const sendActivationEmail = async (email: string, token: string) => {
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
        },
    });

    const activationLink = `http://localhost:3000/api/v1/ideamex/auth/activate?token=${token}`;

    await transporter.sendMail({
        from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
        to: email,
        subject: 'Activate your IDEAMEX Account',
        html: `
            <h1>Welcome to IDEAMEX!</h1>
            <p>Please click the link below to activate your account:</p>
            <a href="${activationLink}">${activationLink}</a>
        `,
    });
};

/**
 * Envía un correo electrónico para restablecer la contraseña con un token único.
 * 
 * @async
 * @function sendPasswordResetEmail
 * @param {string} email - Dirección de correo electrónico del usuario.
 * @param {string} token - Token único generado para el restablecimiento de contraseña.
 * @throws {Error} Error al configurar el transporte de correo o al enviar el correo electrónico.
 */
export const sendPasswordResetEmail = async (email: string, token: string) => {
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
        },
    });

    const resetLink = `http://localhost:3000/api/v1/ideamex/auth/reset-password?token=${token}`;

    await transporter.sendMail({
        from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
        to: email,
        subject: 'Password reset request',
        html: `
            <h1>Password reset</h1>
            <p>Click the link below to reset your password:</p>
            <a href="${resetLink}">${resetLink}</a>
        `,
    });
};