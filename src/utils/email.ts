/**
 * @file Utilidad para enviar correos electrónicos.
 * Contiene funciones para enviar correos relacionados con la autenticación de usuarios.
 *
 * @module utils/email
 * @requires nodemailer
 * @requires ../config/email
 * 
 * @author Ulises Rodríguez García
 */

import { emailTransporter } from '../config/email';

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
  const activationLink = `http://localhost:3000/api/v1/ideamex/auth/activate?token=${token}`;

  await emailTransporter.sendMail({
    from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
    to: email,
    subject: 'Activate your IDEAMEX Account',
    html: getActivationEmailHTML(activationLink),
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
  const resetLink = `http://localhost:3000/api/v1/ideamex/auth/reset-password?token=${token}`;

  await emailTransporter.sendMail({
    from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
    to: email,
    subject: 'Password Reset Request',
    html: `
      <h1>Password Reset</h1>
      <p>Click the link below to reset your password:</p>
      <a href="${resetLink}">${resetLink}</a>
    `,
  });
};

/**
 * Plantilla HTML del correo de activación.
 *
 * @param activationLink - Enlace de activación para el usuario.
 * @returns HTML en string listo para enviar por correo.
 */
function getActivationEmailHTML(activationLink: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body {
      background-color: #f1f1f1;
      margin: 0;
      padding: 20px 0;
      font-family: Tahoma, sans-serif;
    }
    .card {
      max-width: 600px;
      margin: auto;
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
      overflow: hidden;
      text-align: center;
    }
    .header {
      background: #03355a;
      padding: 16px;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .header img {
      width: 40px;
      margin-right: 8px;
    }
    .title {
      font-size: 24px;
      margin: 0;
    }
    .content {
      padding: 20px;
    }
    .welcome {
      font-size: 20px;
      font-weight: bold;
      color: #03355a;
      margin-bottom: 16px;
    }
    .instruction {
      font-size: 16px;
      color: #333;
      margin-bottom: 20px;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background-color: #03355a;
      color: white;
      text-decoration: none;
      font-weight: bold;
      border-radius: 12px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <img src="https://i.postimg.cc/jjLvcyqj/ideamex-logo.png" alt="IDEAMEX Logo" />
      <h1 class="title">IDEAMEX</h1>
    </div>
    <div class="content">
      <div class="welcome">¡Bienvenido a <span style="color:#d59f0f">IDEA</span><span style="color:#03355a">MEX</span>!</div>
      <p class="instruction">Haz clic en el siguiente botón para activar tu cuenta:</p>
      <a href="${activationLink}" class="button">Activar cuenta</a>
    </div>
  </div>
</body>
</html>`;
}