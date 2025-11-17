/**
 * @file Rutas del módulo de autenticación.
 * Define los endpoints públicos para registro, login, activación y recuperación de contraseña.
 * 
 * @module api/auth/auth.routes
 */

import { Router } from 'express';
import {
  registerUser,
  activateUser,
  loginUser,
  requestPasswordReset,
  resetPassword,
} from './auth.controller';
import {
  validateRegistration,
  validateLogin,
  validateRequest,
  validatePasswordResetRequest,
  validatePasswordReset,
} from '../../middlewares/validation.middleware';
import { checkEmailExists } from './auth.middleware';

const router = Router();

/**
 * @route POST /auth/register
 * @desc Registra un nuevo usuario local
 * @access Público
 */
router.post(
  '/register',
  validateRegistration,
  validateRequest,
  checkEmailExists,
  registerUser
);

/**
 * @route GET /auth/activate
 * @desc Activa una cuenta mediante token
 * @access Público
 */
router.get('/activate', activateUser);

/**
 * @route POST /auth/login
 * @desc Inicia sesión para usuarios locales
 * @access Público
 */
router.post(
  '/login',
  validateLogin,
  validateRequest,
  loginUser
);

/**
 * @route POST /auth/request-password-reset
 * @desc Solicita restablecimiento de contraseña por correo
 * @access Público
 */
router.post(
  '/request-password-reset',
  validatePasswordResetRequest,
  validateRequest,
  requestPasswordReset
);

/**
 * @route POST /auth/reset-password
 * @desc Establece nueva contraseña con token válido
 * @access Público
 */
router.post(
  '/reset-password',
  validatePasswordReset,
  validateRequest,
  resetPassword
);

export default router;
