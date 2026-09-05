/**
 * @file Rutas de ciclo de vida de proyectos de análisis.
 *
 * @module api/analysis/routes/analysis.projects.routes
 *
 * @author Ulises Rodríguez García
 */

import { Router } from 'express';
import {
  handleDeleteProject,
  handleGetUserProjects,
  handleProjectUpload,
  handleSaveProjectConfig,
} from '../controllers/analysis.projects.controller';
import { uploadProject } from '../../../config/multer';
import { requireUser } from '../../auth/auth.middleware';
import {
  validateDeleteProjectQuery,
  validateProjectIdParam,
  validateRequest,
  validateSaveProjectConfig,
} from '../../../middlewares/validation.middleware';

const projectsRouter = Router();

projectsRouter.post(
  '/upload',
  requireUser,
  uploadProject.single('file'),
  handleProjectUpload
);

projectsRouter.patch(
  '/project/:projectId/config',
  requireUser,
  validateSaveProjectConfig,
  validateRequest,
  handleSaveProjectConfig
);

projectsRouter.get(
  '/user-projects',
  requireUser,
  handleGetUserProjects
);

projectsRouter.delete(
  '/project/:projectId',
  requireUser,
  validateProjectIdParam,
  validateDeleteProjectQuery,
  validateRequest,
  handleDeleteProject
);

export default projectsRouter;
