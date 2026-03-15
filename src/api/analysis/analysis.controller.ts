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
import { spawn } from 'child_process';
import { Request, Response } from 'express';
import { sanitizeEmailPrefix, sanitizeName } from '../../utils/file';
import {
  AnalysisRunParams,
  ProjectJsonPayload,
  ProjectRunConfigPayload,
  createProject,
  projectExists,
  getProjectsByUser,
  getProjectById,
  deleteProjectById,
  lockProjectForRun,
  markProjectRunCompleted,
  markProjectRunFailed,
} from './analysis.service';
import { sendErrorResponse, sendSuccessResponse } from '../../utils/response';
import {
  AnalysisRunPayloadLike,
  FrontMethodsSelectionLike,
  FrontSampleLike,
  UploadProjectPayloadLike,
} from './analysis.types';

const RUN_LOG_FILE = 'RunSummary.log';
const SAMPLE_NAME_PATTERN = /^.+_[a-zA-Z0-9]+$/;
const RESULT_FILE_EXTENSION_ALLOWLIST = new Set([
  '.txt',
  '.log',
  '.csv',
  '.tsv',
  '.png',
  '.jpg',
  '.jpeg',
  '.svg',
  '.pdf',
  '.zip',
]);
const MIME_BY_EXTENSION: Record<string, string> = {
  '.txt': 'text/plain; charset=utf-8',
  '.log': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.tsv': 'text/tab-separated-values; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
};

interface ProjectResultFile {
  name: string;
  size_bytes: number;
  updated_at: string;
  mime_type: string;
}

type AnalysisExecutionMode = 'local' | 'docker';

interface AnalysisRuntimeCommand {
  command: string;
  args: string[];
}

/**
 * Resuelve la ruta base de almacenamiento de proyectos desde entorno.
 */
const getProjectsBasePath = (): string => {
  return process.env.PROJECTS_BASE_PATH || path.resolve(process.cwd(), 'projects');
};

/**
 * Convierte boolean de JavaScript al literal esperado por scripts de R.
 */
const toRBoolean = (value: boolean): string => (value ? 'TRUE' : 'FALSE');

/**
 * Resuelve modo de ejecución de R. Valores no válidos caen a `local`.
 */
const resolveAnalysisExecutionMode = (): AnalysisExecutionMode => {
  const rawMode = (process.env.ANALYSIS_EXECUTION_MODE || 'local').trim().toLowerCase();
  return rawMode === 'docker' ? 'docker' : 'local';
};

/**
 * Indica si una ruta absoluta pertenece a un directorio base.
 */
const isPathInsideBase = (basePath: string, targetPath: string): boolean => {
  const normalizedBase = path.resolve(basePath);
  const normalizedTarget = path.resolve(targetPath);

  if (normalizedBase === normalizedTarget) {
    return true;
  }

  return normalizedTarget.startsWith(`${normalizedBase}${path.sep}`);
};

/**
 * Mapea una ruta absoluta del host al path equivalente dentro del contenedor.
 */
const mapHostPathToContainer = (
  hostPath: string,
  hostProjectsBase: string,
  containerProjectsBase: string
): string | null => {
  const normalizedHostBase = path.resolve(hostProjectsBase);
  const normalizedHostPath = path.resolve(hostPath);

  if (!isPathInsideBase(normalizedHostBase, normalizedHostPath)) {
    return null;
  }

  const relativePath = path.relative(normalizedHostBase, normalizedHostPath);
  const containerSegments = relativePath.split(path.sep).filter((segment) => segment.length > 0);
  return path.posix.join(containerProjectsBase, ...containerSegments);
};

/**
 * Construye comando y argumentos para ejecutar el pipeline en modo local o docker.
 */
const buildAnalysisRuntimeCommand = (params: {
  inputPath: string;
  outputDir: string;
  runParams: AnalysisRunParams;
}): { runtime: AnalysisRuntimeCommand | null; error?: string } => {
  const mode = resolveAnalysisExecutionMode();

  const cliArgs = [
    '-m',
    params.runParams.methods,
    '-l',
    String(params.runParams.logfc),
    '-f',
    String(params.runParams.cpm),
    '-u',
    String(params.runParams.padjust),
  ];

  if (params.runParams.batch !== null) {
    cliArgs.push('-b', params.runParams.batch);
  }

  cliArgs.push('-g', toRBoolean(params.runParams.generateZip), '-t', toRBoolean(params.runParams.top));

  if (mode === 'local') {
    const rscriptBin = process.env.ANALYSIS_RSCRIPT_BIN || 'Rscript';
    const scriptPath = process.env.ANALYSIS_SCRIPT_PATH;
    const sourcesPath = process.env.ANALYSIS_SOURCES_PATH;

    if (!scriptPath) {
      return { runtime: null, error: 'ANALYSIS_SCRIPT_PATH is not configured in environment variables' };
    }

    if (!fs.existsSync(scriptPath)) {
      return { runtime: null, error: `Analysis script not found at: ${scriptPath}` };
    }

    const args = [scriptPath];
    if (sourcesPath) {
      args.push('-s', sourcesPath);
    }

    args.push('-i', params.inputPath, '-o', params.outputDir, ...cliArgs);
    return { runtime: { command: rscriptBin, args } };
  }

  const containerName = (process.env.ANALYSIS_DOCKER_CONTAINER || '').trim();
  const dockerScriptPath = (process.env.ANALYSIS_DOCKER_SCRIPT_PATH || '').trim();
  const dockerSourcesPath = (process.env.ANALYSIS_DOCKER_SOURCES_PATH || '').trim();
  const hostProjectsBase = path.resolve(
    process.env.ANALYSIS_DOCKER_HOST_PROJECTS_PATH || getProjectsBasePath()
  );
  const containerProjectsBase = (process.env.ANALYSIS_DOCKER_CONTAINER_PROJECTS_PATH || '/workspace/projects').trim();

  if (!containerName) {
    return { runtime: null, error: 'ANALYSIS_DOCKER_CONTAINER is not configured' };
  }

  if (!dockerScriptPath) {
    return { runtime: null, error: 'ANALYSIS_DOCKER_SCRIPT_PATH is not configured' };
  }

  const inputPathInContainer = mapHostPathToContainer(
    params.inputPath,
    hostProjectsBase,
    containerProjectsBase
  );
  const outputDirInContainer = mapHostPathToContainer(
    params.outputDir,
    hostProjectsBase,
    containerProjectsBase
  );

  if (!inputPathInContainer || !outputDirInContainer) {
    return {
      runtime: null,
      error:
        `Input/output path is outside ANALYSIS_DOCKER_HOST_PROJECTS_PATH (${hostProjectsBase})`,
    };
  }

  const args = ['exec', containerName, 'Rscript', dockerScriptPath];
  if (dockerSourcesPath) {
    args.push('-s', dockerSourcesPath);
  }

  args.push('-i', inputPathInContainer, '-o', outputDirInContainer, ...cliArgs);
  return { runtime: { command: 'docker', args } };
};

/**
 * Limpia mensajes de error para hacerlos seguros y compactos antes de persistirlos.
 */
const sanitizeErrorMessage = (rawMessage: string): string => {
  return rawMessage.replace(/\s+/g, ' ').trim().slice(0, 2000);
};

/**
 * Intenta parsear JSON cuando el campo llega serializado como string.
 * Si no parece JSON o falla el parseo, devuelve el valor original.
 */
const parseJsonIfNeeded = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return value;
  }

  const startsAsJson = trimmed.startsWith('{') || trimmed.startsWith('[');
  if (!startsAsJson) {
    return value;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

/**
 * Extrae `imageUrl` opcional desde upload.
 * Si no existe o viene vacío, devuelve `undefined`.
 */
const extractUploadImageUrl = (payload: UploadProjectPayloadLike): string | undefined => {
  if (typeof payload.imageUrl !== 'string') {
    return undefined;
  }

  const normalized = payload.imageUrl.trim();
  return normalized.length > 0 ? normalized : undefined;
};

/**
 * Detecta errores de duplicado de llave única devueltos por MariaDB.
 */
const isDuplicateEntryError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const err = error as { code?: string; errno?: number };
  return err.code === 'ER_DUP_ENTRY' || err.errno === 1062;
};

const buildMethodsFromSelectionObject = (selection: FrontMethodsSelectionLike): string => {
  const digits: string[] = [];

  // Mapea flags booleanos del frontend al formato compacto que consume el script R.
  if (selection.edgeR === true) digits.push('1');
  if (selection.limma === true) digits.push('2');
  if (selection.noiseq === true) digits.push('3');
  if (selection.deseq2 === true) digits.push('4');
  if (selection.dataAnalysis === true) digits.push('5');
  if (selection.integrationResults === true) digits.push('6');

  return digits.join('');
};

const RUN_PAYLOAD_REQUIRED_KEYS = ['samples', 'selectedMethods', 'comparisons', 'parameters'] as const;
const RUN_PAYLOAD_ALLOWED_KEYS = new Set<string>(RUN_PAYLOAD_REQUIRED_KEYS);
const RUN_SELECTED_METHODS_KEYS = [
  'edgeR',
  'limma',
  'noiseq',
  'deseq2',
  'dataAnalysis',
  'integrationResults',
] as const;
const RUN_COMPARISON_KEYS = ['base', 'target', 'selected'] as const;
const RUN_PARAMETERS_KEYS = ['fdr', 'logFC', 'cpm', 'top', 'corrplot'] as const;

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const findUnsupportedKeys = (data: Record<string, unknown>, allowedKeys: readonly string[]): string[] => {
  const allowed = new Set(allowedKeys);
  return Object.keys(data).filter((key) => !allowed.has(key));
};

const normalizeRunProjectPayload = (
  payload: Record<string, unknown>
): { data: ProjectRunConfigPayload | null; error?: string } => {
  const unsupportedKeys = Object.keys(payload).filter((key) => !RUN_PAYLOAD_ALLOWED_KEYS.has(key));
  if (unsupportedKeys.length > 0) {
    return {
      data: null,
      error: `Unsupported fields in run payload: ${unsupportedKeys.join(', ')}`,
    };
  }

  const missingKeys = RUN_PAYLOAD_REQUIRED_KEYS.filter((key) => payload[key] === undefined);
  if (missingKeys.length > 0) {
    return {
      data: null,
      error: `Missing required fields in run payload: ${missingKeys.join(', ')}`,
    };
  }

  const body = payload as AnalysisRunPayloadLike;
  const rawSamples = parseJsonIfNeeded(body.samples);
  const rawSelectedMethods = parseJsonIfNeeded(body.selectedMethods);
  const rawComparisons = parseJsonIfNeeded(body.comparisons);
  const rawParameters = parseJsonIfNeeded(body.parameters);

  if (!Array.isArray(rawSamples) || rawSamples.length === 0) {
    return { data: null, error: 'samples must be a non-empty array' };
  }

  const samples: ProjectRunConfigPayload['samples'] = [];
  for (let index = 0; index < rawSamples.length; index += 1) {
    const sample = asRecord(rawSamples[index]);
    if (!sample) {
      return { data: null, error: `samples[${index}] must be an object` };
    }

    const sampleUnsupportedKeys = findUnsupportedKeys(sample, ['name', 'batch']);
    if (sampleUnsupportedKeys.length > 0) {
      return {
        data: null,
        error: `Unsupported fields in samples[${index}]: ${sampleUnsupportedKeys.join(', ')}`,
      };
    }

    if (typeof sample.name !== 'string' || sample.name.trim().length === 0) {
      return { data: null, error: `samples[${index}].name must be a non-empty string` };
    }
    if (typeof sample.batch !== 'string' || sample.batch.trim().length === 0) {
      return { data: null, error: `samples[${index}].batch must be a non-empty string` };
    }

    samples.push({
      name: sample.name.trim(),
      batch: sample.batch.trim(),
    });
  }

  const selectedMethodsRecord = asRecord(rawSelectedMethods);
  if (!selectedMethodsRecord) {
    return { data: null, error: 'selectedMethods must be an object' };
  }

  const selectedMethodsUnsupportedKeys = findUnsupportedKeys(
    selectedMethodsRecord,
    RUN_SELECTED_METHODS_KEYS
  );
  if (selectedMethodsUnsupportedKeys.length > 0) {
    return {
      data: null,
      error: `Unsupported fields in selectedMethods: ${selectedMethodsUnsupportedKeys.join(', ')}`,
    };
  }

  for (const key of RUN_SELECTED_METHODS_KEYS) {
    if (typeof selectedMethodsRecord[key] !== 'boolean') {
      return { data: null, error: `selectedMethods.${key} must be boolean` };
    }
  }

  const selectedMethods: ProjectRunConfigPayload['selectedMethods'] = {
    edgeR: selectedMethodsRecord.edgeR as boolean,
    limma: selectedMethodsRecord.limma as boolean,
    noiseq: selectedMethodsRecord.noiseq as boolean,
    deseq2: selectedMethodsRecord.deseq2 as boolean,
    dataAnalysis: selectedMethodsRecord.dataAnalysis as boolean,
    integrationResults: selectedMethodsRecord.integrationResults as boolean,
  };

  if (!Array.isArray(rawComparisons)) {
    return { data: null, error: 'comparisons must be an array' };
  }

  const comparisons: ProjectRunConfigPayload['comparisons'] = [];
  for (let index = 0; index < rawComparisons.length; index += 1) {
    const comparison = asRecord(rawComparisons[index]);
    if (!comparison) {
      return { data: null, error: `comparisons[${index}] must be an object` };
    }

    const comparisonUnsupportedKeys = findUnsupportedKeys(comparison, RUN_COMPARISON_KEYS);
    if (comparisonUnsupportedKeys.length > 0) {
      return {
        data: null,
        error: `Unsupported fields in comparisons[${index}]: ${comparisonUnsupportedKeys.join(', ')}`,
      };
    }

    if (typeof comparison.base !== 'string' || comparison.base.trim().length === 0) {
      return { data: null, error: `comparisons[${index}].base must be a non-empty string` };
    }
    if (typeof comparison.target !== 'string' || comparison.target.trim().length === 0) {
      return { data: null, error: `comparisons[${index}].target must be a non-empty string` };
    }
    if (typeof comparison.selected !== 'boolean') {
      return { data: null, error: `comparisons[${index}].selected must be boolean` };
    }

    comparisons.push({
      base: comparison.base.trim(),
      target: comparison.target.trim(),
      selected: comparison.selected,
    });
  }

  const parametersRecord = asRecord(rawParameters);
  if (!parametersRecord) {
    return { data: null, error: 'parameters must be an object' };
  }

  const parametersUnsupportedKeys = findUnsupportedKeys(parametersRecord, RUN_PARAMETERS_KEYS);
  if (parametersUnsupportedKeys.length > 0) {
    return {
      data: null,
      error: `Unsupported fields in parameters: ${parametersUnsupportedKeys.join(', ')}`,
    };
  }

  if (typeof parametersRecord.fdr !== 'string' || parametersRecord.fdr.trim().length === 0) {
    return { data: null, error: 'parameters.fdr must be a non-empty string' };
  }
  if (typeof parametersRecord.logFC !== 'string' || parametersRecord.logFC.trim().length === 0) {
    return { data: null, error: 'parameters.logFC must be a non-empty string' };
  }
  if (typeof parametersRecord.cpm !== 'string' || parametersRecord.cpm.trim().length === 0) {
    return { data: null, error: 'parameters.cpm must be a non-empty string' };
  }
  if (typeof parametersRecord.top !== 'boolean') {
    return { data: null, error: 'parameters.top must be boolean' };
  }
  if (typeof parametersRecord.corrplot !== 'boolean') {
    return { data: null, error: 'parameters.corrplot must be boolean' };
  }

  return {
    data: {
      samples,
      selectedMethods,
      comparisons,
      parameters: {
        fdr: parametersRecord.fdr.trim(),
        logFC: parametersRecord.logFC.trim(),
        cpm: parametersRecord.cpm.trim(),
        top: parametersRecord.top,
        corrplot: parametersRecord.corrplot,
      },
    },
  };
};

const buildBatchFromSamples = (samples: FrontSampleLike[]): string | null => {
  const values: string[] = [];

  for (const sample of samples) {
    if (!sample || typeof sample !== 'object') {
      return null;
    }

    // Si una muestra no trae `batch`, no se puede construir vector consistente.
    const batchValue = sample.batch;
    if (batchValue === undefined || batchValue === null || batchValue === '') {
      return null;
    }

    values.push(String(batchValue).trim());
  }

  if (values.length === 0 || values.some((value) => value.length === 0)) {
    return null;
  }

  return values.join(',');
};

/**
 * Construye ruta absoluta segura desde una ruta relativa de proyecto.
 * Rechaza intentos de path traversal fuera de `basePath`.
 */
const resolveProjectAbsolutePath = (basePath: string, projectRelativePath: string): string | null => {
  if (!projectRelativePath || projectRelativePath.trim().length === 0) {
    return null;
  }

  const normalizedBasePath = path.resolve(basePath);
  const absolutePath = path.resolve(normalizedBasePath, ...projectRelativePath.split('/'));

  if (
    absolutePath !== normalizedBasePath &&
    !absolutePath.startsWith(`${normalizedBasePath}${path.sep}`)
  ) {
    return null;
  }

  return absolutePath;
};

/**
 * Determina la carpeta de resultados de un proyecto a partir del archivo subido.
 * El pipeline escribe en el mismo directorio del archivo de entrada.
 */
const resolveResultDirectory = (basePath: string, project: { path: string }): string | null => {
  return resolveProjectAbsolutePath(basePath, path.posix.dirname(project.path));
};

/**
 * Verifica si una extensión es segura para exponerla al frontend.
 */
const isAllowedResultFile = (fileName: string): boolean => {
  const ext = path.extname(fileName).toLowerCase();
  return RESULT_FILE_EXTENSION_ALLOWLIST.has(ext);
};

/**
 * Infere MIME type por extensión para render inline o descarga.
 */
const inferMimeType = (fileName: string): string => {
  const ext = path.extname(fileName).toLowerCase();
  return MIME_BY_EXTENSION[ext] || 'application/octet-stream';
};

/**
 * Convierte separadores a formato POSIX para respuestas estables en API.
 */
const toPosixPath = (value: string): string => value.split(path.sep).join('/');

/**
 * Recorre recursivamente el directorio de resultados y devuelve archivos permitidos.
 */
const listProjectResultFiles = (resultDir: string, currentDir = resultDir): ProjectResultFile[] => {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  const files: ProjectResultFile[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue;
    }

    const absolutePath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listProjectResultFiles(resultDir, absolutePath));
      continue;
    }

    if (!entry.isFile() || !isAllowedResultFile(entry.name)) {
      continue;
    }

    const stats = fs.statSync(absolutePath);
    const relativePath = toPosixPath(path.relative(resultDir, absolutePath));

    files.push({
      name: relativePath,
      size_bytes: stats.size,
      updated_at: stats.mtime.toISOString(),
      mime_type: inferMimeType(entry.name),
    });
  }

  return files.sort((a, b) => a.name.localeCompare(b.name));
};

/**
 * Resuelve de forma segura el archivo solicitado dentro de la carpeta de resultados.
 * Rechaza path traversal y rutas vacías.
 */
const resolveResultFilePath = (resultDir: string, fileName: string): string | null => {
  if (!fileName || fileName.trim().length === 0) {
    return null;
  }

  const normalizedName = fileName
    .split(/[\\/]+/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .join(path.sep);

  if (!normalizedName) {
    return null;
  }

  const normalizedResultDir = path.resolve(resultDir);
  const absolutePath = path.resolve(normalizedResultDir, normalizedName);

  if (
    absolutePath !== normalizedResultDir &&
    !absolutePath.startsWith(`${normalizedResultDir}${path.sep}`)
  ) {
    return null;
  }

  return absolutePath;
};

/**
 * Detecta el separador soportado en encabezados de tabla de conteo.
 */
const detectCountTableSeparator = (headerLine: string): ',' | '\t' | null => {
  if (headerLine.includes(',')) {
    return ',';
  }

  if (headerLine.includes('\t')) {
    return '\t';
  }

  return null;
};

/**
 * Lee solo la primera línea del archivo de conteos para extraer metadatos básicos:
 * - nombres de muestra (columnas),
 * - nombres de condición (prefijo antes del último `_`).
 */
const parseCountTableHeader = (
  inputPath: string
): { sampleNames: string[]; conditionNames: string[] } | null => {
  // Se lee únicamente el encabezado para validar estructura sin cargar toda la tabla en memoria.
  const content = fs.readFileSync(inputPath, 'utf-8');
  // Remueve posible BOM UTF-8 para no romper parseo del primer encabezado.
  const firstLine = content.split(/\r?\n/, 1)[0]?.replace(/^\uFEFF/, '') || '';

  if (!firstLine.trim()) {
    return null;
  }

  const separator = detectCountTableSeparator(firstLine);
  if (!separator) {
    return null;
  }

  const columns = firstLine.split(separator).map((value) => value.trim());
  if (columns.length < 2) {
    return null;
  }

  // La primera columna corresponde al identificador de gen/transcrito, no a muestra.
  const sampleNames = columns.slice(1).filter((value) => value.length > 0);
  if (sampleNames.length === 0) {
    return null;
  }

  const conditionNames = sampleNames.map((sample) => sample.replace(/_[a-zA-Z0-9]+$/, ''));
  return { sampleNames, conditionNames };
};

/**
 * Valida reglas mínimas de consistencia entre:
 * - formato de nombres de muestra,
 * - métodos de análisis seleccionados,
 * - longitud del vector batch.
 */
const validateSampleNamesAndBatch = (
  inputPath: string,
  runParams: AnalysisRunParams
): { ok: true } | { ok: false; error: string } => {
  let metadata: { sampleNames: string[]; conditionNames: string[] } | null = null;
  try {
    metadata = parseCountTableHeader(inputPath);
  } catch {
    return {
      ok: false,
      error: 'Unable to read count table from server storage',
    };
  }

  if (!metadata) {
    return {
      ok: false,
      error: 'Input count table header is invalid (missing separator or sample columns)',
    };
  }

  // Requisito mínimo para cualquier comparación con sentido estadístico.
  if (metadata.sampleNames.length < 2) {
    return {
      ok: false,
      error: 'The count table must include at least 2 sample columns',
    };
  }

  // Enforce del patrón `condition_sample` para que el pipeline deduzca grupos correctamente.
  const invalidSampleNames = metadata.sampleNames.filter((sample) => !SAMPLE_NAME_PATTERN.test(sample));
  if (invalidSampleNames.length > 0) {
    return {
      ok: false,
      error:
        'Invalid sample names. Expected pattern "condition_sample" (examples: Ctrl_1,Treat_1)',
    };
  }

  // Si se usan métodos DE (1-4), debe haber al menos dos condiciones comparables.
  const hasPairwiseMethods = /[1-4]/.test(runParams.methods);
  if (hasPairwiseMethods) {
    const uniqueConditions = new Set(metadata.conditionNames);
    if (uniqueConditions.size < 2) {
      return {
        ok: false,
        error:
          'At least 2 different conditions are required in sample names for differential expression methods',
      };
    }
  }

  if (runParams.batch !== null) {
    // Cada muestra debe tener exactamente un valor de batch.
    const batchValues = runParams.batch.split(',').map((value) => value.trim());
    if (batchValues.length !== metadata.sampleNames.length) {
      return {
        ok: false,
        error: `Batch length (${batchValues.length}) must match number of samples (${metadata.sampleNames.length})`,
      };
    }
  }

  return { ok: true };
};

/**
 * Intenta extraer `runStatus` (0..4) desde stdout del script.
 * Se usa como fallback cuando el proceso termina sin error de sistema.
 */
const parseRunStatusFromStdout = (stdout: string): number | null => {
  const matches = stdout.match(/\b[0-4]\b/g);
  if (!matches || matches.length === 0) {
    return null;
  }

  // Si hay múltiples coincidencias, se toma la última por ser el estado final emitido.
  const value = Number(matches[matches.length - 1]);
  if (!Number.isInteger(value)) {
    return null;
  }

  return value;
};

/**
 * Traduce códigos de estado del script R a mensajes legibles para API/log.
 */
const getRunStatusMessage = (runStatus: number): string => {
  switch (runStatus) {
    case 0:
      return 'Run finished successfully';
    case 1:
      return 'Main analysis program failed (runStatus=1)';
    case 2:
      return 'Mandatory parameters were omitted (runStatus=2)';
    case 3:
      return 'Required R packages are missing (runStatus=3)';
    case 4:
      return 'R scripts directory is invalid (runStatus=4)';
    default:
      return `Unknown runStatus from R script: ${runStatus}`;
  }
};

/**
 * Normaliza líneas del log de R para facilitar búsqueda de patrones de error.
 */
const cleanRunLogLine = (line: string): string => {
  return line
    .trim()
    .replace(/^\[\d+\]\s*/, '')
    .replace(/^"+|"+$/g, '')
    .trim();
};

/**
 * Busca señales de falla dentro de `RunSummary.log` generado por el pipeline.
 * Si detecta una línea crítica, devuelve un mensaje explicativo.
 */
const findFailureInRunSummaryLog = (outputDir: string): string | null => {
  const logPath = path.join(outputDir, RUN_LOG_FILE);
  if (!fs.existsSync(logPath)) {
    return null;
  }

  const logContent = fs.readFileSync(logPath, 'utf-8');
  const lines = logContent.split(/\r?\n/).map(cleanRunLogLine).filter((line) => line.length > 0);

  // Patrones que representan fallos funcionales del pipeline aunque el proceso haya terminado.
  const firstFailureLine = lines.find((line) => {
    return (
      /\bfailed\b/i.test(line) ||
      /-----\s*error\s*-----/i.test(line) ||
      /execution halted/i.test(line) ||
      /is not installed/i.test(line) ||
      /unable to read count table/i.test(line) ||
      /count table has/i.test(line)
    );
  });

  if (!firstFailureLine) {
    return null;
  }

  return `RunSummary.log indicates failure: ${firstFailureLine}`;
};

/**
 * Valida y normaliza payload de ejecución:
 * - acepta solo formato Project estricto,
 * - rechaza llaves extra,
 * - valida tipos y rangos numéricos,
 * - traduce a parámetros internos para script R.
 */
const normalizeRunRequest = (
  payload: Record<string, unknown>
): { data: { runParams: AnalysisRunParams; runPayload: ProjectRunConfigPayload } | null; error?: string } => {
  const normalizedPayload = normalizeRunProjectPayload(payload);
  if (!normalizedPayload.data) {
    return { data: null, error: normalizedPayload.error || 'Invalid run payload' };
  }

  const runPayload = normalizedPayload.data;
  const methods = buildMethodsFromSelectionObject(runPayload.selectedMethods);

  if (!methods) {
    return {
      data: null,
      error: 'selectedMethods must activate at least one method',
    };
  }

  const hasAnyRunnableMethod = /[1-5]/.test(methods);
  if (!hasAnyRunnableMethod) {
    return { data: null, error: 'selectedMethods must include at least one method from 1 to 5' };
  }

  if (methods.includes('6') && !/[1-4]/.test(methods)) {
    return {
      data: null,
      error: 'selectedMethods.integrationResults requires at least one DE method from selectedMethods (edgeR, limma, noiseq or deseq2)',
    };
  }

  const logfc = Number(runPayload.parameters.logFC);
  const cpm = Number(runPayload.parameters.cpm);
  const padjust = Number(runPayload.parameters.fdr);

  if (!Number.isFinite(logfc) || logfc <= 0) {
    return { data: null, error: 'parameters.logFC must be a number greater than 0' };
  }
  if (!Number.isFinite(cpm) || cpm <= 0) {
    return { data: null, error: 'parameters.cpm must be a number greater than 0' };
  }
  if (!Number.isFinite(padjust) || padjust <= 0 || padjust >= 1) {
    return { data: null, error: 'parameters.fdr must be a number between 0 and 1' };
  }

  const normalizedBatch = buildBatchFromSamples(runPayload.samples as FrontSampleLike[]);

  if (!normalizedBatch || normalizedBatch.length === 0) {
    return { data: null, error: 'samples.batch is required to build batch vector' };
  }

  if (!/^-?\d+(\.\d+)?(,-?\d+(\.\d+)?)*$/.test(normalizedBatch)) {
    return {
      data: null,
      error: 'samples.batch must be a comma-separated numeric list',
    };
  }

  return {
    data: {
      runPayload,
      runParams: {
        methods,
        logfc,
        cpm,
        padjust,
        batch: normalizedBatch,
        generateZip: true,
        top: runPayload.parameters.top as boolean,
      },
    },
  };
};

/**
 * Dispara el análisis en segundo plano y persiste estado final en base de datos.
 * Esta función nunca responde HTTP; solo actualiza estado del proyecto.
 */
const executeAnalysisInBackground = (params: {
  projectId: number;
  userId: number;
  inputPath: string;
  outputDir: string;
  runtime: AnalysisRuntimeCommand;
}): void => {
  const child = spawn(params.runtime.command, params.runtime.args, {
    cwd: params.outputDir,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let settled = false;
  let stdout = '';
  let stderr = '';

  // Evita dobles escrituras de estado cuando hay más de un evento de cierre/error.
  const finalizeSuccess = (): void => {
    if (settled) {
      return;
    }

    settled = true;
    void markProjectRunCompleted(params.projectId, params.userId).catch((dbError) => {
      console.error('[ANALYSIS] Error saving success status:', dbError);
    });
  };

  const finalizeFailure = (message: string): void => {
    if (settled) {
      return;
    }

    settled = true;
    void markProjectRunFailed(params.projectId, params.userId).catch((dbError) => {
      console.error('[ANALYSIS] Error saving failure status:', dbError);
    });
  };

  // Se limita buffer en memoria para evitar crecer sin control en ejecuciones largas.
  child.stdout.on('data', (chunk) => {
    if (stdout.length < 4000) {
      stdout += String(chunk);
    }
  });

  child.stderr.on('data', (chunk) => {
    if (stderr.length < 4000) {
      stderr += String(chunk);
    }
  });

  child.on('error', (error) => {
    finalizeFailure(`Failed to start process: ${error.message}`);
  });

  child.on('close', (code) => {
    const runStatus = parseRunStatusFromStdout(stdout);
    const runLogFailure = findFailureInRunSummaryLog(params.outputDir);

    // Éxito estricto: código 0 + sin runStatus de error + sin errores en RunSummary.log.
    if (code === 0 && (runStatus === 0 || runStatus === null) && !runLogFailure) {
      finalizeSuccess();
      return;
    }

    if (runStatus !== null && runStatus !== 0) {
      const fromStatus = getRunStatusMessage(runStatus);
      const fromLog = runLogFailure ? ` | ${runLogFailure}` : '';
      finalizeFailure(`${fromStatus}${fromLog}`);
      return;
    }

    if (runLogFailure) {
      finalizeFailure(runLogFailure);
      return;
    }

    // Prioridad de diagnóstico: stderr > stdout > runStatus > exit code.
    const stderrMessage = sanitizeErrorMessage(stderr);
    const stdoutMessage = sanitizeErrorMessage(stdout);
    const statusMessage = runStatus === null ? '' : getRunStatusMessage(runStatus);
    const detail =
      stderrMessage.length > 0
        ? stderrMessage
        : stdoutMessage.length > 0
          ? stdoutMessage
          : statusMessage.length > 0
            ? statusMessage
            : `Process ended with code ${code ?? 'unknown'}`;

    finalizeFailure(detail);
  });
};

/**
 * Controlador para manejar la carga de un nuevo proyecto.
 * Valida los datos, construye la ruta de almacenamiento y registra el proyecto en la base de datos.
 * 
 * @route POST /analysis/upload
 * @access Privado (requiere autenticación Bearer y campo `title` en body)
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

    // Validar usuario autenticado
    if (!user || typeof user.email !== 'string' || typeof user.id_user !== 'number') {
      sendErrorResponse(res, 'Missing or invalid user information from token', null, 400);
      return;
    }

    // Validar título del proyecto
    if (!title) {
      sendErrorResponse(res, 'Missing or invalid title', null, 400);
      return;
    }

    // Validar archivo
    if (!file) {
      sendErrorResponse(res, 'No file uploaded', null, 400);
      return;
    }

    // Verificar duplicado
    const alreadyExists = await projectExists(user.id_user, title);
    if (alreadyExists) {
      try {
        if (file.path && fs.existsSync(file.path)) {
          fs.rmSync(file.path, { force: true });
          const parentFolder = path.dirname(file.path);
          if (fs.existsSync(parentFolder) && fs.readdirSync(parentFolder).length === 0) {
            fs.rmdirSync(parentFolder);
          }
        }
      } catch (cleanupError) {
        console.error('[FS] Error cleaning duplicate upload:', cleanupError);
      }

      sendErrorResponse(res, 'A project with the same title already exists', null, 409);
      return;
    }

    // Construir la ruta relativa del archivo, manteniendo la misma sanitización que multer
    const emailPrefix = sanitizeEmailPrefix(user.email);
    const projectFolder = sanitizeName(title);
    const relativePath = path.posix.join(emailPrefix, projectFolder, file.filename);
    const createPayload: ProjectJsonPayload = {
      imageUrl: extractUploadImageUrl(payload),
    };
    const inputStatus = typeof payload.status === 'string' ? payload.status.trim().toUpperCase() : '';
    // Mapea entrada flexible a valores válidos de ProjectStatusEnum.
    const statusMap: Record<string, 'PENDING' | 'PROCESSING' | 'FAILED' | 'COMPLETED'> = {
      PENDING: 'PENDING',
      PROCESSING: 'PROCESSING',
      FAILED: 'FAILED',
      COMPLETED: 'COMPLETED',
    };
    const status = statusMap[inputStatus] || 'PENDING';

    // Insertar proyecto en la base de datos
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
        // En JSON, `undefined` elimina la llave; usamos `null` para mantener contrato visible.
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

    // Recupera listado ya ordenado por fecha desde la capa de servicio.
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
    
    // Verifica pertenencia del proyecto al usuario autenticado.
    const project = await getProjectById(projectId, user.id_user);

    if (!project) {
      sendErrorResponse(res, 'Project not found or access denied', null, 404);
      return;
    }

    if (project.status !== 'PENDING') {
      sendErrorResponse(
        res,
        'Project cannot be deleted because analysis already started or finished',
        null,
        409
      );
      return;
    }

    // Resuelve ruta absoluta segura para evitar borrar fuera del storage permitido.
    const basePath = getProjectsBasePath();
    const absoluteFilePath = resolveProjectAbsolutePath(basePath, project.path);
    if (!absoluteFilePath) {
      sendErrorResponse(res, 'Project path is invalid', null, 500);
      return;
    }

    const folderPath = path.dirname(absoluteFilePath);

    try {
      if (fs.existsSync(folderPath)) {
        fs.rmSync(folderPath, { recursive: true, force: true });
      }
    } catch (err) {
      console.error('[FS] Error removing project folder:', err);
      sendErrorResponse(res, 'Error deleting project folder from filesystem', null, 500);
      return;
    }

    // Elimina registro en BD solo después de limpiar archivos.
    await deleteProjectById(projectId, user.id_user);

    sendSuccessResponse(res, 'Project deleted successfully');
  } catch (error) {
    console.error('Error in handleDeleteProject:', error);
    sendErrorResponse(res, 'Server error during project deletion', null, 500);
  }
};

/**
 * Controlador para iniciar la corrida de análisis de un proyecto.
 * Una vez iniciada, el proyecto queda bloqueado y no puede modificarse.
 *
 * @route POST /analysis/project/:projectId/run
 * @access Privado (requiere autenticación Bearer)
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

    // Verifica existencia y ownership del proyecto antes de iniciar corrida.
    const project = await getProjectById(projectId, user.id_user);

    if (!project) {
      sendErrorResponse(res, 'Project not found or access denied', null, 404);
      return;
    }

    if (project.status !== 'PENDING') {
      sendErrorResponse(res, 'This project is not pending and cannot be executed again', null, 409);
      return;
    }

    // Normaliza body para un contrato estable hacia el ejecutor.
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

    // Valida consistencia del encabezado de la tabla respecto a métodos y batch.
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

    // Persiste snapshot de corrida y bloquea proyecto de forma atómica.
    const locked = await lockProjectForRun(projectId, user.id_user, runProjectPayload);

    if (!locked) {
      sendErrorResponse(res, 'Project already locked by another run', null, 409);
      return;
    }

    // Lanza proceso en background y responde 202 inmediatamente.
    executeAnalysisInBackground({
      projectId,
      userId: user.id_user,
      inputPath,
      outputDir,
      runtime: runtimeBuild.runtime,
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

/**
 * Lista archivos generados por la corrida de un proyecto.
 *
 * @route GET /analysis/project/:projectId/results
 * @access Privado (requiere autenticación Bearer)
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
 * Sirve un archivo individual de resultados para visualización o descarga.
 *
 * @route GET /analysis/project/:projectId/results/file?name=<relativePath>&download=true|false
 * @access Privado (requiere autenticación Bearer)
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
