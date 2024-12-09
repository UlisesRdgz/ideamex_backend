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
 * @author Ulises Rodriguez García
 */

import { Router } from 'express';
import { validateRegistration, validateRequest } from '../middlewares/validationMiddleware';
import { checkEmailExists } from '../middlewares/authMiddleware';
import { activateUser, registerUser } from '../controllers/authController';

const router = Router();

/**
 * Ruta para registrar un nuevo usuario.
 * 
 * @name POST /register
 * @middleware {checkEmailExists} Verifica si el correo ya está registrado.
 * @middleware {validateRegistration} Valida los datos del registro.
 * @middleware {validateRequest} Maneja errores de validación.
 * @controller {registerUser} Controlador para registrar al usuario.
 */
router.post('/register', checkEmailExists, validateRegistration, validateRequest, registerUser);

/**
 * Ruta para activar la cuenta de un usuario.
 * 
 * @name GET /activate
 * @controller {activateUser} Controlador para activar la cuenta del usuario.
 */
router.get('/activate', activateUser);

export default router;