/**
 * @file Controlador de ejecución de corridas de análisis.
 *
 * @module api/analysis/controllers/analysis.run.controller
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
 * Una vez iniciada, el proyecto queda bloqueado y no puede modificarse.
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

    const alignedSamples = alignSamplesToCountTableHeader(
      inputPath,
      runProjectPayload.samples as Array<{ name?: unknown; batch?: unknown; originalName?: unknown }>
    );
    if (!alignedSamples.ok) {
      sendErrorResponse(res, alignedSamples.error, null, 400);
      return;
    }

    runProjectPayload.samples = alignedSamples.samples as typeof runProjectPayload.samples;

    const normalizedBatch = buildBatchFromSamples(
      runProjectPayload.samples as Array<{ name?: unknown; batch?: unknown; originalName?: unknown }>
    );
    if (normalizedBatch.error) {
      sendErrorResponse(res, normalizedBatch.error, null, 400);
      return;
    }
    runParams.batch = normalizedBatch.value;

    const sampleNameUpdate = applySampleNameChangesToInputFile(
      inputPath,
      runProjectPayload.samples as Array<{ name?: unknown; batch?: unknown; originalName?: unknown }>
    );
    if (!sampleNameUpdate.ok) {
      sendErrorResponse(res, sampleNameUpdate.error, null, 400);
      return;
    }

    const sampleValidation = validateSampleNamesAndBatch(inputPath, runParams);
    if (!sampleValidation.ok) {
      sendErrorResponse(res, sampleValidation.error, null, 400);
      return;
    }

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

    const locked = await lockProjectForRun(projectId, user.id_user, runProjectPayload);

    if (!locked) {
      sendErrorResponse(res, 'Project already locked by another run', null, 409);
      return;
    }

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
