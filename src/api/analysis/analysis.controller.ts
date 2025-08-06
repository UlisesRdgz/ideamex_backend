/**
 * @file Controlador del módulo de análisis.
 * Maneja la carga de archivos y el registro de proyectos asociados a usuarios.
 * 
 * @module api/analysis/analysis.controller
 * @requires express
 * @requires ../../utils/file
 * @requires ../../utils/response
 * @requires ./analysis.service
 * 
 * @author Ulises Rodríguez García
 */

import fs from 'fs';
import path from 'path';
import { Request, Response } from 'express';
import {
  createProject,
  projectExists,
  getProjectsByUser,
  getProjectPathById,
  deleteProjectById,
} from './analysis.service';
import { sendErrorResponse, sendSuccessResponse } from '../../utils/response';

/**
 * Controlador para manejar la carga de un nuevo proyecto.
 * Valida los datos, construye la ruta de almacenamiento y registra el proyecto en la base de datos.
 * 
 * @route POST /analysis/upload
 * @access Privado (requiere autenticación Bearer y campo `projectName` en body)
 */
export const handleProjectUpload = async (req: Request, res: Response): Promise<void> => {
  try {
    const file = req.file;
    const { description, projectName } = req.body;

    const user = req.user;

    // Validar usuario autenticado
    if (!user || typeof user.email !== 'string' || typeof user.id_user !== 'number') {
      sendErrorResponse(res, 'Missing or invalid user information from token', null, 400);
      return;
    }

    // Validar nombre del proyecto
    if (!projectName || typeof projectName !== 'string') {
      sendErrorResponse(res, 'Missing or invalid project name', null, 400);
      return;
    }

    // Validar archivo
    if (!file) {
      sendErrorResponse(res, 'No file uploaded', null, 400);
      return;
    }

    // Verificar duplicado
    const alreadyExists = await projectExists(user.id_user, projectName);
    if (alreadyExists) {
      sendErrorResponse(res, 'A project with the same name already exists', null, 409);
      return;
    }

    // Construir la ruta relativa del archivo como se guardó realmente por multer
    const emailPrefix = user.email.split('@')[0];
    const projectFolder = projectName.replace(/\s+/g, '_').toLowerCase();
    const relativePath = `${emailPrefix}/${projectFolder}/${file.filename}`;

    // Insertar proyecto en la base de datos
    const id_project = await createProject(
      user.id_user,
      projectName,
      description || null,
      'active',
      relativePath
    );

    sendSuccessResponse(
      res,
      'Project uploaded successfully',
      {
        id_project,
        name: projectName,
        path: relativePath,
      },
      201
    );
  } catch (error) {
    console.error('Error in handleProjectUpload:', error);
    sendErrorResponse(res, 'Server error during project upload', null, 500);
  }
};

/**
 * Controlador para obtener todos los proyectos de un usuario autenticado.
 * 
 * @route GET /analysis/projects
 * @access Privado (requiere autenticación Bearer)
 */
export const handleGetUserProjects = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;

    if (!user || typeof user.id_user !== 'number') {
      sendErrorResponse(res, 'Missing or invalid user information from token', null, 400);
      return;
    }

    const projects = await getProjectsByUser(user.id_user);

    sendSuccessResponse(res, 'User projects retrieved successfully', projects, 200);
  } catch (error) {
    console.error('Error in handleGetUserProjects:', error);
    sendErrorResponse(res, 'Server error while retrieving projects', null, 500);
  }
};

/**
 * Controlador para eliminar un proyecto del usuario autenticado.
 * Elimina tanto el registro en la base de datos como la carpeta del sistema de archivos.
 *
 * @route DELETE /analysis/project/:projectId
 * @access Privado (requiere autenticación Bearer)
 */
export const handleDeleteProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const projectId = Number(req.params.projectId);

    if (!user || typeof user.id_user !== 'number') {
      sendErrorResponse(res, 'Missing or invalid user information from token', null, 400);
      return;
    }

    if (isNaN(projectId)) {
      sendErrorResponse(res, 'Invalid project ID', null, 400);
      return;
    }
    
    const relativePath = await getProjectPathById(projectId, user.id_user);

    if (!relativePath) {
      sendErrorResponse(res, 'Project not found or access denied', null, 404);
      return;
    }

    const basePath = process.env.PROJECTS_BASE_PATH || path.resolve(__dirname, '../../../../projects');
    const folderPath = path.join(basePath, ...relativePath.split('/').slice(0, -1));

    try {
      if (fs.existsSync(folderPath)) {
        fs.rmSync(folderPath, { recursive: true, force: true });
      }
    } catch (err) {
      console.error('[FS] Error removing project folder:', err);
      sendErrorResponse(res, 'Error deleting project folder from filesystem', null, 500);
      return;
    }

    await deleteProjectById(projectId, user.id_user);

    sendSuccessResponse(res, 'Project deleted successfully');
  } catch (error) {
    console.error('Error in handleDeleteProject:', error);
    sendErrorResponse(res, 'Server error during project deletion', null, 500);
  }
};