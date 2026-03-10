/**
 * @file Rutas del módulo de autenticación.
 * Define los endpoints públicos para registro, login, activación y recuperación de contraseña.
 * 
 * @module api/auth/auth.routes
 * @requires express
 * @requires ./auth.controller
 * @requires ./auth.middleware
 * @requires ../../middlewares/validation.middleware
 * 
 * @author Ulises Rodríguez García
 */

import { Router } from 'express';
import {
  registerUser,
  activateUser,
  loginUser,
  startGoogleOAuth,
  handleGoogleOAuthCallback,
  loginWithGoogle,
  requestPasswordReset,
  resetPassword,
} from './auth.controller';
import {
  validateRegistration,
  validateLogin,
  validateGoogleLogin,
  validateRequest,
  validatePasswordResetRequest,
  validatePasswordReset,
} from '../../middlewares/validation.middleware';
import {
  checkEmailExists,
} from './auth.middleware';

const router = Router();

// Flujo local: registro -> activación -> login.
/**
 * @route POST /api/v1/ideamex/auth/register
 * @desc Registra un nuevo usuario local
 * @access Público
 */
router.post(
  '/register',
  checkEmailExists,
  validateRegistration,
  validateRequest,
  registerUser
);

/**
 * @route GET /api/v1/ideamex/auth/activate
 * @desc Activa una cuenta mediante token
 * @access Público
 */
router.get('/activate', activateUser);

/**
 * @route POST /api/v1/ideamex/auth/login
 * @desc Inicia sesión para usuarios locales
 * @access Público
 */
router.post(
  '/login',
  validateLogin,
  validateRequest,
  loginUser
);

// Flujo OAuth Google: start -> callback (y soporte idToken legacy).
/**
 * @route GET /api/v1/ideamex/auth/google
 * @desc Inicia OAuth2 con Google (redirección)
 * @access Público
 */
router.get('/google', startGoogleOAuth);

/**
 * @route GET /api/v1/ideamex/auth/google/callback
 * @desc Callback OAuth2 de Google
 * @access Público
 */
router.get('/google/callback', handleGoogleOAuthCallback);

/**
 * @route POST /api/v1/ideamex/auth/google/login
 * @desc Inicia sesión con token de Google (idToken)
 * @access Público
 */
router.post(
  '/google/login',
  validateGoogleLogin,
  validateRequest,
  loginWithGoogle
);

// Flujo de recuperación de contraseña para cuentas locales.
/**
 * @route POST /api/v1/ideamex/auth/request-password-reset
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
 * @route POST /api/v1/ideamex/auth/reset-password
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
