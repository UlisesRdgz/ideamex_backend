/**
 * @file Controlador de ejecución de corridas de análisis.
 *
 * @module api/analysis/controllers/analysis.run.controller
 *
 * @author Ulises Rodríguez García
 */

import fs from 'fs';
import path from 'path';
import { Request, Response } from 'express';
import { sendErrorResponse, sendSuccessResponse } from '../../../utils/response';
import { getProjectById, lockProjectForRun } from '../analysis.service';
import {
  alignSamplesToCountTableHeader,
  buildAnalysisRuntimeCommand,
  buildBatchFromSamples,
  executeAnalysisInBackground,
  getProjectsBasePath,
  normalizeRunRequest,
  applySampleNameChangesToInputFile,
  resolveProjectAbsolutePath,
  validateSampleNamesAndBatch,
} from './analysis.shared.controller';

/**
 * Controlador para iniciar la corrida de análisis de un proyecto.
 * Los cuatro pasos de validación van numerados abajo y su orden no es
 * intercambiable: cada uno depende del resultado del anterior.
 * Responde 202 porque la corrida continúa en segundo plano.
 */
export const handleRunProjectAnalysis = async (req: Request, res: Response): Promise<void> => {
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

    const project = await getProjectById(projectId, user.id_user);

    if (!project) {
      sendErrorResponse(res, 'Project not found or access denied', null, 404);
      return;
    }

    // Solo se corre una vez: `PROCESSING` indica una corrida en curso, y
    // `COMPLETED` o `FAILED` que ya terminó. Relanzar sobreescribiría los
    // resultados en disco, así que se exige crear un proyecto nuevo.
    if (project.status !== 'PENDING') {
      sendErrorResponse(res, 'This project is not pending and cannot be executed again', null, 409);
      return;
    }

    const parsed = normalizeRunRequest((req.body || {}) as Record<string, unknown>);
    if (!parsed.data) {
      sendErrorResponse(res, parsed.error || 'Invalid analysis parameters', null, 400);
      return;
    }
    const runParams = parsed.data.runParams;
    const runProjectPayload = parsed.data.runPayload;

    const basePath = getProjectsBasePath();
    const inputPath = resolveProjectAbsolutePath(basePath, project.path);
    if (!inputPath) {
      sendErrorResponse(res, 'Project path is invalid', null, 500);
      return;
    }

    if (!fs.existsSync(inputPath)) {
      sendErrorResponse(res, 'Input file not found on server', null, 404);
      return;
    }

    // Paso 1. El usuario pudo renombrar muestras en la interfaz, y el archivo
    // subido conserva el encabezado original. Se emparejan ambos para saber qué
    // columna corresponde a cada muestra antes de tocar nada más.
    const alignedSamples = alignSamplesToCountTableHeader(
      inputPath,
      runProjectPayload.samples as Array<{ name?: unknown; batch?: unknown; originalName?: unknown }>
    );
    if (!alignedSamples.ok) {
      sendErrorResponse(res, alignedSamples.error, null, 400);
      return;
    }

    runProjectPayload.samples = alignedSamples.samples as typeof runProjectPayload.samples;

    // Paso 2. El lote se deriva de los nombres ya alineados, no de lo que mandó
    // el cliente: aquí se rechazan los diseños que R no puede corregir, como el
    // lote confundido con la condición experimental.
    const normalizedBatch = buildBatchFromSamples(
      runProjectPayload.samples as Array<{ name?: unknown; batch?: unknown; originalName?: unknown }>
    );
    if (normalizedBatch.error) {
      sendErrorResponse(res, normalizedBatch.error, null, 400);
      return;
    }
    runParams.batch = normalizedBatch.value;

    // Paso 3. Se reescribe el encabezado del archivo de conteos con los nombres
    // definitivos, porque el script de R lee los grupos experimentales de ahí y
    // no recibe la lista de muestras por parámetro.
    const sampleNameUpdate = applySampleNameChangesToInputFile(
      inputPath,
      runProjectPayload.samples as Array<{ name?: unknown; batch?: unknown; originalName?: unknown }>
    );
    if (!sampleNameUpdate.ok) {
      sendErrorResponse(res, sampleNameUpdate.error, null, 400);
      return;
    }

    // Paso 4. Se revalida contra el archivo ya modificado, no contra el payload:
    // es la última oportunidad de detectar una inconsistencia antes de lanzar un
    // proceso que puede tardar minutos.
    const sampleValidation = validateSampleNamesAndBatch(inputPath, runParams);
    if (!sampleValidation.ok) {
      sendErrorResponse(res, sampleValidation.error, null, 400);
      return;
    }

    // El pipeline escribe sus resultados junto al archivo de entrada, así que la
    // carpeta del proyecto es a la vez origen y destino.
    const outputDir = path.dirname(inputPath);

    const runtimeBuild = buildAnalysisRuntimeCommand({
      inputPath,
      outputDir,
      runParams,
    });
    if (!runtimeBuild.runtime) {
      sendErrorResponse(
        res,
        runtimeBuild.error || 'Analysis runtime is not configured correctly on server',
        null,
        500
      );
      return;
    }

    // Bloqueo al final: hacerlo antes dejaría el proyecto en `PROCESSING` tras un
    // fallo de validación, sin corrida y sin poder volver a `PENDING`. Es
    // condicional en la base, así que entre peticiones simultáneas solo una gana.
    const locked = await lockProjectForRun(projectId, user.id_user, runProjectPayload);

    if (!locked) {
      sendErrorResponse(res, 'Project already locked by another run', null, 409);
      return;
    }

    // No se espera: el pipeline de R puede tardar minutos y mantener la petición
    // abierta agotaría el tiempo de espera del proxy. El avance se consulta
    // después por el endpoint de resultados.
    executeAnalysisInBackground({
      projectId,
      userId: user.id_user,
      inputPath,
      outputDir,
      runtime: runtimeBuild.runtime,
      sampleNameChanges: sampleNameUpdate.changes,
    });

    sendSuccessResponse(
      res,
      'Analysis started successfully',
      {
        id: projectId,
        run_status: 'running',
      },
      202
    );
  } catch (error) {
    console.error('Error in handleRunProjectAnalysis:', error);
    sendErrorResponse(res, 'Server error while starting analysis', null, 500);
  }
};
