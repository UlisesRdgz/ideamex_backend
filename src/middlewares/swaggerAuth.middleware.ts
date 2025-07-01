/**
 * @file Middleware para proteger el acceso a la documentación Swagger mediante autenticación básica HTTP.
 * Este middleware requiere un usuario y contraseña configurados en variables de entorno.
 * 
 * @module middlewares/swaggerAuth.middleware
 * @requires express
 * @requires ../utils/response
 * 
 * @author Ulises Rodríguez
 */

import { Request, Response, NextFunction } from 'express';
import { sendErrorResponse } from '../utils/response';

/**
 * Middleware que protege el acceso a Swagger usando autenticación básica.
 * 
 * @function swaggerAuth
 * @param req - Objeto de solicitud HTTP.
 * @param res - Objeto de respuesta HTTP.
 * @param next - Función para continuar con la ejecución del middleware.
 * 
 * @returns {void} Autoriza o bloquea el acceso a la documentación Swagger.
 */
export const swaggerAuth = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  // Credenciales desde variables de entorno o valores por defecto
  const username = process.env.SWAGGER_USER || 'admin';
  const password = process.env.SWAGGER_PASSWORD || 'password123';

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic');
    sendErrorResponse(res, 'Autenticación requerida', null, 401);
    return;
  }

  try {
    const base64Credentials = authHeader.split(' ')[1];
    const decodedCredentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    const [inputUsername, inputPassword] = decodedCredentials.split(':');

    if (inputUsername === username && inputPassword === password) {
      next();
    } else {
      sendErrorResponse(res, 'Credenciales inválidas', null, 403);
    }
  } catch (error) {
    console.error('[SWAGGER AUTH] Error procesando credenciales:', error);
    sendErrorResponse(res, 'Error en autenticación', null, 500);
  }
};
