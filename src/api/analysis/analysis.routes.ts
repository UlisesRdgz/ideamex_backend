/**
 * @file Rutas del módulo de análisis.
 * Define el endpoint para subir archivos de proyectos asociados a usuarios autenticados.
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
import { handleProjectUpload } from './analysis.controller';
import { uploadProject } from '../../config/multer';
import { requireUser } from '../auth/auth.middleware';

const router = Router();

/**
 * @route POST /analysis/upload
 * @desc Sube un archivo y registra un nuevo proyecto del usuario autenticado
 * @access Público (requiere headers x-user-id y x-username)
 */
router.post(
  '/upload',
  requireUser,
  uploadProject.single('file'),
  handleProjectUpload
);

export default router;
