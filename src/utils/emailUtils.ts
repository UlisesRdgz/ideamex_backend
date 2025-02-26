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
    <style>
        .email-body {
            background-color: #f1f1f1 !important;
            margin: 0;
            padding: 20px 0;
            display: flex;
            justify-content: center;
            align-items: center;
        }

        .card-container {
            width: 90%;
            max-width: 600px;
            background: white;
            border-radius: 16px;
            box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 0.1) !important;
            margin: 0 auto;
            text-align: center;
        }

        .hero-section {
            background: #03355a;
            border-radius: 16px 16px 0 0;
            padding: 16px;
            display: flex;
            align-items: start;
            justify-content: center;
        }

        .hero-section img {
            width: 40px;
            margin-right: 8px;
        }

        .hero-section h1 {
            color: white;
            font-size: 24px;
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0; 
        }

        .content-section {
            padding: 20px;
        }

        .welcome-title {
            font-size: 24px;
            font-weight: 600;
            font-family: Tahoma, sans-serif;
            color: #03355a;
            margin-bottom: 16px;
        }

        .welcome-title span.ideamex {
            color: #03355a;
        }

        .welcome-title span.idea {
            color: #d59f0f;
        }

        .instruction-text {
            font-size: 16px;
            font-family: Tahoma, sans-serif;
            color: #333;
            margin: 0 0 16px 0;
            line-height: 1.5;
        }

        .activation-button {
            display: inline-block;
            background-color: #03355a;
            color: white !important;
            font-size: 16px;
            font-weight: bold;
            font-family: Tahoma, sans-serif;
            padding: 12px 24px;
            border-radius: 16px;
            text-decoration: none;
            margin: 16px 0;
        }

        @media (max-width: 600px) {
            .hero-section h1 {
                margin-top: 8px;
                font-size: 20px;
                font-family: Arial, sans-serif;
            }

            .welcome-title {
                font-size: 20px;
                font-family: Tahoma, sans-serif;
            }

            .instruction-text {
                font-size: 14px;
                font-family: Tahoma, sans-serif;
            }

            .activation-button {
                font-size: 14px;
                padding: 10px 20px;
            }
        }
    </style>
</head>
<body class="email-body">
    <!-- Card Container -->
    <div class="card-container">
        <!-- Hero Section -->
        <div class="hero-section">
            <img src="https://i.postimg.cc/jjLvcyqj/ideamex-logo.png" alt="IDEAMEX">
            <h1>IDEAMEX</h1>
        </div>

        <!-- Content Section -->
        <div class="content-section">
            <!-- Welcome Title -->
            <div class="welcome-title">
                ¡Bienvenido a <span class="idea">IDEA</span><span class="ideamex">MEX</span>!
            </div>

            <!-- Instruction Text -->
            <p class="instruction-text">
                A continuación, haz clic en el siguiente botón para activar tu cuenta:
            </p>

            <!-- Activation Button -->
            <a href="${activationLink}" class="activation-button">
                Activar cuenta
            </a>
        </div>
    </div>
</body>
</html>
        `;
}
