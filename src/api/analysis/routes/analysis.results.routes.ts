/**
 * @file Rutas de resultados de análisis.
 *
 * @module api/analysis/routes/analysis.results.routes
 */

import { Router } from 'express';
import {
  handleDownloadProjectResultsArchive,
  handleGetProjectResultFile,
  handleGetProjectResults,
  handleGetProjectResultsStructured,
} from '../controllers/analysis.results.controller';
import { requireUser } from '../../auth/auth.middleware';
import {
  validateProjectIdParam,
  validateRequest,
  validateResultFileQuery,
} from '../../../middlewares/validation.middleware';

const resultsRouter = Router();

resultsRouter.get(
  '/project/:projectId/results',
  requireUser,
  validateProjectIdParam,
  validateRequest,
  handleGetProjectResults
);

resultsRouter.get(
  '/project/:projectId/results/structured',
  requireUser,
  validateProjectIdParam,
  validateRequest,
  handleGetProjectResultsStructured
);

resultsRouter.get(
  '/project/:projectId/results/archive',
  requireUser,
  validateProjectIdParam,
  validateRequest,
  handleDownloadProjectResultsArchive
);

resultsRouter.get(
  '/project/:projectId/results/file',
  requireUser,
  validateProjectIdParam,
  validateResultFileQuery,
  validateRequest,
  handleGetProjectResultFile
);

export default resultsRouter;
