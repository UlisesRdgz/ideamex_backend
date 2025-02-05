/**
 * @file Rutas para la autenticación de usuarios.
 * Incluye registro de usuarios y activación de cuentas.
 * 
 * @module routes/auth
 * @requires express
 * @requires ../middlewares/validationMiddleware
 * @requires ../middlewares/authMiddleware
 * @requires ../controllers/authController
 * 
 * @author Ulises Rodríguez García
 */

import { Router } from 'express';
import { validateLogin, validatePasswordReset, validatePasswordResetRequest, validateRegistration, validateRequest } from '../middlewares/validationMiddleware';
import { checkEmailExists } from '../middlewares/checkEmailMiddleware';
import { activateUser, googleAuthCallback, loginUser, logoutUser, refreshTokenController, registerUser, requestPasswordReset, resetPassword } from '../controllers/authController';
import passport from 'passport';

const router = Router();

/**
 * Registra un nuevo usuario.
 * 
 * @name POST /register
 * @function
 * @middleware {checkEmailExists} Verifica si el correo ya está registrado.
 * @middleware {validateRegistration} Valida los datos de registro.
 * @middleware {validateRequest} Maneja errores de validación.
 * @controller {registerUser} Controlador para registrar al usuario.
 */
router.post('/register', checkEmailExists, validateRegistration, validateRequest, registerUser);

/**
 * Activa la cuenta de un usuario.
 * 
 * @name GET /activate
 * @function
 * @controller {activateUser} Controlador para activar la cuenta del usuario.
 */
router.get('/activate', activateUser);

/**
 * Inicia sesión.
 * 
 * @name POST /login
 * @function
 * @middleware {validateLogin} Valida los datos del inicio de sesión.
 * @middleware {validateRequest} Maneja errores de validación.
 * @controller {loginUser} Controlador para el inicio de sesión.
 */
router.post('/login', validateLogin, validateRequest, loginUser);

/**
 * Cierra la sesión del usuario.
 * 
 * @name POST /logout
 * @function
 * @controller {logoutUser} Controlador para cerrar la sesión del usuario.
 */
router.post('/logout', logoutUser);

/**
 * Endpoint para refrescar el access token usando el refresh token.
 * 
 * @name POST /refresh
 * @function
 * @controller {refreshTokenController} Controlador para renovar el access token.
 */
router.post('/refresh', refreshTokenController);

/**
 * Solicita un restablecimiento de contraseña.
 * 
 * @name POST /request-password-reset
 * @function
 * @middleware {validatePasswordResetRequest} Valida los datos del correo para el restablecimiento.
 * @middleware {validateRequest} Maneja errores de validación.
 * @controller {requestPasswordReset} Controlador para enviar el token de restablecimiento.
 */
router.post('/request-password-reset', validatePasswordResetRequest, validateRequest, requestPasswordReset);

/**
 * Restablece la contraseña.
 * 
 * @name POST /reset-password
 * @function
 * @middleware {validatePasswordReset} Valida los datos de la solicitud de restablecimiento.
 * @middleware {validateRequest} Maneja errores de validación.
 * @controller {resetPassword} Controlador para actualizar la contraseña.
 */
router.post('/reset-password', validatePasswordReset, validateRequest, resetPassword);

/**
 * Inicia la autenticación con Google.
 * 
 * @name GET /google
 * @function
 * @middleware {passport.authenticate} Middleware de Passport para Google OAuth.
 */
router.get(
    '/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

/**
 * Callback de autenticación con Google.
 * 
 * @name GET /google/callback
 * @function
 * @middleware {passport.authenticate} Middleware de Passport para manejar el callback.
 * @controller {Genera un token JWT y lo envía al cliente}.
 */
router.get(
    '/google/callback',
    passport.authenticate('google', { session: false }),
    googleAuthCallback
);

export default router;