/**
 * @file Rutas del módulo de análisis.
 * Define los endpoints para subir, listar y eliminar archivos de proyectos asociados a usuarios autenticados.
 * 
 * @module api/analysis/analysis.routes
 * @requires express
 * @requires ./analysis.controller
 * @requires ../../config/multer
 * @requires ../../middlewares/requireUser
 * 
 * @author Ulises Rodríguez García
 */

import { Router } from 'express';
import {
  handleProjectUpload,
  handleGetUserProjects,
  handleDeleteProject
} from './analysis.controller';
import { uploadProject } from '../../config/multer';
import { requireUser } from '../auth/auth.middleware';

const router = Router();

/**
 * @route POST /analysis/upload
 * @desc Sube un archivo y registra un nuevo proyecto del usuario autenticado
 * @access Privado (requiere token Bearer)
 */
router.post(
  '/upload',
  requireUser,
  uploadProject.single('file'),
  handleProjectUpload
);

/**
 * @route GET /analysis/user-projects
 * @desc Lista todos los proyectos del usuario autenticado
 * @access Privado (requiere autenticación Bearer)
 */
router.get(
  '/user-projects',
  requireUser,
  handleGetUserProjects
);

/**
 * @route DELETE /analysis/project/:projectId
 * @desc Elimina un proyecto del usuario autenticado (base de datos + carpeta)
 * @access Privado (requiere autenticación Bearer)
 */
router.delete(
  '/project/:projectId',
  requireUser,
  handleDeleteProject
);

export default router;