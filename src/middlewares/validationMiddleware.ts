/**
 * @file Middleware para la validación de solicitudes y datos de registro.
 * Incluye validación de campos y manejo de errores.
 * 
 * @module middlewares/validationMiddleware
 * @requires express
 * @requires express-validator
 * 
 * @author Ulises Rodríguez García
 */

import { Request, Response, NextFunction } from 'express';
import { validationResult, body } from 'express-validator';
import { sendErrorResponse } from '../utils/responseUtils';

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
        sendErrorResponse(res, 'Validation failed', errors.array(), 400);
        return;
    }
    next();
};

/**
 * Reglas de validación para contraseñas seguras.
 * Incluyen requisitos de longitud, mayúsculas, minúsculas, números y caracteres especiales.
 */
export const passwordValidationRules = () => [
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
];

export const validateRegistration = [
    body('email')
        .isEmail()
        .withMessage('Invalid email address'),
    body('username')
        .notEmpty()
        .withMessage('Username is required'),
    ...passwordValidationRules(),
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

export const validateLogin = [
    body('email')
        .isEmail()
        .withMessage('Invalid email address'),
    body('password')
        .notEmpty()
        .withMessage('Password is required'),
];

export const validatePasswordResetRequest = [
    body('email')
        .isEmail()
        .withMessage('Invalid email address'),
];

export const validatePasswordReset = [
    body('token')
        .notEmpty()
        .withMessage('Token is required'),
    ...passwordValidationRules(),
];

/**
 * Reglas de validación para el formulario de contacto.
 */
export const validateContactForm = [
    // Sanitización y validación del campo 'fullName'
    body('fullName')
        .notEmpty()
        .withMessage('Full name is required')
        .isLength({ max: 255 })
        .withMessage('Full name must be less than 255 characters')
        .trim() 
        .escape(),

    // Sanitización y validación del campo 'email'
    body('email')
        .notEmpty()
        .withMessage('Email is required')
        .isEmail()
        .withMessage('Invalid email address')
        .normalizeEmail(),

    // Sanitización y validación del campo 'phone'
    body('phone')
        .notEmpty()
        .withMessage('Phone number is required')
        .isMobilePhone('any')
        .withMessage('Invalid phone number')
        .trim() 
        .escape(),

    // Sanitización y validación del campo 'subject'
    body('subject')
        .notEmpty()
        .withMessage('Subject is required')
        .isLength({ max: 255 })
        .withMessage('Subject must be less than 255 characters')
        .trim() 
        .escape(),

    // Sanitización y validación del campo 'message'
    body('message')
        .notEmpty()
        .withMessage('Message is required')
        .isLength({ max: 1000 })
        .withMessage('Message must be less than 1000 characters')
        .trim() 
        .escape(),
];