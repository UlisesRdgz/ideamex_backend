/**
 * @file Controlador de autenticación con Google.
 *
 * @module api/auth/controllers/auth.google.controller
 *
 * @author Ulises Rodríguez García
 */

import { Request, Response } from 'express';
import { sendErrorResponse, sendSuccessResponse } from '../../../utils/response';
import {
  getGoogleOAuthConfig,
  loginOrRegisterGoogleUser,
  verifyGoogleIdToken,
} from './auth.shared.controller';

/**
 * Respuesta parcial del intercambio OAuth2 (authorization_code -> tokens).
 */
interface GoogleTokenExchangeResponse {
  id_token?: string;
}

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
      sendErrorResponse(res, 'Google OAuth is not configured on the server.', null, 500);
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
          'This email is already registered with a password. Use local login.',
          null,
          409
        );
        return;
      }

      if (error.message === 'GOOGLE_OAUTH_CONFIG_MISSING') {
        sendErrorResponse(res, 'Google OAuth is not configured on the server.', null, 500);
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
        sendErrorResponse(res, 'Could not validate identity with Google.', null, 401);
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
          'This email is already registered with a password. Use local login.',
          null,
          409
        );
        return;
      }

      if (error.message === 'GOOGLE_CONFIG_MISSING') {
        sendErrorResponse(res, 'Google login is not configured on the server.', null, 500);
        return;
      }

      // Token emitido para otro client_id de Google.
      if (error.message === 'GOOGLE_AUDIENCE_MISMATCH') {
        sendErrorResponse(res, 'Invalid Google token for this application.', null, 401);
        return;
      }

      // Token inválido/expirado o correo de Google sin verificar.
      if (
        error.message === 'GOOGLE_TOKEN_INVALID' ||
        error.message === 'GOOGLE_EMAIL_NOT_VERIFIED'
      ) {
        sendErrorResponse(res, 'Could not validate identity with Google.', null, 401);
        return;
      }
    }

    console.error('Google login error:', error);
    sendErrorResponse(res, 'Server error', null, 500);
  }
};
