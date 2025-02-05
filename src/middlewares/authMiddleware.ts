/**
 * @file Middleware de autenticación para verificar la validez del token JWT.
 * Este middleware comprueba la autenticación del usuario mediante JWT.
 * 
 * @module middlewares/authMiddleware
 * @requires express
 * @requires jsonwebtoken
 * 
 * @author Ulises Rodríguez García
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';

/**
 * Middleware de autenticación que verifica la validez del token JWT.
 * 
 * @param {Request} req - Objeto de solicitud de Express.
 * @param {Response} res - Objeto de respuesta de Express.
 * @param {NextFunction} next - Función para pasar al siguiente middleware.
 */
export const requireAuth: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies.token;
  if (!token) {
    res.status(401).json({ message: 'Unauthorized: No token provided' });
    return;
  }

  try {
    const secret = process.env.JWT_SECRET || 'defaultsecret';
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Unauthorized: Invalid token' });
    return; 
  }
};