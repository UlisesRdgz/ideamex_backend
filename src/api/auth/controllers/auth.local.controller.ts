/**
 * @file Controlador de autenticación local.
 *
 * @module api/auth/controllers/auth.local.controller
 *
 * @author Ulises Rodríguez García
 */

import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import dayjs from 'dayjs';
import { generateToken } from '../../../utils/token';
import { resolveLanguage } from '../../../config/i18n';
import { sendActivationEmail } from '../../../utils/email';
import {
  activateUserAccount,
  createUser,
  findUserByEmail,
  findUserByToken,
} from '../auth.service';
import { sendErrorResponse, sendSuccessResponse } from '../../../utils/response';
import { createAuthToken } from './auth.shared.controller';

/**
 * Registra un nuevo usuario en el sistema.
 */
export const registerUser = async (req: Request, res: Response): Promise<void> => {
  const { email, username, password, language } = req.body;

  try {
    // Idioma de la cuenta: manda lo que el usuario eligió en la interfaz y, si
    // el cliente no lo envía, se deduce del navegador antes de caer en el valor
    // por defecto. Queda guardado para que los correos posteriores lo respeten.
    const accountLanguage = resolveLanguage(language, req.headers['accept-language']);

    // Endurece contraseña antes de persistirla.
    const hashedPassword = await bcrypt.hash(password, 12);
    // Token de activación con vigencia de 24 horas.
    const activationToken = generateToken();
    const tokenExpiration = dayjs().add(24, 'hour').toDate();

    // Registro local inicia desactivado hasta confirmar correo.
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
      language: accountLanguage,
    });

    // El correo incluye enlace de activación con token.
    await sendActivationEmail(email, activationToken, accountLanguage);

    sendSuccessResponse(
      res,
      'User registered successfully. Please check your email to activate your account.',
      {
        id: newUser.id_user,
        email: newUser.email,
      },
      201
    );
  } catch (error) {
    console.error('Error in registerUser:', error);
    sendErrorResponse(res, 'Server error', null, 500);
  }
};

/**
 * Activa la cuenta de usuario mediante un token.
 */
export const activateUser = async (req: Request, res: Response): Promise<void> => {
  const { token } = req.query;

  if (!token || typeof token !== 'string') {
    sendErrorResponse(res, 'Invalid or missing token', null, 400);
    return;
  }

  try {
    // El token debe existir y seguir vigente en BD.
    const user = await findUserByToken(token);

    if (!user) {
      sendErrorResponse(res, 'Invalid activation token', null, 404);
      return;
    }

    // Activa cuenta y limpia token para evitar reuso.
    await activateUserAccount(user.id_user);
    sendSuccessResponse(res, 'Account activated successfully');
  } catch (error) {
    console.error('Error activating user:', error);
    sendErrorResponse(res, 'Server error', null, 500);
  }
};

/**
 * Inicia sesión para un usuario con autenticación local.
 * Retorna token Bearer y datos mínimos del usuario.
 */
export const loginUser = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  try {
    // Para login local se requiere usuario existente y password almacenado.
    const user = await findUserByEmail(email);
    if (!user || !user.password) {
      sendErrorResponse(res, 'Invalid email or password', null, 401);
      return;
    }

    // Bloquea acceso si la cuenta aún no confirmó correo.
    if (user.activation !== 1) {
      sendErrorResponse(res, 'Account not activated. Please activate your account.', null, 403);
      return;
    }

    // Protege cuentas Google de autenticación por password.
    if (user.auth_provider === 'google') {
      sendErrorResponse(res, 'Please use Google login for this account.', null, 403);
      return;
    }

    // Verifica hash bcrypt contra contraseña ingresada.
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      sendErrorResponse(res, 'Invalid email or password', null, 401);
      return;
    }

    // Emite JWT interno con vigencia de 30 días.
    const token = createAuthToken({
      id_user: user.id_user,
      username: user.username,
      email: user.email,
    });

    sendSuccessResponse(res, 'Login successful', {
      token,
      id: user.id_user,
      email: user.email,
      username: user.username,
    });
  } catch (error) {
    console.error('Login error:', error);
    sendErrorResponse(res, 'Server error', null, 500);
  }
};
