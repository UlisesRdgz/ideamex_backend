/**
 * @file Middlewares de autenticación y validación de usuarios.
 * Valida usuarios mediante Bearer Token y previene registros duplicados.
 * 
 * @module api/auth/auth.middleware
 * @requires express
 * @requires jsonwebtoken
 * @requires ../../services/auth.service
 * @requires ../../utils/response
 * 
 * @author Ulises Rodríguez García
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { findUserByEmail } from './auth.service';
import { sendErrorResponse } from '../../utils/response';
import { appConfig } from '../../config/appConfig';

/**
 * Middleware para validar autenticación mediante Bearer Token.
 * El token debe ser enviado en el header `Authorization`.
 * 
 * @function requireUser
 * @param req - Objeto de solicitud HTTP.
 * @param res - Objeto de respuesta HTTP.
 * @param next - Función para continuar la ejecución.
 */
export const requireUser: RequestHandler = (req, res, next) => {
  const authHeader = req.header('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    sendErrorResponse(res, 'Token Bearer faltante o mal formado', null, 401);
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verifica firma y expiración del JWT de sesión.
    // `appConfig.jwtSecret` está garantizada por `checkRequiredConfig` al arranque.
    const decoded = jwt.verify(token, appConfig.jwtSecret) as JwtPayload;

    if (
      typeof decoded !== 'object' ||
      typeof decoded.id_user !== 'number' ||
      typeof decoded.username !== 'string'
    ) {
      sendErrorResponse(res, 'Token inválido', null, 401);
      return;
    }

    // Expone identidad mínima para capas siguientes (controllers/services).
    req.user = {
      id_user: decoded.id_user,
      username: decoded.username,
      email: decoded.email,
    };

    next();
  } catch (error) {
    console.error('[AUTH] Token inválido o expirado:', error);
    sendErrorResponse(res, 'Token inválido o expirado', null, 401);
  }
};

/**
 * Middleware para prevenir el registro de usuarios con correos duplicados.
 * 
 * @async
 * @function checkEmailExists
 * @param req - Objeto de solicitud HTTP.
 * @param res - Objeto de respuesta HTTP.
 * @param next - Función para continuar la ejecución.
 */
export const checkEmailExists = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { email } = req.body;

  try {
    // Previene duplicados de email antes del INSERT.
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      sendErrorResponse(res, 'El correo ya está en uso', null, 400);
      return;
    }

    next();
  } catch (error) {
    console.error('[AUTH] Error al verificar correo existente:', error);
    sendErrorResponse(res, 'Error de servidor', null, 500);
  }
};
