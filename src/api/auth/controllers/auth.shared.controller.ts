/**
 * @file Helpers compartidos del módulo de autenticación.
 *
 * @module api/auth/controllers/auth.shared.controller
 */

import jwt from 'jsonwebtoken';
import { findOrCreateUser } from '../auth.service';

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
 * Crea el JWT interno de sesión de IDEAMEX.
 * Incluye identidad mínima para autorización en endpoints privados.
 */
export const createAuthToken = (params: {
  id_user: number;
  username: string;
  email: string;
}): string =>
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
export const getGoogleOAuthConfig = (): {
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
export const verifyGoogleIdToken = async (idToken: string): Promise<{
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
export const buildUsernameFromGoogleName = (name: string, fallbackEmail: string): string => {
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
export const loginOrRegisterGoogleUser = async (params: {
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
