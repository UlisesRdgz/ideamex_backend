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
 * @access Público (requiere headers x-user-id, x-username y x-project-name)
 */
export const handleProjectUpload = async (req: Request, res: Response): Promise<void> => {
  try {
    const file = req.file;
    const { description } = req.body;

    const userIdHeader = req.headers['x-user-id'];
    const usernameHeader = req.headers['x-username'];
    const projectNameHeader = req.headers['x-project-name'];

    // Validar headers requeridos
    if (
      typeof userIdHeader !== 'string' ||
      typeof usernameHeader !== 'string' ||
      typeof projectNameHeader !== 'string'
    ) {
      sendErrorResponse(res, 'Missing required headers', null, 400);
      return;
    }

    const id_user = parseInt(userIdHeader, 10);
    const username = usernameHeader;
    const projectName = projectNameHeader;

    if (isNaN(id_user)) {
      sendErrorResponse(res, 'Invalid user ID format', null, 400);
      return;
    }

    if (!file) {
      sendErrorResponse(res, 'No file uploaded', null, 400);
      return;
    }

    // Construir la ruta del archivo para la base de datos
    const { relativePath } = buildProjectPath(
      username,
      id_user,
      projectName,
      file.originalname
    );

    // Insertar proyecto en la base de datos
    const id_project = await createProject(
      id_user,
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
