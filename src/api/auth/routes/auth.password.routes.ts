/**
 * @file Rutas de recuperación de contraseña.
 *
 * @module api/auth/routes/auth.password.routes
 *
 * @author Ulises Rodríguez García
 */

import { Router } from 'express';
import {
  requestPasswordReset,
  resetPassword,
} from '../auth.controller';
import {
  validatePasswordReset,
  validatePasswordResetRequest,
  validateRequest,
} from '../../../middlewares/validation.middleware';

const passwordAuthRouter = Router();

passwordAuthRouter.post(
  '/request-password-reset',
  validatePasswordResetRequest,
  validateRequest,
  requestPasswordReset
);

passwordAuthRouter.post(
  '/reset-password',
  validatePasswordReset,
  validateRequest,
  resetPassword
);

export default passwordAuthRouter;
