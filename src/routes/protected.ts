import { Router, Request, Response } from 'express';
import { requireAuth } from '../middlewares/authMiddleware';
import { sendSuccessResponse } from '../utils/responseUtils';

const router = Router();

/**
 * Endpoint de prueba protegido.
 * Solo se puede acceder si el usuario está autenticado.
 *
 * @name GET /api/protected/test
 * @function
 * @middleware {requireAuth} Verifica que el usuario tenga un token válido.
 * @returns {Object} Mensaje y datos opcionales del usuario.
 */
router.get('/test', requireAuth, (req: Request, res: Response) => {
  sendSuccessResponse(res, 'Acceso autorizado: estás autenticado.', {
      user: req.user,
  });
});

export default router;
