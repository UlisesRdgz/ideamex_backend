/**
 * @file Utilidad para enviar correos electrónicos.
 * Contiene funciones para enviar correos relacionados con la autenticación de usuarios.
 *
 * @module utils/emailUtils
 * @requires nodemailer
 *
 * @author Ulises Rodríguez García
 */

import nodemailer from "nodemailer";

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
    port: parseInt(process.env.SMTP_PORT || "587"),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  const activationLink = `http://localhost:3000/api/v1/ideamex/auth/activate?token=${token}`;

  await transporter.sendMail({
    from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
    to: email,
    subject: "Activate your IDEAMEX Account",
    html: getHTMLTemplate(activationLink),
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
    port: parseInt(process.env.SMTP_PORT || "587"),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  const resetLink = `http://localhost:3000/api/v1/ideamex/auth/reset-password?token=${token}`;

  await transporter.sendMail({
    from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
    to: email,
    subject: "Password reset request",
    html: `
            <h1>Password reset</h1>
            <p>Click the link below to reset your password:</p>
            <a href="${resetLink}">${resetLink}</a>
        `,
  });
};

function getHTMLTemplate(activationLink: string): string {
  return `
    <!DOCTYPE html>
<html>
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="background-color: #f1f1f1; margin: 0; padding: 20px 0; display: flex; justify-content: center; align-items: center;">
    <!-- Card Container -->
    <div style="width: 80%; background: white; border-radius: 16px; box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 1); margin: 0 auto; text-align: center;">
        
        <!-- Hero Section -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background: #03355a; border-radius: 16px 16px 0 0;">
            <tr>
                <!-- Logo Column -->
                <td width="10%" style="padding: 16px; padding-right: 4px; vertical-align: middle;">
                    <img src="https://i.postimg.cc/jjLvcyqj/ideamex-logo.png" alt="IDEAMEX" width="40" style="display: block; margin: 0 auto;">
                </td>
                
                <!-- Title Column -->
                <td width="80%" style="text-align: start;">
                    <h1 style="color: white; font-size: 24px; font-family: Arial, sans-serif; margin: 0;">
                        IDEAMEX
                    </h1>
                </td>
            </tr>
        </table>

        <!-- Content Section -->
        <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
                <td style="padding: 20px 0; text-align: center;">
                    <!-- Welcome Title -->
                    <div style="font-size: 24px; font-weight: 600; font-family: Tahoma, sans-serif; color: #03355a; margin-bottom: 16px;">
                        ¡Bienvenido a <span style="color: #d59f0f;">IDEA</span><span style="color: #03355a;">MEX</span>!
                    </div>

                    <!-- Instruction Text -->
                    <p style="font-size: 16px; font-family: Tahoma, sans-serif; color: #333; margin: 0 29px 16px; line-height: 1.5;">
                        A continuación, haz clic en el siguiente botón para activar tu cuenta:
                    </p>

                    <!-- Activation Button -->
                    <a href="${activationLink}"
                       style="display: inline-block; 
                              background-color: #03355a; 
                              color: white; 
                              font-size: 16px; 
                              font-weight: bold; 
                              font-family: Tahoma, sans-serif; 
                              padding: 12px 24px; 
                              border-radius: 16px; 
                              text-decoration: none; 
                              margin: 16px 0;">
                        Activar cuenta
                    </a>
                </td>
            </tr>
        </table>
    </div>
</body>
</html>
        `;
}
