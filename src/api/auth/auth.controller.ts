/**
 * @file Controlador de autenticación.
 * Contiene las operaciones de registro, inicio de sesión, activación y recuperación de contraseña.
 * 
 * @module api/auth/auth.controller
 * @requires bcrypt
 * @requires dayjs
 * @requires express
 * @requires ../../utils/token
 * @requires ../../utils/email
 * @requires ../../services/auth.service
 * @requires ../../utils/response
 * 
 * @author Ulises Rodríguez García
 */

import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import dayjs from 'dayjs';
import jwt from 'jsonwebtoken';

import { generateToken } from '../../utils/token';
import {
  sendActivationEmail,
  sendPasswordResetEmail,
} from '../../utils/email';

import {
  createUser,
  findUserByToken,
  activateUserAccount,
  findUserByEmail,
  updateUserResetToken,
  findUserByResetToken,
  updateUserPassword,
} from './auth.service';

import { sendErrorResponse, sendSuccessResponse } from '../../utils/response';

/**
 * Obtiene la variable JWT_SECRET.
 * Si no existe, usa un valor temporal pero alerta en consola.
 */
const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    console.warn(
      '[AUTH WARNING] JWT_SECRET no está definido. Usando "defaultsecret" solo para desarrollo.'
    );
    return 'defaultsecret';
  }

  return secret;
};

/**
 * Registra un nuevo usuario en el sistema.
 */
export const registerUser = async (req: Request, res: Response): Promise<void> => {
  const { email, username, password, confirmPassword } = req.body;

  // Validación de contraseñas
  if (password !== confirmPassword) {
    return sendErrorResponse(res, 'Las contraseñas no coinciden', null, 400);
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 12);
    const activationToken = generateToken();
    const tokenExpiration = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const newUser = await createUser({
      email,
      username,
      password: hashedPassword,
      activation: 0,
      token: activationToken,
      token_expiration: tokenExpiration,
      password_request: 0,
      google_id: null,
      auth_provider: 'local',
    });

    await sendActivationEmail(email, activationToken);

    return sendSuccessResponse(
      res,
      'User registered successfully. Please check your email to activate your account.',
      {
        id: newUser.id_user,
        email: newUser.email,
      },
      201
    );
  } catch (error) {
    console.error('[AUTH] registerUser error:', error);
    return sendErrorResponse(res, 'Server error', null, 500);
  }
};

/**
 * Activa la cuenta de usuario mediante un token.
 */
export const activateUser = async (req: Request, res: Response): Promise<void> => {
  const { token } = req.query;

  if (!token || typeof token !== 'string') {
    return sendErrorResponse(res, 'Invalid or missing token', null, 400);
  }

  try {
    const user = await findUserByToken(token);

    if (!user) {
      return sendErrorResponse(res, 'Invalid activation token', null, 404);
    }

    await activateUserAccount(user.id_user);
    return sendSuccessResponse(res, 'Account activated successfully');
  } catch (error) {
    console.error('Error activating user:', error);
    return sendErrorResponse(res, 'Server error', null, 500);
  }
};

/**
 * Inicia sesión para un usuario con autenticación local.
 * Retorna token Bearer y datos mínimos del usuario.
 */
export const loginUser = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  try {
    const user = await findUserByEmail(email);

    if (!user) {
      return sendErrorResponse(res, 'Invalid email or password', null, 401);
    }

    // Usuario Google
    if (user.auth_provider === 'google') {
      return sendErrorResponse(
        res,
        'This account uses Google login. Use the Google login button.',
        null,
        403
      );
    }

    // No activado
    if (user.activation !== 1) {
      return sendErrorResponse(
        res,
        'Account not activated. Please check your email.',
        null,
        403
      );
    }

    // Contraseña ausente
    if (!user.password) {
      return sendErrorResponse(res, 'Invalid email or password', null, 401);
    }

    // Validación de contraseña
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return sendErrorResponse(res, 'Invalid email or password', null, 401);
    }

    // Generación de token
    const token = jwt.sign(
      {
        id_user: user.id_user,
        username: user.username,
        email: user.email,
      },
      getJwtSecret(),
      { expiresIn: '30d' }
    );

    return sendSuccessResponse(res, 'Login successful', {
      token,
      id: user.id_user,
      email: user.email,
      username: user.username,
    });
  } catch (error) {
    console.error('Login error:', error);
    return sendErrorResponse(res, 'Server error', null, 500);
  }
};

/**
 * Envía un correo con token para restablecer contraseña.
 */
export const requestPasswordReset = async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;

  try {
    const user = await findUserByEmail(email);

    if (!user) {
      return sendErrorResponse(res, 'Email not found', null, 404);
    }

    if (user.activation !== 1) {
      return sendErrorResponse(res, 'Account not activated.', null, 403);
    }

    if (user.auth_provider === 'google') {
      return sendErrorResponse(
        res,
        'Use Google login to access this account.',
        null,
        403
      );
    }

    const resetToken = generateToken();
    const expiration = new Date(Date.now() + 60 * 60 * 1000); // 1h

    await updateUserResetToken(user.id_user, resetToken, expiration);
    await sendPasswordResetEmail(email, resetToken);

    return sendSuccessResponse(res, 'Password reset email sent');
  } catch (error) {
    console.error('Password reset request error:', error);
    return sendErrorResponse(res, 'Server error', null, 500);
  }
};

/**
 * Restablece la contraseña con un token válido.
 */
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  const { token, password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    return sendErrorResponse(res, 'Passwords do not match', null, 400);
  }

  try {
    const user = await findUserByResetToken(token);

    if (!user || !user.token_expiration || user.token_expiration < new Date()) {
      return sendErrorResponse(res, 'Invalid or expired token', null, 400);
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    await updateUserPassword(user.id_user, hashedPassword);

    return sendSuccessResponse(res, 'Password updated successfully');
  } catch (error) {
    console.error('Password reset error:', error);
    return sendErrorResponse(res, 'Server error', null, 500);
  }
};
