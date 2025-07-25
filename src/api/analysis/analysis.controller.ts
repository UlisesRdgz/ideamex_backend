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

import { Request, Response } from 'express';
import { createProject } from './analysis.service';
import { buildProjectPath } from '../../utils/file';
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
    if (!user || typeof user.username !== 'string' || typeof user.id_user !== 'number') {
      sendErrorResponse(res, 'Missing or invalid user information from token', null, 400);
      return;
    }

    // Validar nombre del proyecto
    if (!projectName || typeof projectName !== 'string') {
      sendErrorResponse(res, 'Missing or invalid project name', null, 400);
      return;
    }

    if (!file) {
      sendErrorResponse(res, 'No file uploaded', null, 400);
      return;
    }

    // Construir la ruta del archivo para la base de datos
    const { relativePath } = buildProjectPath(
      user.username,
      user.id_user,
      projectName,
      file.originalname
    );

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
