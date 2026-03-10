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
  handleDeleteProject,
  handleRunProjectAnalysis,
  handleGetProjectResults,
  handleGetProjectResultFile,
} from './analysis.controller';
import { uploadProject } from '../../config/multer';
import { requireUser } from '../auth/auth.middleware';
import {
  validateProjectIdParam,
  validateRequest,
  validateResultFileQuery,
  validateRunAnalysis,
} from '../../middlewares/validation.middleware';

const router = Router();

// Flujo de proyectos: alta de archivo, consulta y eliminación.
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

// Flujo de ejecución: valida contrato, bloquea proyecto y arranca análisis en background.
/**
 * @route POST /analysis/project/:projectId/run
 * @desc Inicia la corrida de análisis para un proyecto y lo bloquea
 * @access Privado (requiere autenticación Bearer)
 */
router.post(
  '/project/:projectId/run',
  requireUser,
  validateRunAnalysis,
  validateRequest,
  handleRunProjectAnalysis
);

/**
 * @route GET /analysis/project/:projectId/results
 * @desc Lista archivos de resultados para un proyecto finalizado
 * @access Privado (requiere autenticación Bearer)
 */
router.get(
  '/project/:projectId/results',
  requireUser,
  validateProjectIdParam,
  validateRequest,
  handleGetProjectResults
);

/**
 * @route GET /analysis/project/:projectId/results/file
 * @desc Sirve archivo individual de resultados (inline o descarga)
 * @access Privado (requiere autenticación Bearer)
 */
router.get(
  '/project/:projectId/results/file',
  requireUser,
  validateProjectIdParam,
  validateResultFileQuery,
  validateRequest,
  handleGetProjectResultFile
);

export default router;
