/**
 * @file Middleware para validar y cargar al usuario desde headers.
 * Verifica que los headers x-user-id y x-username estén presentes
 * y que correspondan a un usuario real en la base de datos.
 *
 * @module middlewares/requireUser.middleware
 * @requires express
 * @requires ../utils/response
 * @requires ../api/auth/auth.service
 * 
 * @author Ulises Rodríguez García
 */

import { Request, Response, NextFunction } from 'express';
import { sendErrorResponse } from '../utils/response';
import { findUserById } from '../api/auth/auth.service';

/**
 * Middleware que valida los headers `x-user-id` y `x-username` y los cruza con la base de datos.
 * 
 * @function requireUser
 * @param req - Objeto de solicitud HTTP.
 * @param res - Objeto de respuesta HTTP.
 * @param next - Función para continuar la ejecución si la validación es exitosa.
 * 
 * @returns Envía un error si los headers están ausentes, mal formateados o no coinciden con un usuario real.
 */
export const requireUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const idHeader = req.header('x-user-id');
  const usernameHeader = req.header('x-username');

  if (!idHeader || !usernameHeader) {
    sendErrorResponse(res, 'Faltan los headers: x-user-id o x-username', null, 401);
    return;
  }

  const id_user = Number(idHeader);
  if (!Number.isInteger(id_user) || id_user <= 0) {
    sendErrorResponse(res, 'El header x-user-id debe ser un número entero positivo', null, 400);
    return;
  }

  if (typeof usernameHeader !== 'string' || usernameHeader.trim().length === 0) {
    sendErrorResponse(res, 'El header x-username debe ser un string válido', null, 400);
    return;
  }

  const user = await findUserById(id_user);
  if (!user) {
    sendErrorResponse(res, 'Usuario no encontrado en la base de datos', null, 404);
    return;
  }

  if (user.username !== usernameHeader.trim()) {
    sendErrorResponse(res, 'El username no coincide con el ID proporcionado', null, 403);
    return;
  }

  req.user = {
    id_user,
    username: user.username,
  };

  next();
};
