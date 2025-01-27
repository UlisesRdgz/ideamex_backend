/**
 * @file Middleware de autenticación para verificar la existencia de un usuario.
 * Este middleware comprueba si un correo ya está registrado en el sistema.
 * 
 * @module middlewares/authMiddleware
 * @requires express
 * @requires ../services/authService
 * 
 * @author Ulises Rodríguez García
 */

import { Request, Response, NextFunction } from 'express';
import { findUserByEmail } from '../services/authService';

/**
 * Middleware que verifica si un correo electrónico ya está registrado en la base de datos.
 * 
 * @async
 * @function checkEmailExists
 * @param {Request} req - Objeto de solicitud de Express.
 * @param {Response} res - Objeto de respuesta de Express.
 * @param {NextFunction} next - Función para pasar al siguiente middleware.
 * @returns {Promise<void>} Responde con un error si el correo ya existe, o pasa al siguiente middleware si no.
 */
export const checkEmailExists = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { email } = req.body;

    try {
        const existingUser = await findUserByEmail(email);
        if (existingUser) {
            res.status(400).json({ message: 'User already exists' });
            return;
        }

        next(); 
    } catch (error) {
        console.error('Error checking email:', error);
        res.status(500).json({ message: 'Server error while checking email' });
    }
};