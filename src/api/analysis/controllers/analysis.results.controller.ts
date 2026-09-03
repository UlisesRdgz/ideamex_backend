/**
 * @file Controladores de consulta y descarga de resultados.
 *
 * @module api/analysis/controllers/analysis.results.controller
 *
 * @author Ulises Rodríguez García
 */

import fs from 'fs';
import path from 'path';
import { Request, Response } from 'express';
import { sanitizeName } from '../../../utils/file';
import { sendErrorResponse, sendSuccessResponse } from '../../../utils/response';
import { getProjectById } from '../analysis.service';
import {
  buildStructuredProjectResultsPayload,
  getProjectsBasePath,
  inferMimeType,
  isAllowedResultFile,
  listProjectResultFiles,
  resolveProjectResultArchive,
  resolveResultDirectory,
  resolveResultFilePath,
} from './analysis.shared.controller';

/**
 * Devuelve resultados estructurados de un proyecto finalizado.
 * Recorre la salida de R, clasifica gráficas y tablas por su nombre y arma la
 * respuesta por secciones, para que el frontend no conozca esas convenciones.
 */
export const handleGetProjectResultsStructured = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = req.user;
    const projectId = Number(req.params.projectId);

    if (!user || typeof user.id_user !== 'number') {
      sendErrorResponse(res, 'Missing or invalid user information from token', null, 400);
      return;
    }

    if (Number.isNaN(projectId)) {
      sendErrorResponse(res, 'Invalid project ID', null, 400);
      return;
    }

    const project = await getProjectById(projectId, user.id_user);
    if (!project) {
      sendErrorResponse(res, 'Project not found or access denied', null, 404);
      return;
    }

    // Se exige `COMPLETED` y no basta con que existan archivos: una corrida en
    // curso deja resultados parciales en el disco, y exponerlos daría cifras
    // incompletas con apariencia de definitivas.
    if (project.status !== 'COMPLETED') {
      sendErrorResponse(
        res,
        'Project results are available only after successful analysis completion',
        null,
        409
      );
      return;
    }

    const basePath = getProjectsBasePath();
    // La ruta viene de la base, pero se vuelve a resolver contra la carpeta de
    // proyectos: si el valor almacenado intentara escapar de ella, se descarta.
    const resultDir = resolveResultDirectory(basePath, project);
    if (!resultDir) {
      sendErrorResponse(res, 'Project result path is invalid', null, 500);
      return;
    }

    if (!fs.existsSync(resultDir)) {
      sendErrorResponse(res, 'Result directory not found on server', null, 404);
      return;
    }

    const payload = buildStructuredProjectResultsPayload(req, project, basePath, resultDir);
    sendSuccessResponse(res, 'Project structured results retrieved successfully', payload, 200);
  } catch (error) {
    console.error('Error in handleGetProjectResultsStructured:', error);
    sendErrorResponse(res, 'Server error while retrieving structured project results', null, 500);
  }
};

/**
 * Lista archivos generados por la corrida de un proyecto.
 */
export const handleGetProjectResults = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const projectId = Number(req.params.projectId);

    if (!user || typeof user.id_user !== 'number') {
      sendErrorResponse(res, 'Missing or invalid user information from token', null, 400);
      return;
    }

    if (Number.isNaN(projectId)) {
      sendErrorResponse(res, 'Invalid project ID', null, 400);
      return;
    }

    const project = await getProjectById(projectId, user.id_user);
    if (!project) {
      sendErrorResponse(res, 'Project not found or access denied', null, 404);
      return;
    }

    if (project.status !== 'COMPLETED') {
      sendErrorResponse(
        res,
        'Project results are available only after successful analysis completion',
        null,
        409
      );
      return;
    }

    const basePath = getProjectsBasePath();
    const resultDir = resolveResultDirectory(basePath, project);
    if (!resultDir) {
      sendErrorResponse(res, 'Project result path is invalid', null, 500);
      return;
    }

    if (!fs.existsSync(resultDir)) {
      sendErrorResponse(res, 'Result directory not found on server', null, 404);
      return;
    }

    const files = listProjectResultFiles(resultDir);

    sendSuccessResponse(res, 'Project results retrieved successfully', {
      id: project.id_project,
      status: project.status,
      files,
    });
  } catch (error) {
    console.error('Error in handleGetProjectResults:', error);
    sendErrorResponse(res, 'Server error while retrieving project results', null, 500);
  }
};

/**
 * Descarga el archivo comprimido con todos los resultados del proyecto.
 */
export const handleDownloadProjectResultsArchive = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = req.user;
    const projectId = Number(req.params.projectId);

    if (!user || typeof user.id_user !== 'number') {
      sendErrorResponse(res, 'Missing or invalid user information from token', null, 400);
      return;
    }

    if (Number.isNaN(projectId)) {
      sendErrorResponse(res, 'Invalid project ID', null, 400);
      return;
    }

    const project = await getProjectById(projectId, user.id_user);
    if (!project) {
      sendErrorResponse(res, 'Project not found or access denied', null, 404);
      return;
    }

    if (project.status !== 'COMPLETED') {
      sendErrorResponse(
        res,
        'Project archive is available only after successful analysis completion',
        null,
        409
      );
      return;
    }

    const basePath = getProjectsBasePath();
    const resultDir = resolveResultDirectory(basePath, project);
    if (!resultDir) {
      sendErrorResponse(res, 'Project result path is invalid', null, 500);
      return;
    }

    if (!fs.existsSync(resultDir)) {
      sendErrorResponse(res, 'Result directory not found on server', null, 404);
      return;
    }

    const archive = resolveProjectResultArchive(resultDir);
    if (!archive) {
      sendErrorResponse(
        res,
        'Compressed project archive was not found on server',
        null,
        404
      );
      return;
    }

    // El nombre viaja en una cabecera HTTP, así que se sanitiza: comillas o
    // saltos de línea podrían alterar la respuesta. El respaldo cubre títulos
    // que al sanitizarse quedan vacíos.
    const safeTitle = sanitizeName(project.title) || `project-${project.id_project}`;
    const downloadFileName = `${safeTitle}_results.${archive.extension}`;
    res.setHeader('Content-Disposition', `attachment; filename=\"${downloadFileName}\"`);
    res.type(archive.mime_type);

    res.sendFile(path.resolve(archive.absolute_path), (error) => {
      if (error) {
        console.error('[RESULTS] Error sending project archive:', error);
        if (!res.headersSent) {
          sendErrorResponse(res, 'Error while sending project archive', null, 500);
        }
      }
    });
  } catch (error) {
    console.error('Error in handleDownloadProjectResultsArchive:', error);
    sendErrorResponse(res, 'Server error while downloading project archive', null, 500);
  }
};

/**
 * Sirve un archivo individual de resultados para visualización o descarga.
 * El más delicado del módulo: tres controles lo acotan —proyecto propio, ruta
 * dentro del directorio de resultados y extensión en lista blanca—.
 */
export const handleGetProjectResultFile = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const projectId = Number(req.params.projectId);
    const fileName = typeof req.query.name === 'string' ? req.query.name : '';
    const download =
      typeof req.query.download === 'string'
        ? ['true', '1', 'yes'].includes(req.query.download.trim().toLowerCase())
        : false;

    if (!user || typeof user.id_user !== 'number') {
      sendErrorResponse(res, 'Missing or invalid user information from token', null, 400);
      return;
    }

    if (Number.isNaN(projectId)) {
      sendErrorResponse(res, 'Invalid project ID', null, 400);
      return;
    }

    if (!fileName || fileName.trim().length === 0) {
      sendErrorResponse(res, 'Missing result file name', null, 400);
      return;
    }

    const project = await getProjectById(projectId, user.id_user);
    if (!project) {
      sendErrorResponse(res, 'Project not found or access denied', null, 404);
      return;
    }

    if (project.status !== 'COMPLETED') {
      sendErrorResponse(
        res,
        'Project results are available only after successful analysis completion',
        null,
        409
      );
      return;
    }

    const basePath = getProjectsBasePath();
    const resultDir = resolveResultDirectory(basePath, project);
    if (!resultDir) {
      sendErrorResponse(res, 'Project result path is invalid', null, 500);
      return;
    }

    const resultFilePath = resolveResultFilePath(resultDir, fileName);
    if (!resultFilePath) {
      sendErrorResponse(res, 'Invalid result file path', null, 400);
      return;
    }

    if (!isAllowedResultFile(resultFilePath)) {
      sendErrorResponse(res, 'File type is not allowed for this endpoint', null, 400);
      return;
    }

    if (!fs.existsSync(resultFilePath) || !fs.statSync(resultFilePath).isFile()) {
      sendErrorResponse(res, 'Result file not found', null, 404);
      return;
    }

    const safeFileName = path.basename(resultFilePath);
    const mimeType = inferMimeType(resultFilePath);

    res.setHeader(
      'Content-Disposition',
      `${download ? 'attachment' : 'inline'}; filename=\"${safeFileName}\"`
    );
    res.type(mimeType);

    res.sendFile(path.resolve(resultFilePath), (error) => {
      if (error) {
        console.error('[RESULTS] Error sending file:', error);
        if (!res.headersSent) {
          sendErrorResponse(res, 'Error while sending result file', null, 500);
        }
      }
    });
  } catch (error) {
    console.error('Error in handleGetProjectResultFile:', error);
    sendErrorResponse(res, 'Server error while serving result file', null, 500);
  }
};
