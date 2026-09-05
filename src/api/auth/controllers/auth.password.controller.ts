/**
 * @file Controlador de recuperación y restablecimiento de contraseña.
 *
 * @module api/auth/controllers/auth.password.controller
 *
 * @author Ulises Rodríguez García
 */

import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { generateToken } from '../../../utils/token';
import { sendPasswordResetEmail } from '../../../utils/email';
import {
  findUserByEmail,
  findUserByResetToken,
  updateUserPassword,
  updateUserToken,
} from '../auth.service';
import { sendErrorResponse, sendSuccessResponse } from '../../../utils/response';

/**
 * Envía un correo con token para restablecer contraseña.
 */
export const requestPasswordReset = async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;

  try {
    // Solo cuentas locales activas pueden recuperar contraseña por correo.
    const user = await findUserByEmail(email);
    if (!user) {
      sendErrorResponse(res, 'Email not found', null, 404);
      return;
    }

    if (user.activation !== 1) {
      sendErrorResponse(res, 'Account not activated.', null, 403);
      return;
    }

    if (user.auth_provider === 'google') {
      sendErrorResponse(res, 'Use Google login to access this account.', null, 403);
      return;
    }

    // Genera token temporal de 1 hora y lo persiste en BD.
    const resetToken = generateToken();
    const expiration = new Date(Date.now() + 60 * 60 * 1000);

    // Envía enlace de recuperación al correo registrado.
    await updateUserToken(user.id_user, resetToken, expiration);
    await sendPasswordResetEmail(email, resetToken);

    sendSuccessResponse(res, 'Password reset email sent');
  } catch (error) {
    console.error('Password reset request error:', error);
    sendErrorResponse(res, 'Server error', null, 500);
  }
};

/**
 * Restablece la contraseña con un token válido.
 */
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  const { token, password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    sendErrorResponse(res, 'Passwords do not match', null, 400);
    return;
  }

  try {
    // Valida existencia del token y que no haya expirado.
    const user = await findUserByResetToken(token);
    if (!user || !user.token_expiration || user.token_expiration < new Date()) {
      sendErrorResponse(res, 'Invalid or expired token', null, 400);
      return;
    }

    // Reemplaza password, y limpia token de recuperación para un solo uso.
    const hashedPassword = await bcrypt.hash(password, 12);
    await updateUserPassword(user.id_user, hashedPassword);

    sendSuccessResponse(res, 'Password updated successfully');
  } catch (error) {
    console.error('Password reset error:', error);
    sendErrorResponse(res, 'Server error', null, 500);
  }
};
