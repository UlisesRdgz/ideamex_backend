/**
 * @file Barrel de controladores del módulo de autenticación.
 * Permite mantener imports existentes mientras la implementación se divide por flujo.
 *
 * @module api/auth/auth.controller
 *
 * @author Ulises Rodríguez García
 */

export {
  registerUser,
  activateUser,
  loginUser,
} from './controllers/auth.local.controller';

export {
  startGoogleOAuth,
  handleGoogleOAuthCallback,
  loginWithGoogle,
} from './controllers/auth.google.controller';

export {
  requestPasswordReset,
  resetPassword,
} from './controllers/auth.password.controller';
