/**
 * @file Middlewares de autenticación y validación de usuarios.
 * Valida usuarios por encabezados personalizados y previene registros duplicados.
 * 
 * @module api/auth/auth.middleware
 * @requires express
 * @requires ../../services/auth.service
 * @requires ../../utils/response
 * 
 * @author Ulises Rodríguez García
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { findUserByEmail, findUserById } from './auth.service';
import { sendErrorResponse } from '../../utils/response';

/**
 * Middleware para simular autenticación usando encabezados personalizados.
 * El frontend debe enviar `x-user-id` y `x-username` en cada solicitud.
 * 
 * @function requireUser
 * @param req - Objeto de solicitud HTTP.
 * @param res - Objeto de respuesta HTTP.
 * @param next - Función para continuar la ejecución.
 */
export const requireUser: RequestHandler = async (req, res, next) => {
  const userIdHeader = req.headers['x-user-id'];
  const usernameHeader = req.headers['x-username'];

  const id_user = typeof userIdHeader === 'string' ? parseInt(userIdHeader, 10) : null;
  const username = typeof usernameHeader === 'string' ? usernameHeader : null;

  if (!id_user || !username) {
    sendErrorResponse(res, 'Faltan encabezados de usuario', null, 401);
    return;
  }

  // (Opcional) Verificar existencia del usuario en base de datos
  const user = await findUserById(id_user);
  if (!user || user.username !== username) {
    sendErrorResponse(res, 'Usuario inválido o no encontrado', null, 401);
    return;
  }

  // Agrega el usuario al objeto de solicitud
  req.user = { id_user, username };
  next();
};

/**
 * Middleware para prevenir el registro de usuarios con correos duplicados.
 * Verifica si el correo ya está en uso en la base de datos.
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
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      sendErrorResponse(res, 'User already exists', null, 400);
      return;
    }
    next();
  } catch (error) {
    console.error('Error checking email existence:', error);
    sendErrorResponse(res, 'Server error while checking email', null, 500);
  }
};
