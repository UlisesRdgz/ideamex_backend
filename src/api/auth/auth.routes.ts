/**
 * @file Rutas raíz del módulo de autenticación.
 * Compone sub-rutas por flujo: local, Google y recuperación de contraseña.
 * 
 * @module api/auth/auth.routes
 * @requires express
 * @requires ./routes/auth.local.routes
 * @requires ./routes/auth.google.routes
 * @requires ./routes/auth.password.routes
 * 
 * @author Ulises Rodríguez García
 */

import { Router } from 'express';
import authLocalRoutes from './routes/auth.local.routes';
import authGoogleRoutes from './routes/auth.google.routes';
import authPasswordRoutes from './routes/auth.password.routes';

const router = Router();

router.use(authLocalRoutes);
router.use(authGoogleRoutes);
router.use(authPasswordRoutes);

export default router;
