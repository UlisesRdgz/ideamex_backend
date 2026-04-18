/**
 * @file Rutas de autenticación con Google.
 *
 * @module api/auth/routes/auth.google.routes
 */

import { Router } from 'express';
import {
  handleGoogleOAuthCallback,
  loginWithGoogle,
  startGoogleOAuth,
} from '../auth.controller';
import {
  validateGoogleLogin,
  validateRequest,
} from '../../../middlewares/validation.middleware';

const googleAuthRouter = Router();

googleAuthRouter.get('/google', startGoogleOAuth);
googleAuthRouter.get('/google/callback', handleGoogleOAuthCallback);
googleAuthRouter.post(
  '/google/login',
  validateGoogleLogin,
  validateRequest,
  loginWithGoogle
);

export default googleAuthRouter;
