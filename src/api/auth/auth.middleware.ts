/**
 * @file Middlewares de autenticación y validación de usuarios.
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { findUserByEmail } from './auth.service';
import { sendErrorResponse } from '../../utils/response';

/**
 * Obtiene la variable JWT_SECRET de forma segura.
 */
const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    console.warn(
      '[AUTH WARNING] JWT_SECRET no definido. Usando "defaultsecret" solo para desarrollo.'
    );
    return 'defaultsecret';
  }

  return secret;
};

/**
 * Valida la estructura del payload del JWT.
 */
const isValidJwtPayload = (decoded: any): decoded is JwtPayload & {
  id_user: number;
  username: string;
  email: string;
} => {
  return (
    decoded &&
    typeof decoded === 'object' &&
    typeof decoded.id_user === 'number' &&
    typeof decoded.username === 'string' &&
    typeof decoded.email === 'string'
  );
};

/**
 * Middleware: valida el token Bearer y adjunta req.user.
 */
export const requireUser: RequestHandler = (req, res, next) => {
  const authHeader = req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendErrorResponse(res, 'Token Bearer faltante o mal formado', null, 401);
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, getJwtSecret());

    if (!isValidJwtPayload(decoded)) {
      return sendErrorResponse(res, 'Token inválido', null, 401);
    }

    req.user = {
      id_user: decoded.id_user,
      username: decoded.username,
      email: decoded.email,
    };

    return next();
  } catch (error) {
    console.error('[AUTH] Token inválido o expirado:', error);
    return sendErrorResponse(res, 'Token inválido o expirado', null, 401);
  }
};

/**
 * Middleware para prevenir el registro de correos duplicados.
 */
export const checkEmailExists = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { email } = req.body;

  try {
    const existingUser = await findUserByEmail(email);

    if (existingUser) {
      return sendErrorResponse(res, 'El correo ya está en uso', null, 400);
    }

    return next();
  } catch (error) {
    console.error('[AUTH] Error al verificar correo existente:', error);
    return sendErrorResponse(res, 'Server error', null, 500);
  }
};