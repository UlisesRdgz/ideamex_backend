/**
 * @file Middleware para la validación de solicitudes y datos de registro.
 * Incluye validación de campos y manejo de errores.
 * 
 * @module middlewares/validationMiddleware
 * @requires express
 * @requires express-validator
 * 
 * @author Ulises Rodriguez García
 */

import { Request, Response, NextFunction } from 'express';
import { validationResult, body } from 'express-validator';

/**
 * Middleware que valida el resultado de las comprobaciones realizadas sobre la solicitud.
 * Si se encuentran errores, responde con un estado 400 y una lista de errores.
 * 
 * @function validateRequest
 * @param {Request} req - Objeto de solicitud de Express.
 * @param {Response} res - Objeto de respuesta de Express.
 * @param {NextFunction} next - Función para pasar al siguiente middleware.
 * @returns {void} Responde con errores o pasa al siguiente middleware.
 */
export const validateRequest = (req: Request, res: Response, next: NextFunction): void => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }
    next();
};

/**
 * Arreglo de middlewares para validar los datos del registro de usuario.
 * Comprueba la validez de email, username, password y confirmPassword.
 * 
 * @constant
 */
export const validateRegistration = [
    body('email')
        .isEmail()
        .withMessage('Invalid email address'),
    body('username')
        .notEmpty()
        .withMessage('Username is required'),
    body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long')
        .matches(/[A-Z]/)
        .withMessage('Password must include at least one uppercase letter')
        .matches(/[a-z]/)
        .withMessage('Password must include at least one lowercase letter')
        .matches(/[0-9]/)
        .withMessage('Password must include at least one number')
        .matches(/[@$!%*?&]/)
        .withMessage('Password must include at least one special character'),
    body('confirmPassword')
        .notEmpty()
        .withMessage('Confirm password is required')
        .custom((value, { req }) => {
            if (value !== req.body.password) {
                throw new Error('Passwords do not match');
            }
            return true;
        }),
];