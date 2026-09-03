/**
 * @file Rutas de ejecución de análisis.
 *
 * @module api/analysis/routes/analysis.run.routes
 *
 * @author Ulises Rodríguez García
 */

import { Router } from 'express';
import { handleRunProjectAnalysis } from '../controllers/analysis.run.controller';
import { requireUser } from '../../auth/auth.middleware';
import {
  validateRunAnalysis,
  validateRequest,
} from '../../../middlewares/validation.middleware';

const runRouter = Router();

runRouter.post(
  '/project/:projectId/run',
  requireUser,
  validateRunAnalysis,
  validateRequest,
  handleRunProjectAnalysis
);

export default runRouter;
