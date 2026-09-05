/**
 * @file Middleware de validación usando express-validator.
 * Incluye reglas para autenticación y formularios.
 *
 * Cada arreglo va en la ruta seguido de `validateRequest`, que es quien corta
 * con un 400: las reglas por sí solas únicamente acumulan errores.
 *
 * @module middlewares/validation.middleware
 * @requires express
 * @requires express-validator
 * @requires ../utils/response
 *
 * @author Ulises Rodríguez García
 */

import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
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
    sendErrorResponse(res, 'Validation failed', errors.array(), 400);
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
    .withMessage('Password must be at least 8 characters long')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number')
    .matches(/[@$!%*?&]/)
    .withMessage('Password must contain at least one special character'),
];

/**
 * Reglas de validación para el registro de usuario.
 */
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
    .withMessage('Password confirmation is required')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
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
    .withMessage('Invalid email address'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
];

/**
 * Reglas de validación para inicio de sesión con Google.
 */
export const validateGoogleLogin = [
  body('idToken')
    .isString()
    .withMessage('idToken must be a string')
    .notEmpty()
    .withMessage('idToken is required'),
];

/**
 * Reglas de validación para solicitar recuperación de contraseña.
 */
export const validatePasswordResetRequest = [
  body('email')
    .isEmail()
    .withMessage('Invalid email address'),
];

/**
 * Reglas de validación para reenviar el correo de activación.
 */
export const validateResendActivation = [
  body('email')
    .isEmail()
    .withMessage('Invalid email address'),
];

/**
 * Reglas de validación para restablecer la contraseña con token.
 */
export const validatePasswordReset = [
  body('token')
    .notEmpty()
    .withMessage('Token is required'),
  ...passwordValidationRules(),
];

/**
 * Reglas de validación y sanitización del formulario de contacto.
 * Se valida y limpia cada campo para prevenir errores o inyecciones.
 */
export const validateContactForm = [
  body('fullName')
    .notEmpty()
    .withMessage('Full name is required')
    .isLength({ max: 255 })
    .withMessage('Maximum 255 characters')
    .trim()
    .escape(),

  body('email')
    .notEmpty()
    .withMessage('Email address is required')
    .isEmail()
    .withMessage('Invalid email address')
    .normalizeEmail(),

  body('phone')
    .notEmpty()
    .withMessage('Phone number is required')
    .isMobilePhone('any')
    .withMessage('Invalid phone number')
    .trim()
    .escape(),

  body('subject')
    .notEmpty()
    .withMessage('Subject is required')
    .isLength({ max: 255 })
    .withMessage('Maximum 255 characters')
    .trim()
    .escape(),

  body('message')
    .notEmpty()
    .withMessage('Message is required')
    .isLength({ max: 1000 })
    .withMessage('Maximum 1000 characters')
    .trim()
    .escape(),
];

/**
 * Reglas de validación para ejecutar el análisis de un proyecto.
 * El conjunto más extenso, porque el body trae la configuración completa del
 * experimento. Acepta `methods` (formato anterior) o `selectedMethods`.
 */
export const validateRunAnalysis = [
  param('projectId')
    .isInt({ min: 1 })
    .withMessage('projectId must be a positive integer'),

  // Bloque de contrato estricto: evita ejecutar análisis con payloads parciales.
  body()
    .custom((payload) => {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('Request body must be a valid JSON object');
      }

      const data = payload as Record<string, unknown>;
      // Se permite cualquiera de los dos estilos de selección de métodos.
      const hasMethods = data.methods !== undefined;
      const hasSelectedMethods = data.selectedMethods !== undefined;

      if (!hasMethods && !hasSelectedMethods) {
        throw new Error('Either methods or selectedMethods is required');
      }

      if (!Array.isArray(data.samples) || data.samples.length === 0) {
        throw new Error('samples is required and must contain at least 1 item');
      }

      if (!Array.isArray(data.comparisons) || data.comparisons.length === 0) {
        throw new Error('comparisons is required and must contain at least 1 item');
      }

      if (!data.parameters || typeof data.parameters !== 'object' || Array.isArray(data.parameters)) {
        throw new Error('parameters is required and must be an object');
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
          throw new Error('methods only accepts digits between 1 and 6');
        }

        if (!/[1-5]/.test(value)) {
          throw new Error('methods must include at least one method between 1 and 5');
        }

        // El dígito 6 es la integración, que compara las salidas de los métodos
        // 1 a 4. Pedirla sola no tendría nada que integrar y R fallaría a mitad
        // de la corrida buscando archivos que nadie generó.
        if (value.includes('6') && !/[1-4]/.test(value)) {
          throw new Error('If you include 6 (integration), you must also include at least one DE method (1-4)');
        }

        return true;
      }

      if (!Array.isArray(value)) {
        throw new Error('methods must be a string or an array');
      }

      for (const item of value) {
        if (!item || typeof item !== 'object') {
          throw new Error('Each method must be an object');
        }

        const row = item as Record<string, unknown>;
        // Se valida estructura completa del objeto Method del frontend.
        const name = row.name;
        if (typeof name !== 'string' || name.trim().length === 0) {
          throw new Error('Each method must include name');
        }

        if (typeof row.title !== 'string' || row.title.trim().length === 0) {
          throw new Error('Each method must include title');
        }

        if (typeof row.description !== 'string' || row.description.trim().length === 0) {
          throw new Error('Each method must include description');
        }

        if (typeof row.link !== 'string' || row.link.trim().length === 0) {
          throw new Error('Each method must include link');
        }

        const isSelected = row.isSelected;
        if (typeof isSelected !== 'boolean') {
          throw new Error('isSelected must be a boolean');
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
        throw new Error('selectedMethods must be an object');
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
        throw new Error('parameters is required');
      }

      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('parameters must be an object');
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
        throw new Error('comparisons is required');
      }

      if (!Array.isArray(value)) {
        throw new Error('comparisons must be an array');
      }

      for (const comparison of value) {
        if (!comparison || typeof comparison !== 'object') {
          throw new Error('Each comparison must be an object');
        }

        const row = comparison as Record<string, unknown>;
        // Compatibilidad: se acepta `isCustom` (ProjectRequest) o `selected` (Project).
        if (typeof row.base !== 'string' || row.base.trim().length === 0) {
          throw new Error('comparison.base is required');
        }
        if (typeof row.target !== 'string' || row.target.trim().length === 0) {
          throw new Error('comparison.target is required');
        }

        if (row.isCustom === undefined && row.selected === undefined) {
          // Soporta ambos contratos de frontend sin perder obligatoriedad lógica.
          throw new Error('either comparison.isCustom or comparison.selected is required');
        }

        if (row.isCustom !== undefined && typeof row.isCustom !== 'boolean') {
          throw new Error('comparison.isCustom must be a boolean');
        }

        if (row.selected !== undefined && typeof row.selected !== 'boolean') {
          throw new Error('comparison.selected must be a boolean');
        }
      }

      return true;
    }),

  body('logfc')
    // Compatibilidad legacy: permite enviar umbrales en raíz además de `parameters`.
    .optional()
    .isFloat({ gt: 0 })
    .withMessage('logfc must be a number greater than 0'),

  body('cpm')
    // Compatibilidad legacy: permite enviar umbrales en raíz además de `parameters`.
    .optional()
    .isFloat({ gt: 0 })
    .withMessage('cpm must be a number greater than 0'),

  body('padjust')
    // Compatibilidad legacy: permite enviar umbrales en raíz además de `parameters`.
    .optional()
    .isFloat({ gt: 0, lt: 1 })
    .withMessage('padjust must be a number greater than 0 and less than 1'),

  body('batch')
    // Compatibilidad legacy: acepta vector batch en raíz del body.
    .optional({ nullable: true })
    .isString()
    .withMessage('batch must be a string')
    .matches(/^-?\d+(\.\d+)?(,-?\d+(\.\d+)?)*$/)
    .withMessage('batch must be a comma-separated numeric list'),

  body('generateZip')
    // Compatibilidad legacy: se puede enviar en raíz aunque normalmente venga por `parameters`.
    .optional()
    .isBoolean()
    .withMessage('generateZip must be a boolean'),

  body('top')
    // Compatibilidad legacy: se puede enviar en raíz aunque normalmente venga por `parameters`.
    .optional()
    .isBoolean()
    .withMessage('top must be a boolean'),

  body('samples')
    .custom((value) => {
      if (value === undefined) {
        throw new Error('samples is required');
      }

      if (!Array.isArray(value)) {
        throw new Error('samples must be an array');
      }

      for (const sample of value) {
        if (!sample || typeof sample !== 'object') {
          throw new Error('Each sample must be an object');
        }

        const row = sample as Record<string, unknown>;
        if (typeof row.name !== 'string' || row.name.trim().length === 0) {
          throw new Error('sample.name is required');
        }

        if (
          row.originalName !== undefined &&
          (typeof row.originalName !== 'string' || row.originalName.trim().length === 0)
        ) {
          throw new Error('sample.originalName must be a non-empty string when provided');
        }

        if (row.batch === undefined) {
          throw new Error('sample.batch is required; use null when not applicable');
        }

        if (
          row.batch !== null &&
          typeof row.batch !== 'string' &&
          typeof row.batch !== 'number'
        ) {
          throw new Error('sample.batch must be a string, a number or null');
        }

        if (typeof row.batch === 'string' && row.batch.trim().length === 0) {
          throw new Error('sample.batch cannot be an empty string; use null when not applicable');
        }
      }

      return true;
    }),
];

/**
 * Reglas reutilizables para validar `projectId` en rutas de analysis.
 */
export const validateProjectIdParam = [
  param('projectId')
    .isInt({ min: 1 })
    .withMessage('projectId must be a positive integer'),
];

/**
 * Reglas para validar query params del endpoint de borrado de proyectos.
 */
export const validateDeleteProjectQuery = [
  query('force')
    .optional()
    .custom((value) => {
      if (typeof value !== 'string' && typeof value !== 'boolean') {
        throw new Error('force must be a boolean');
      }

      const normalized = String(value).trim().toLowerCase();
      const allowed = ['true', 'false', '1', '0', 'yes', 'no'];
      if (!allowed.includes(normalized)) {
        throw new Error('force must be true/false/1/0/yes/no');
      }
      return true;
    }),
];

/**
 * Reglas para validar query params del endpoint de archivos de resultados.
 */
export const validateResultFileQuery = [
  query('name')
    .isString()
    .withMessage('name must be a string')
    .notEmpty()
    .withMessage('name is required'),

  query('download')
    .optional()
    .custom((value) => {
      if (typeof value !== 'string') {
        throw new Error('download must be a boolean string');
      }

      const normalized = value.trim().toLowerCase();
      const allowed = ['true', 'false', '1', '0', 'yes', 'no'];
      if (!allowed.includes(normalized)) {
        throw new Error('download must be true/false/1/0/yes/no');
      }
      return true;
    }),
];
