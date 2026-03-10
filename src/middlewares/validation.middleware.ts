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
    // Retorna arreglo detallado para que frontend/Postman sepan qué campo falló.
    sendErrorResponse(res, 'Validación fallida', errors.array(), 400);
    return;
  }
  // Continúa al controlador solo cuando no hay errores.
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
 * Reglas de validación para inicio de sesión con Google.
 */
export const validateGoogleLogin = [
  body('idToken')
    .isString()
    .withMessage('idToken debe ser una cadena')
    .notEmpty()
    .withMessage('idToken es obligatorio'),
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

  // Bloque de contrato estricto: evita ejecutar análisis con payloads parciales.
  body()
    .custom((payload) => {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('El body debe ser un objeto JSON válido');
      }

      const data = payload as Record<string, unknown>;
      // Se permite cualquiera de los dos estilos de selección de métodos.
      const hasMethods = data.methods !== undefined;
      const hasSelectedMethods = data.selectedMethods !== undefined;

      if (!hasMethods && !hasSelectedMethods) {
        throw new Error('Debes enviar methods o selectedMethods');
      }

      if (!Array.isArray(data.samples) || data.samples.length === 0) {
        throw new Error('samples es obligatorio y debe contener al menos 1 elemento');
      }

      if (!Array.isArray(data.comparisons) || data.comparisons.length === 0) {
        throw new Error('comparisons es obligatorio y debe contener al menos 1 elemento');
      }

      if (!data.parameters || typeof data.parameters !== 'object' || Array.isArray(data.parameters)) {
        throw new Error('parameters es obligatorio y debe ser un objeto');
      }

      return true;
    }),

  body('methods')
    .custom((value) => {
      // Si el cliente usa `selectedMethods`, `methods` puede omitirse.
      if (value === undefined) {
        return true;
      }

      if (typeof value === 'string') {
        // Valida inmediatamente formato compacto legacy.
        if (!/^[1-6]+$/.test(value)) {
          throw new Error('methods solo permite dígitos entre 1 y 6');
        }

        if (!/[1-5]/.test(value)) {
          throw new Error('methods debe incluir al menos un método entre 1 y 5');
        }

        if (value.includes('6') && !/[1-4]/.test(value)) {
          throw new Error('Si incluyes 6 (integración), también debes incluir al menos un método DE (1-4)');
        }

        return true;
      }

      if (!Array.isArray(value)) {
        throw new Error('methods debe ser string o arreglo');
      }

      for (const item of value) {
        if (!item || typeof item !== 'object') {
          throw new Error('Cada método debe ser un objeto');
        }

        const row = item as Record<string, unknown>;
        // Se valida estructura completa del objeto Method del frontend.
        const name = row.name;
        if (typeof name !== 'string' || name.trim().length === 0) {
          throw new Error('Cada método debe incluir name');
        }

        if (typeof row.title !== 'string' || row.title.trim().length === 0) {
          throw new Error('Cada método debe incluir title');
        }

        if (typeof row.description !== 'string' || row.description.trim().length === 0) {
          throw new Error('Cada método debe incluir description');
        }

        if (typeof row.link !== 'string' || row.link.trim().length === 0) {
          throw new Error('Cada método debe incluir link');
        }

        const isSelected = row.isSelected;
        if (typeof isSelected !== 'boolean') {
          throw new Error('isSelected debe ser booleano');
        }
      }

      return true;
    }),

  body('selectedMethods')
    .custom((value) => {
      // Si el cliente manda `methods[]`, `selectedMethods` puede omitirse.
      if (value === undefined) {
        return true;
      }

      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('selectedMethods debe ser un objeto');
      }

      const allowedKeys = [
        'edgeR',
        'limma',
        'noiseq',
        'deseq2',
        'dataAnalysis',
        'integrationResults',
      ];

      const row = value as Record<string, unknown>;
      // En formato selection, todas las llaves conocidas son obligatorias.
      for (const key of allowedKeys) {
        if (!(key in row)) {
          throw new Error(`selectedMethods.${key} es obligatorio`);
        }
      }

      for (const key of Object.keys(row)) {
        if (!allowedKeys.includes(key)) {
          throw new Error(`selectedMethods contiene clave no permitida: ${key}`);
        }

        const fieldValue = row[key];
        if (typeof fieldValue !== 'boolean') {
          throw new Error(`selectedMethods.${key} debe ser booleano`);
        }
      }

      return true;
    }),

  body('parameters')
    .custom((value) => {
      if (value === undefined) {
        throw new Error('parameters es obligatorio');
      }

      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('parameters debe ser un objeto');
      }

      const params = value as Record<string, unknown>;
      // Campos del contrato AnalysisParameters.
      const requiredNumericFields = ['fdr', 'logFC', 'cpm'];
      const requiredBooleanFields = ['top', 'corrplot'];
      const optionalNumericFields = ['padjust', 'logfc'];
      const optionalBooleanFields = ['generateZip'];

      for (const field of requiredNumericFields) {
        if (params[field] === undefined || params[field] === null || String(params[field]).trim() === '') {
          throw new Error(`parameters.${field} es obligatorio`);
        }
        if (Number.isNaN(Number(params[field]))) {
          throw new Error(`parameters.${field} debe ser numérico`);
        }
      }

      for (const field of requiredBooleanFields) {
        if (params[field] === undefined) {
          throw new Error(`parameters.${field} es obligatorio`);
        }
        if (typeof params[field] !== 'boolean') {
          throw new Error(`parameters.${field} debe ser booleano`);
        }
      }

      for (const field of optionalNumericFields) {
        if (params[field] !== undefined && Number.isNaN(Number(params[field]))) {
          throw new Error(`parameters.${field} debe ser numérico`);
        }
      }

      for (const field of optionalBooleanFields) {
        if (params[field] !== undefined && typeof params[field] !== 'boolean') {
          throw new Error(`parameters.${field} debe ser booleano`);
        }
      }

      return true;
    }),

  body('comparisons')
    .custom((value) => {
      if (value === undefined) {
        throw new Error('comparisons es obligatorio');
      }

      if (!Array.isArray(value)) {
        throw new Error('comparisons debe ser un arreglo');
      }

      for (const comparison of value) {
        if (!comparison || typeof comparison !== 'object') {
          throw new Error('Cada comparison debe ser un objeto');
        }

        const row = comparison as Record<string, unknown>;
        // Compatibilidad: se acepta `isCustom` (ProjectRequest) o `selected` (Project).
        if (typeof row.base !== 'string' || row.base.trim().length === 0) {
          throw new Error('comparison.base es obligatorio');
        }
        if (typeof row.target !== 'string' || row.target.trim().length === 0) {
          throw new Error('comparison.target es obligatorio');
        }

        if (row.isCustom === undefined && row.selected === undefined) {
          // Soporta ambos contratos de frontend sin perder obligatoriedad lógica.
          throw new Error('comparison.isCustom o comparison.selected es obligatorio');
        }

        if (row.isCustom !== undefined && typeof row.isCustom !== 'boolean') {
          throw new Error('comparison.isCustom debe ser booleano');
        }

        if (row.selected !== undefined && typeof row.selected !== 'boolean') {
          throw new Error('comparison.selected debe ser booleano');
        }
      }

      return true;
    }),

  body('logfc')
    // Compatibilidad legacy: permite enviar umbrales en raíz además de `parameters`.
    .optional()
    .isFloat({ gt: 0 })
    .withMessage('logfc debe ser un número mayor a 0'),

  body('cpm')
    // Compatibilidad legacy: permite enviar umbrales en raíz además de `parameters`.
    .optional()
    .isFloat({ gt: 0 })
    .withMessage('cpm debe ser un número mayor a 0'),

  body('padjust')
    // Compatibilidad legacy: permite enviar umbrales en raíz además de `parameters`.
    .optional()
    .isFloat({ gt: 0, lt: 1 })
    .withMessage('padjust debe ser un número mayor a 0 y menor a 1'),

  body('batch')
    // Compatibilidad legacy: acepta vector batch en raíz del body.
    .optional({ nullable: true })
    .isString()
    .withMessage('batch debe ser una cadena')
    .matches(/^-?\d+(\.\d+)?(,-?\d+(\.\d+)?)*$/)
    .withMessage('batch debe ser una lista numérica separada por comas'),

  body('generateZip')
    // Compatibilidad legacy: se puede enviar en raíz aunque normalmente venga por `parameters`.
    .optional()
    .isBoolean()
    .withMessage('generateZip debe ser booleano'),

  body('top')
    // Compatibilidad legacy: se puede enviar en raíz aunque normalmente venga por `parameters`.
    .optional()
    .isBoolean()
    .withMessage('top debe ser booleano'),

  body('samples')
    .custom((value) => {
      if (value === undefined) {
        throw new Error('samples es obligatorio');
      }

      if (!Array.isArray(value)) {
        throw new Error('samples debe ser un arreglo');
      }

      for (const sample of value) {
        if (!sample || typeof sample !== 'object') {
          throw new Error('Cada sample debe ser un objeto');
        }

        const row = sample as Record<string, unknown>;
        // `batch` ahora es obligatorio para mantener paridad con el contrato de muestras.
        if (typeof row.name !== 'string' || row.name.trim().length === 0) {
          throw new Error('sample.name es obligatorio');
        }

        if (row.batch === undefined || row.batch === null || String(row.batch).trim() === '') {
          // Batch obligatorio para coherencia con validación posterior del archivo.
          throw new Error('sample.batch es obligatorio');
        }

        if (typeof row.batch !== 'string' && typeof row.batch !== 'number') {
          throw new Error('sample.batch debe ser string o number');
        }
      }

      return true;
    }),
];
