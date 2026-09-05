/**
 * @file Controladores de ciclo de vida de proyecto de análisis.
 *
 * @module api/analysis/controllers/analysis.projects.controller
 *
 * @author Ulises Rodríguez García
 */

import fs from 'fs';
import path from 'path';
import { Request, Response } from 'express';
import { ensureDirectory, sanitizeEmailPrefix, sanitizeName } from '../../../utils/file';
import { validateCountTableFile } from '../../../utils/countTable';
import { sendErrorResponse, sendSuccessResponse } from '../../../utils/response';
import {
  ProjectJsonPayload,
  ProjectRunConfigPayload,
  createProject,
  deleteProjectById,
  getProjectById,
  getProjectsByUser,
  projectExists,
  saveProjectDraftConfig,
} from '../analysis.service';
import { UploadProjectPayloadLike } from '../analysis.types';
import {
  extractUploadImageUrl,
  getProjectsBasePath,
  isDuplicateEntryError,
  resolveProjectAbsolutePath,
  resolveProjectDirectoryCandidates,
} from './analysis.shared.controller';

/**
 * Controlador para manejar la carga de un nuevo proyecto.
 *
 * Cuando esto corre, multer ya escribió el archivo en la carpeta de tránsito.
 * El orden importa: primero se valida el contenido y solo un archivo correcto se
 * traslada a la carpeta del proyecto, de modo que una tabla rechazada nunca
 * queda almacenada. Cada rama de error retira el archivo de tránsito.
 *
 * El título duplicado se revisa dos veces por la ventana hasta el `INSERT`.
 */
export const handleProjectUpload = async (req: Request, res: Response): Promise<void> => {
  try {
    const file = req.file;
    const payload = (req.body || {}) as UploadProjectPayloadLike;
    const title = typeof payload.title === 'string' ? payload.title.trim() : '';
    const description =
      typeof payload.description === 'string' && payload.description.trim().length > 0
        ? payload.description.trim()
        : null;

    const user = req.user;

    if (!user || typeof user.email !== 'string' || typeof user.id_user !== 'number') {
      sendErrorResponse(res, 'Missing or invalid user information from token', null, 400);
      return;
    }

    if (!title) {
      sendErrorResponse(res, 'Missing or invalid title', null, 400);
      return;
    }

    if (!file) {
      sendErrorResponse(res, 'No file uploaded', null, 400);
      return;
    }

    // El archivo aún está en la carpeta de tránsito. Cualquier salida por error
    // a partir de aquí debe retirarlo: la especificación exige que una tabla
    // rechazada no quede almacenada en el servidor.
    const descartarSubida = (motivo: string): void => {
      try {
        if (file.path && fs.existsSync(file.path)) {
          fs.rmSync(file.path, { force: true });
        }
      } catch (cleanupError) {
        console.error(`[FS] Error cleaning upload after ${motivo}:`, cleanupError);
      }
    };

    // Verificación técnica del contenido. R no detecta estos errores: los
    // absorbe renombrando columnas o desalineando renglones, de modo que el
    // análisis terminaría sin fallar pero sobre datos que no son los del usuario.
    const validation = await validateCountTableFile(file.path);
    if (!validation.ok) {
      descartarSubida('failed validation');
      sendErrorResponse(res, validation.error, null, 400);
      return;
    }

    const alreadyExists = await projectExists(user.id_user, title);
    if (alreadyExists) {
      descartarSubida('duplicate title');
      sendErrorResponse(res, 'A project with the same title already exists', null, 409);
      return;
    }

    // Validado y sin conflicto de título: ahora sí se traslada a su ubicación
    // definitiva, cuya ruta depende del título del proyecto.
    const emailPrefix = sanitizeEmailPrefix(user.email);
    const projectFolder = sanitizeName(title);
    const basePath = process.env.PROJECTS_BASE_PATH || path.resolve(process.cwd(), 'projects');
    const destinationFolder = path.join(basePath, emailPrefix, projectFolder);

    try {
      ensureDirectory(destinationFolder);
      fs.renameSync(file.path, path.join(destinationFolder, file.filename));
    } catch (moveError) {
      console.error('[FS] Error moving upload to project folder:', moveError);
      descartarSubida('move failure');
      sendErrorResponse(res, 'Server error during project upload', null, 500);
      return;
    }

    // Se guarda en la base una ruta relativa a la carpeta de proyectos, no la
    // absoluta del servidor.
    const relativePath = path.posix.join(emailPrefix, projectFolder, file.filename);
    const createPayload: ProjectJsonPayload = {
      imageUrl: extractUploadImageUrl(payload),
    };
    // Lista blanca: es un campo que manda el cliente, y sin filtro bastaría
    // enviar `COMPLETED` para simular un proyecto con resultados. Lo no
    // reconocido cae a `PENDING`.
    const inputStatus = typeof payload.status === 'string' ? payload.status.trim().toUpperCase() : '';
    const statusMap: Record<string, 'PENDING' | 'PROCESSING' | 'FAILED' | 'COMPLETED'> = {
      PENDING: 'PENDING',
      PROCESSING: 'PROCESSING',
      FAILED: 'FAILED',
      COMPLETED: 'COMPLETED',
    };
    const status = statusMap[inputStatus] || 'PENDING';

    const createdProjectId = await createProject(
      user.id_user,
      title,
      description,
      status,
      relativePath,
      createPayload
    );

    sendSuccessResponse(
      res,
      'Project uploaded successfully',
      {
        id: createdProjectId,
        title,
        description,
        imageUrl: createPayload.imageUrl ?? null,
        file: relativePath,
        samples: null,
        selectedMethods: null,
        comparisons: null,
        parameters: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        status:
          inputStatus === 'PENDING' ||
          inputStatus === 'PROCESSING' ||
          inputStatus === 'FAILED' ||
          inputStatus === 'COMPLETED'
            ? inputStatus
            : 'PENDING',
        userId: String(user.id_user),
      },
      201
    );
  } catch (error) {
    console.error('Error in handleProjectUpload:', error);

    if (isDuplicateEntryError(error)) {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        try {
          fs.rmSync(req.file.path, { force: true });
        } catch (cleanupError) {
          console.error('[FS] Error cleaning file after duplicate key:', cleanupError);
        }
      }
      sendErrorResponse(res, 'A project with the same title already exists', null, 409);
      return;
    }

    sendErrorResponse(res, 'Server error during project upload', null, 500);
  }
};

/**
 * Guarda el avance parcial de los formularios de configuración.
 *
 * Permite conservar en el servidor un formulario a medio llenar, en lugar de
 * dejarlo únicamente en el navegador, donde no sobrevive a un cambio de equipo.
 * Acepta cualquier subconjunto de los cuatro bloques y no altera el estatus del
 * proyecto, que permanece "Incompleto" hasta que el usuario ejecute el análisis.
 *
 * La validación aquí solo comprueba la forma de lo que llega: un borrador es
 * incompleto por definición. La verificación exhaustiva sigue haciéndose al
 * iniciar la corrida, que es cuando la configuración debe estar entera.
 */
export const handleSaveProjectConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user || typeof user.id_user !== 'number') {
      sendErrorResponse(res, 'Missing or invalid user information from token', null, 400);
      return;
    }

    const projectId = Number(req.params.projectId);
    const project = await getProjectById(projectId, user.id_user);
    if (!project) {
      sendErrorResponse(res, 'Project not found or access denied', null, 404);
      return;
    }

    // Un proyecto que ya se ejecutó no admite cambios: alterar su configuración
    // dejaría los resultados sin correspondencia con los parámetros mostrados.
    if (project.status !== 'PENDING') {
      sendErrorResponse(
        res,
        'Project configuration can only be modified while the project is pending',
        null,
        409
      );
      return;
    }

    const payload = (req.body || {}) as Record<string, unknown>;
    const config: Partial<ProjectRunConfigPayload> = {};

    if (payload.samples !== undefined) {
      config.samples = payload.samples as unknown[];
    }
    if (payload.selectedMethods !== undefined) {
      config.selectedMethods = payload.selectedMethods as Record<string, unknown>;
    }
    if (payload.comparisons !== undefined) {
      config.comparisons = payload.comparisons as unknown[];
    }
    if (payload.parameters !== undefined) {
      config.parameters = payload.parameters as Record<string, unknown>;
    }

    if (Object.keys(config).length === 0) {
      sendErrorResponse(
        res,
        'At least one of samples, selectedMethods, comparisons or parameters is required',
        null,
        400
      );
      return;
    }

    const saved = await saveProjectDraftConfig(projectId, user.id_user, config);
    if (!saved) {
      // La condición de estatus vive en el `WHERE`, así que llegar aquí significa
      // que el proyecto dejó de estar pendiente entre la lectura y la escritura.
      sendErrorResponse(
        res,
        'Project configuration can only be modified while the project is pending',
        null,
        409
      );
      return;
    }

    const updated = await getProjectById(projectId, user.id_user);

    sendSuccessResponse(res, 'Project configuration saved', {
      id: projectId,
      status: updated?.status ?? project.status,
      samples: updated?.samples ?? null,
      selectedMethods: updated?.selectedMethods ?? null,
      comparisons: updated?.comparisons ?? null,
      parameters: updated?.parameters ?? null,
    });
  } catch (error) {
    console.error('Error in handleSaveProjectConfig:', error);
    sendErrorResponse(res, 'Server error while saving project configuration', null, 500);
  }
};

/**
 * Controlador para obtener todos los proyectos de un usuario autenticado.
 * El filtrado ocurre en la consulta con el identificador del token verificado,
 * nunca con un parámetro de la petición.
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
 * Se resuelven varias rutas candidatas porque la convención cambió durante el
 * desarrollo. `PROCESSING` está protegido —R escribe ahí— y `force` lo salta.
 */
export const handleDeleteProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const projectId = Number(req.params.projectId);
    const rawForce = req.query.force;
    const rawForceValue = Array.isArray(rawForce) ? rawForce[0] : rawForce;
    const normalizedForce = String(rawForceValue ?? '').trim().toLowerCase();
    const forceDelete =
      normalizedForce === 'true' ||
      normalizedForce === '1' ||
      normalizedForce === 'yes';

    if (!user || typeof user.id_user !== 'number') {
      sendErrorResponse(res, 'Missing or invalid user information from token', null, 400);
      return;
    }

    if (isNaN(projectId)) {
      sendErrorResponse(res, 'Invalid project ID', null, 400);
      return;
    }

    const project = await getProjectById(projectId, user.id_user);

    if (!project) {
      sendErrorResponse(res, 'Project not found or access denied', null, 404);
      return;
    }

    if (project.status === 'PROCESSING' && !forceDelete) {
      sendErrorResponse(
        res,
        'Project cannot be deleted while analysis is running. Use force=true to force delete.',
        null,
        409
      );
      return;
    }

    const basePath = getProjectsBasePath();
    const projectFolderCandidates = resolveProjectDirectoryCandidates(
      basePath,
      { path: project.path, title: project.title },
      typeof user.email === 'string' ? user.email : undefined
    );

    if (projectFolderCandidates.length === 0) {
      sendErrorResponse(res, 'Project path is invalid', null, 500);
      return;
    }

    try {
      for (const folderPath of projectFolderCandidates) {
        if (fs.existsSync(folderPath)) {
          fs.rmSync(folderPath, { recursive: true, force: true });
        }
      }

      // Si era el último proyecto del usuario, su carpeta raíz queda vacía y se
      // retira. La comprobación de que está vacía es lo que impide borrar los
      // demás proyectos de esa persona.
      const userRoot = resolveProjectAbsolutePath(
        basePath,
        sanitizeEmailPrefix(typeof user.email === 'string' ? user.email : '')
      );
      if (
        userRoot &&
        fs.existsSync(userRoot) &&
        fs.statSync(userRoot).isDirectory() &&
        fs.readdirSync(userRoot).length === 0
      ) {
        fs.rmdirSync(userRoot);
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
