/**
 * @file Middleware de validación usando express-validator.
 * Incluye reglas para autenticación y formularios.
 * 
 * @module middlewares/validation.middleware
 * @requires express
 * @requires express-validator
 * @requires ../utils/response
 * 
 * @author Ulises Rodríguez García
 */

import { Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import { sendErrorResponse } from '../utils/response';

/**
 * Middleware que valida el resultado de las comprobaciones realizadas sobre la solicitud.
 * Si se encuentran errores, responde con estado 400 y los detalles de validación.
 * 
 * @function validateRequest
 * @param req - Objeto de solicitud de Express.
 * @param res - Objeto de respuesta de Express.
 * @param next - Función para continuar con la siguiente capa del middleware.
 */
export const validateRequest = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    sendErrorResponse(res, 'Validación fallida', errors.array(), 400);
    return;
  }
  next();
};

/**
 * Reglas comunes para validar contraseñas seguras.
 * Las contraseñas deben contener longitud mínima, mayúsculas, minúsculas, números y caracteres especiales.
 */
export const passwordValidationRules = () => [
  body('password')
    .isLength({ min: 8 })
    .withMessage('La contraseña debe tener al menos 8 caracteres')
    .matches(/[A-Z]/)
    .withMessage('Debe contener al menos una letra mayúscula')
    .matches(/[a-z]/)
    .withMessage('Debe contener al menos una letra minúscula')
    .matches(/[0-9]/)
    .withMessage('Debe contener al menos un número')
    .matches(/[@$!%*?&]/)
    .withMessage('Debe contener al menos un caracter especial'),
];

/**
 * Reglas de validación para el registro de usuario.
 */
export const validateRegistration = [
  body('email')
    .isEmail()
    .withMessage('Correo electrónico inválido'),
  body('username')
    .notEmpty()
    .withMessage('El nombre de usuario es obligatorio'),
  ...passwordValidationRules(),
  body('confirmPassword')
    .notEmpty()
    .withMessage('La confirmación de contraseña es obligatoria')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Las contraseñas no coinciden');
      }
      return true;
    }),
];

/**
 * Reglas de validación para el inicio de sesión de usuario.
 */
export const validateLogin = [
  body('email')
    .isEmail()
    .withMessage('Correo electrónico inválido'),
  body('password')
    .notEmpty()
    .withMessage('La contraseña es obligatoria'),
];

/**
 * Reglas de validación para solicitar recuperación de contraseña.
 */
export const validatePasswordResetRequest = [
  body('email')
    .isEmail()
    .withMessage('Correo electrónico inválido'),
];

/**
 * Reglas de validación para restablecer la contraseña con token.
 */
export const validatePasswordReset = [
  body('token')
    .notEmpty()
    .withMessage('El token es obligatorio'),
  ...passwordValidationRules(),
];

/**
 * Reglas de validación y sanitización del formulario de contacto.
 * Se valida y limpia cada campo para prevenir errores o inyecciones.
 */
export const validateContactForm = [
  body('fullName')
    .notEmpty()
    .withMessage('El nombre completo es obligatorio')
    .isLength({ max: 255 })
    .withMessage('Máximo 255 caracteres')
    .trim()
    .escape(),

  body('email')
    .notEmpty()
    .withMessage('El correo electrónico es obligatorio')
    .isEmail()
    .withMessage('Correo electrónico inválido')
    .normalizeEmail(),

  body('phone')
    .notEmpty()
    .withMessage('El número telefónico es obligatorio')
    .isMobilePhone('any')
    .withMessage('Número de teléfono inválido')
    .trim()
    .escape(),

  body('subject')
    .notEmpty()
    .withMessage('El asunto es obligatorio')
    .isLength({ max: 255 })
    .withMessage('Máximo 255 caracteres')
    .trim()
    .escape(),

  body('message')
    .notEmpty()
    .withMessage('El mensaje es obligatorio')
    .isLength({ max: 1000 })
    .withMessage('Máximo 1000 caracteres')
    .trim()
    .escape(),
];

/**
 * Reglas de validación para ejecutar el análisis de un proyecto.
 */
export const validateRunAnalysis = [
  param('projectId')
    .isInt({ min: 1 })
    .withMessage('El projectId debe ser un entero positivo'),

  body('methods')
    .optional()
    .isString()
    .withMessage('methods debe ser una cadena')
    .matches(/^[1-6]+$/)
    .withMessage('methods solo permite dígitos entre 1 y 6')
    .custom((value: string) => /[1-5]/.test(value))
    .withMessage('methods debe incluir al menos un método entre 1 y 5')
    .custom((value: string) => !value.includes('6') || /[1-4]/.test(value))
    .withMessage('Si incluyes 6 (integración), también debes incluir al menos un método DE (1-4)'),

  body('logfc')
    .optional()
    .isFloat({ gt: 0 })
    .withMessage('logfc debe ser un número mayor a 0'),

  body('cpm')
    .optional()
    .isFloat({ gt: 0 })
    .withMessage('cpm debe ser un número mayor a 0'),

  body('padjust')
    .optional()
    .isFloat({ gt: 0, lt: 1 })
    .withMessage('padjust debe ser un número mayor a 0 y menor a 1'),

  body('batch')
    .optional({ nullable: true })
    .isString()
    .withMessage('batch debe ser una cadena')
    .matches(/^-?\d+(\.\d+)?(,-?\d+(\.\d+)?)*$/)
    .withMessage('batch debe ser una lista numérica separada por comas'),

  body('generateZip')
    .optional()
    .isBoolean()
    .withMessage('generateZip debe ser booleano'),

  body('top')
    .optional()
    .isBoolean()
    .withMessage('top debe ser booleano'),
];
