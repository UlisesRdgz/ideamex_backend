/**
 * @file Rutas de autenticación local.
 *
 * @module api/auth/routes/auth.local.routes
 *
 * @author Ulises Rodríguez García
 */

import { Router } from 'express';
import {
  activateUser,
  loginUser,
  registerUser,
} from '../auth.controller';
import {
  validateLogin,
  validateRegistration,
  validateRequest,
} from '../../../middlewares/validation.middleware';
import { checkEmailExists } from '../auth.middleware';

const localAuthRouter = Router();

localAuthRouter.post(
  '/register',
  checkEmailExists,
  validateRegistration,
  validateRequest,
  registerUser
);

localAuthRouter.get('/activate', activateUser);

localAuthRouter.post(
  '/login',
  validateLogin,
  validateRequest,
  loginUser
);

export default localAuthRouter;
