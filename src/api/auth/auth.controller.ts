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
  findOrCreateUser,
  updateUserResetToken,
  findUserByResetToken,
  updateUserPassword,
} from './auth.service';
import { sendErrorResponse, sendSuccessResponse } from '../../utils/response';

/**
 * Respuesta parcial del endpoint de verificación de token de Google.
 * Solo se tipan los campos que el backend consume para autenticación.
 */
interface GoogleTokenInfoResponse {
  aud?: string;
  iss?: string;
  sub?: string;
  email?: string;
  email_verified?: string;
  name?: string;
}

/**
 * Respuesta parcial del intercambio OAuth2 (authorization_code -> tokens).
 */
interface GoogleTokenExchangeResponse {
  id_token?: string;
}

/**
 * Crea el JWT interno de sesión de IDEAMEX.
 * Incluye identidad mínima para autorización en endpoints privados.
 */
const createAuthToken = (params: { id_user: number; username: string; email: string }): string =>
  jwt.sign(
    {
      id_user: params.id_user,
      username: params.username,
      email: params.email,
    },
    process.env.JWT_SECRET || 'defaultsecret',
    { expiresIn: '30d' }
  );

/**
 * Lee y valida configuración OAuth de Google desde variables de entorno.
 * Lanza error controlado si falta cualquier variable crítica.
 */
const getGoogleOAuthConfig = (): {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
} => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const callbackUrl = process.env.GOOGLE_CALLBACK_URL;

  if (!clientId || !clientSecret || !callbackUrl) {
    throw new Error('GOOGLE_OAUTH_CONFIG_MISSING');
  }

  return { clientId, clientSecret, callbackUrl };
};

/**
 * Valida un `id_token` de Google contra el endpoint tokeninfo.
 * Además de validar firma/expiración en Google, se aplica validación de audiencia (`aud`)
 * y de emisor (`iss`) para asegurar que el token pertenece a esta app.
 */
const verifyGoogleIdToken = async (idToken: string): Promise<{
  googleId: string;
  email: string;
  name: string;
}> => {
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  if (!googleClientId) {
    throw new Error('GOOGLE_CONFIG_MISSING');
  }

  // Consulta a Google para verificar token y extraer claims OpenID.
  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
  );

  if (!response.ok) {
    throw new Error('GOOGLE_TOKEN_INVALID');
  }

  const payload = (await response.json()) as GoogleTokenInfoResponse;
  const validIssuer =
    payload.iss === 'accounts.google.com' || payload.iss === 'https://accounts.google.com';

  // Rechaza tokens sin campos obligatorios o emitidos por issuer no reconocido.
  if (!payload.sub || !payload.email || !payload.aud || !payload.email_verified || !validIssuer) {
    throw new Error('GOOGLE_TOKEN_INVALID');
  }

  // Evita aceptar tokens emitidos para otro client_id.
  if (payload.aud !== googleClientId) {
    throw new Error('GOOGLE_AUDIENCE_MISMATCH');
  }

  // Exige correo verificado para prevenir cuentas no confirmadas.
  if (payload.email_verified !== 'true') {
    throw new Error('GOOGLE_EMAIL_NOT_VERIFIED');
  }

  return {
    googleId: payload.sub,
    email: payload.email,
    name: payload.name || payload.email.split('@')[0],
  };
};

/**
 * Construye un username consistente para cuentas Google respetando límite de BD.
 */
const buildUsernameFromGoogleName = (name: string, fallbackEmail: string): string => {
  const trimmedName = name.trim();
  if (trimmedName.length > 0) {
    return trimmedName.slice(0, 60);
  }
  return fallbackEmail.split('@')[0].slice(0, 60);
};

/**
 * Unifica el flujo de "login o registro" de Google:
 * 1) resuelve usuario existente o crea uno nuevo,
 * 2) emite JWT interno,
 * 3) devuelve payload estándar de sesión.
 */
const loginOrRegisterGoogleUser = async (params: {
  googleId: string;
  email: string;
  name: string;
}): Promise<{
  token: string;
  id: number;
  email: string;
  username: string;
  auth_provider: 'local' | 'google';
}> => {
  const username = buildUsernameFromGoogleName(params.name, params.email);

  const user = await findOrCreateUser({
    email: params.email,
    username,
    googleId: params.googleId,
  });

  const token = createAuthToken({
    id_user: user.id_user,
    username: user.username,
    email: user.email,
  });

  return {
    token,
    id: user.id_user,
    email: user.email,
    username: user.username,
    auth_provider: user.auth_provider,
  };
};

/**
 * Registra un nuevo usuario en el sistema.
 */
export const registerUser = async (req: Request, res: Response): Promise<void> => {
  const { email, username, password } = req.body;

  try {
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
    });

    // El correo incluye enlace de activación con token.
    await sendActivationEmail(email, activationToken);

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
    const token = jwt.sign(
      {
        id_user: user.id_user,
        username: user.username,
        email: user.email,
      },
      process.env.JWT_SECRET || 'defaultsecret',
      { expiresIn: '30d' }
    );

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

/**
 * Inicia flujo OAuth2 de Google con redirección.
 */
export const startGoogleOAuth = async (req: Request, res: Response): Promise<void> => {
  try {
    const { clientId, callbackUrl } = getGoogleOAuthConfig();

    // Construye URL de consentimiento OAuth2 para iniciar redirección del usuario.
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', callbackUrl);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid email profile');
    authUrl.searchParams.set('prompt', 'select_account');

    res.redirect(authUrl.toString());
  } catch (error) {
    if (error instanceof Error && error.message === 'GOOGLE_OAUTH_CONFIG_MISSING') {
      sendErrorResponse(res, 'Google OAuth no está configurado en el servidor.', null, 500);
      return;
    }

    console.error('Google OAuth start error:', error);
    sendErrorResponse(res, 'Server error', null, 500);
  }
};

/**
 * Callback OAuth2 de Google: intercambia `code`, valida identidad y devuelve JWT interno.
 */
export const handleGoogleOAuthCallback = async (req: Request, res: Response): Promise<void> => {
  const errorParam = req.query.error;
  const code = req.query.code;

  // Google puede regresar `error` directo si el usuario cancela o deniega permisos.
  if (typeof errorParam === 'string') {
    sendErrorResponse(res, `Google OAuth error: ${errorParam}`, null, 401);
    return;
  }

  // Sin authorization code no se puede hacer intercambio por id_token.
  if (!code || typeof code !== 'string') {
    sendErrorResponse(res, 'Missing OAuth code', null, 400);
    return;
  }

  try {
    const { clientId, clientSecret, callbackUrl } = getGoogleOAuthConfig();

    // Intercambia authorization_code por tokens en el endpoint oficial de Google.
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('GOOGLE_CODE_EXCHANGE_FAILED');
    }

    // En este backend solo se usa id_token para validar identidad.
    const tokenPayload = (await tokenResponse.json()) as GoogleTokenExchangeResponse;
    if (!tokenPayload.id_token) {
      throw new Error('GOOGLE_ID_TOKEN_MISSING');
    }

    // Valida claims y luego resuelve login/registro local.
    const googleUser = await verifyGoogleIdToken(tokenPayload.id_token);
    const loginData = await loginOrRegisterGoogleUser(googleUser);

    sendSuccessResponse(res, 'Google OAuth login successful', loginData);
  } catch (error) {
    if (error instanceof Error) {
      // Regla de seguridad: no mezclar login social con cuenta local existente del mismo correo.
      if (error.message === 'LOCAL_ACCOUNT_EXISTS') {
        sendErrorResponse(
          res,
          'Este correo ya está registrado con contraseña. Usa el login local.',
          null,
          409
        );
        return;
      }

      if (error.message === 'GOOGLE_OAUTH_CONFIG_MISSING') {
        sendErrorResponse(res, 'Google OAuth no está configurado en el servidor.', null, 500);
        return;
      }

      // Agrupa errores de validación OAuth para responder 401 consistente.
      if (
        error.message === 'GOOGLE_CODE_EXCHANGE_FAILED' ||
        error.message === 'GOOGLE_ID_TOKEN_MISSING' ||
        error.message === 'GOOGLE_TOKEN_INVALID' ||
        error.message === 'GOOGLE_AUDIENCE_MISMATCH' ||
        error.message === 'GOOGLE_EMAIL_NOT_VERIFIED'
      ) {
        sendErrorResponse(res, 'No se pudo validar la identidad con Google.', null, 401);
        return;
      }
    }

    console.error('Google OAuth callback error:', error);
    sendErrorResponse(res, 'Server error', null, 500);
  }
};

/**
 * Inicia sesión con Google mediante idToken (flujo para SPA/mobile).
 */
export const loginWithGoogle = async (req: Request, res: Response): Promise<void> => {
  const { idToken } = req.body;

  try {
    // Flujo para SPA/mobile: el frontend manda idToken directamente.
    const googleUser = await verifyGoogleIdToken(idToken);
    const loginData = await loginOrRegisterGoogleUser(googleUser);

    sendSuccessResponse(res, 'Google login successful', loginData);
  } catch (error) {
    if (error instanceof Error) {
      // Evita takeover de cuentas registradas con contraseña.
      if (error.message === 'LOCAL_ACCOUNT_EXISTS') {
        sendErrorResponse(
          res,
          'Este correo ya está registrado con contraseña. Usa el login local.',
          null,
          409
        );
        return;
      }

      if (error.message === 'GOOGLE_CONFIG_MISSING') {
        sendErrorResponse(res, 'Google login no está configurado en el servidor.', null, 500);
        return;
      }

      // Token emitido para otro client_id de Google.
      if (error.message === 'GOOGLE_AUDIENCE_MISMATCH') {
        sendErrorResponse(res, 'Token de Google inválido para esta aplicación.', null, 401);
        return;
      }

      // Token inválido/expirado o correo de Google sin verificar.
      if (
        error.message === 'GOOGLE_TOKEN_INVALID' ||
        error.message === 'GOOGLE_EMAIL_NOT_VERIFIED'
      ) {
        sendErrorResponse(res, 'No se pudo validar la identidad con Google.', null, 401);
        return;
      }
    }

    console.error('Google login error:', error);
    sendErrorResponse(res, 'Server error', null, 500);
  }
};

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
    await updateUserResetToken(user.id_user, resetToken, expiration);
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
