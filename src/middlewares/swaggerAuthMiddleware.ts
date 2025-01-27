/**
 * @file Middleware para proteger la documentación Swagger con autenticación.
 * Este middleware requiere credenciales específicas para acceder a los endpoints de Swagger.
 * 
 * @module middlewares/swaggerAuth
 * @requires express
 * 
 * @author Ulises Rodríguez García
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Middleware para proteger Swagger con autenticación.
 * @function swaggerAuth
 * @param {Request} req - Objeto de solicitud.
 * @param {Response} res - Objeto de respuesta.
 * @param {NextFunction} next - Función para pasar al siguiente middleware.
 */
export const swaggerAuth = (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;

    const username = process.env.SWAGGER_USER || 'admin';
    const password = process.env.SWAGGER_PASSWORD || 'password123';

    if (!authHeader) {
        res.setHeader('WWW-Authenticate', 'Basic');
        res.status(401).json({ message: 'Authentication required' });
        return;
    }

    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    const [inputUsername, inputPassword] = credentials.split(':');

    if (inputUsername === username && inputPassword === password) {
        next();
        return;
    }

    res.status(403).json({ message: 'Forbidden: Invalid credentials' });
};