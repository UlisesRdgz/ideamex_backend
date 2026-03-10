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
  FrontAnalysisParametersLike,
  FrontMethodLike,
  FrontMethodsSelectionLike,
  FrontSampleLike,
  UploadProjectPayloadLike,
} from './analysis.types';

const RUN_LOG_FILE = 'RunSummary.log';
const SAMPLE_NAME_PATTERN = /^.+_[a-zA-Z0-9]+$/;
const METHOD_DIGIT_BY_NAME: Record<string, string> = {
  edger: '1',
  limma: '2',
  noiseq: '3',
  deseq2: '4',
  dataanalysis: '5',
  integrationresults: '6',
};
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
 * Limpia mensajes de error para hacerlos seguros y compactos antes de persistirlos.
 */
const sanitizeErrorMessage = (rawMessage: string): string => {
  return rawMessage.replace(/\s+/g, ' ').trim().slice(0, 2000);
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

/**
 * Convierte valores flexibles (`true`, `false`, `1`, `0`) a boolean estricto.
 * Devuelve `null` cuando el valor no puede interpretarse.
 */
const parseBooleanField = (value: unknown): boolean | null => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') {
      return true;
    }
    if (normalized === 'false' || normalized === '0') {
      return false;
    }
  }

  return null;
};

const normalizeMethodName = (name: string): string => {
  // Normaliza para permitir equivalencias como "edge-r", "edgeR" o "EDGE R".
  return name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
};

const buildMethodsFromMethodArray = (methods: FrontMethodLike[]): string => {
  const selectedDigits: string[] = [];

  for (const method of methods) {
    if (!method || typeof method !== 'object') {
      continue;
    }

    const name = typeof method.name === 'string' ? method.name : null;
    if (!name) {
      continue;
    }

    if (method.isSelected !== undefined && typeof method.isSelected === 'boolean' && !method.isSelected) {
      continue;
    }

    const key = normalizeMethodName(name);
    const digit = METHOD_DIGIT_BY_NAME[key];
    if (digit) {
      selectedDigits.push(digit);
    }
  }

  // Deduplica para evitar repetir métodos cuando la UI manda duplicados.
  return Array.from(new Set(selectedDigits)).join('');
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
 * Adapta payloads del frontend (ProjectRequest/Project) al formato legacy del backend.
 * Soporta ambos estilos para mantener compatibilidad en clientes existentes.
 */
const adaptRunPayloadFromFrontend = (
  payload: Record<string, unknown>
): AnalysisRunPayloadLike => {
  const body = payload as AnalysisRunPayloadLike;
  const adapted: AnalysisRunPayloadLike = {
    methods: typeof body.methods === 'string' ? body.methods : undefined,
    logfc: body.logfc,
    cpm: body.cpm,
    padjust: body.padjust,
    batch: body.batch,
    generateZip: body.generateZip,
    top: body.top,
  };

  // Prioridad 1: arreglo de métodos detallado (ProjectRequest.methods).
  if ((!adapted.methods || adapted.methods === '') && Array.isArray(body.methods)) {
    adapted.methods = buildMethodsFromMethodArray(body.methods as FrontMethodLike[]);
  }

  // Prioridad 2: selección booleana (Project.selectedMethods).
  if (
    (!adapted.methods || adapted.methods === '') &&
    body.selectedMethods &&
    typeof body.selectedMethods === 'object'
  ) {
    adapted.methods = buildMethodsFromSelectionObject(body.selectedMethods as FrontMethodsSelectionLike);
  }

  if (body.parameters && typeof body.parameters === 'object') {
    const parameters = body.parameters as FrontAnalysisParametersLike;

    // Mapea nombres de contrato frontend a nombres internos legacy.
    if (adapted.padjust === undefined) {
      adapted.padjust = parameters.fdr ?? parameters.padjust;
    }
    if (adapted.logfc === undefined) {
      adapted.logfc = parameters.logFC ?? parameters.logfc;
    }
    if (adapted.cpm === undefined) {
      adapted.cpm = parameters.cpm;
    }
    if (adapted.top === undefined) {
      adapted.top = parameters.top;
    }
    if (adapted.generateZip === undefined) {
      adapted.generateZip = parameters.generateZip;
    }
  }

  // Si el cliente no mandó `batch` directo, se deriva desde `samples[].batch`.
  if (
    (adapted.batch === undefined || adapted.batch === null || adapted.batch === '') &&
    Array.isArray(body.samples)
  ) {
    adapted.batch = buildBatchFromSamples(body.samples as FrontSampleLike[]);
  }

  return adapted;
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
 * Determina la carpeta de resultados para un proyecto.
 * Prioriza `result_path` (persistido al correr análisis) y usa fallback al directorio del archivo cargado.
 */
const resolveResultDirectory = (
  basePath: string,
  project: { result_path: string | null; path: string }
): string | null => {
  const resultRelativePath =
    project.result_path && project.result_path.trim().length > 0
      ? project.result_path
      : path.posix.dirname(project.path);

  return resolveProjectAbsolutePath(basePath, resultRelativePath);
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
 * - aplica defaults,
 * - verifica rangos numéricos,
 * - compacta métodos,
 * - valida batch y flags booleanos.
 */
const normalizeRunParams = (
  payload: Record<string, unknown>
): { params: AnalysisRunParams | null; error?: string } => {
  // Acepta payload nuevo del frontend y payload legacy ya soportado por el backend.
  const adaptedPayload = adaptRunPayloadFromFrontend(payload);
  const rawPayload = payload as AnalysisRunPayloadLike;
  // Si el cliente intentó enviar métodos pero ninguno pudo mapearse, se rechaza explícitamente.
  const methodsProvided =
    typeof rawPayload.methods === 'string' ||
    Array.isArray(rawPayload.methods) ||
    rawPayload.selectedMethods !== undefined;

  if (
    methodsProvided &&
    (typeof adaptedPayload.methods !== 'string' || adaptedPayload.methods.trim().length === 0)
  ) {
    return {
      params: null,
      error:
        'No valid methods were mapped from payload. Verify methods[].name or selectedMethods fields.',
    };
  }

  const methodsInput =
    typeof adaptedPayload.methods === 'string' && adaptedPayload.methods.trim().length > 0
      ? adaptedPayload.methods.trim()
      : '';

  if (!methodsInput) {
    return { params: null, error: 'methods is required and cannot be empty' };
  }

  // Solo se permite el alfabeto de métodos conocido por el backend (1..6).
  if (!/^[1-6]+$/.test(methodsInput)) {
    return { params: null, error: 'methods must contain digits from 1 to 6 only' };
  }

  // Elimina duplicados preservando orden de selección.
  const methods = Array.from(new Set(methodsInput.split(''))).join('');
  const hasAnyRunnableMethod = /[1-5]/.test(methods);
  if (!hasAnyRunnableMethod) {
    return { params: null, error: 'methods must include at least one method from 1 to 5' };
  }

  if (methods.includes('6') && !/[1-4]/.test(methods)) {
    return { params: null, error: 'method 6 (integration) requires at least one DE method (1-4)' };
  }

  // Convierte entrada flexible a números y valida límites operativos.
  const logfcRaw = adaptedPayload.logfc;
  const cpmRaw = adaptedPayload.cpm;
  const padjustRaw = adaptedPayload.padjust;

  // Modo estricto: sin estos tres valores no se inicia ejecución.
  if (logfcRaw === undefined || logfcRaw === null || String(logfcRaw).trim() === '') {
    return { params: null, error: 'logfc is required' };
  }
  if (cpmRaw === undefined || cpmRaw === null || String(cpmRaw).trim() === '') {
    return { params: null, error: 'cpm is required' };
  }
  if (padjustRaw === undefined || padjustRaw === null || String(padjustRaw).trim() === '') {
    return { params: null, error: 'padjust is required' };
  }

  const logfc = Number(logfcRaw);
  const cpm = Number(cpmRaw);
  const padjust = Number(padjustRaw);

  if (!Number.isFinite(logfc) || logfc <= 0) {
    return { params: null, error: 'logfc must be a number greater than 0' };
  }
  if (!Number.isFinite(cpm) || cpm <= 0) {
    return { params: null, error: 'cpm must be a number greater than 0' };
  }
  if (!Number.isFinite(padjust) || padjust <= 0 || padjust >= 1) {
    return { params: null, error: 'padjust must be a number between 0 and 1' };
  }

  if (
    adaptedPayload.batch === undefined ||
    adaptedPayload.batch === null ||
    adaptedPayload.batch === ''
  ) {
    return { params: null, error: 'batch is required' };
  }

  if (typeof adaptedPayload.batch !== 'string') {
    return { params: null, error: 'batch must be a comma-separated numeric list' };
  }

  const normalizedBatch = adaptedPayload.batch
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .join(',');

  if (normalizedBatch.length === 0) {
    return { params: null, error: 'batch is required' };
  }

  if (!/^-?\d+(\.\d+)?(,-?\d+(\.\d+)?)*$/.test(normalizedBatch)) {
    return { params: null, error: 'batch must be a comma-separated numeric list' };
  }

  // En este backend, `generateZip` no viene en clases del frontend y se fija en true.
  const generateZip =
    adaptedPayload.generateZip === undefined
      ? true
      : parseBooleanField(adaptedPayload.generateZip);

  if (generateZip === null) {
    return { params: null, error: 'generateZip must be boolean' };
  }

  const top = parseBooleanField(adaptedPayload.top);
  if (top === null) {
    // `top` gobierna bloques de salida en el reporte; se exige explícitamente.
    return { params: null, error: 'top is required and must be boolean' };
  }

  // Contrato final normalizado listo para persistir en DB y ejecutar script R.
  return {
    params: {
      methods,
      logfc,
      cpm,
      padjust,
      batch: normalizedBatch,
      generateZip,
      top,
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
  resultPath: string;
  runParams: AnalysisRunParams;
}): void => {
  const rscriptBin = process.env.ANALYSIS_RSCRIPT_BIN || 'Rscript';
  const scriptPath = process.env.ANALYSIS_SCRIPT_PATH;
  const sourcesPath = process.env.ANALYSIS_SOURCES_PATH;

  // Validación temprana de configuración para evitar bloquear proyecto indefinidamente.
  if (!scriptPath) {
    void markProjectRunFailed(
      params.projectId,
      params.userId,
      'ANALYSIS_SCRIPT_PATH is not configured in environment variables'
    );
    return;
  }

  if (!fs.existsSync(scriptPath)) {
    void markProjectRunFailed(
      params.projectId,
      params.userId,
      `Analysis script not found at: ${scriptPath}`
    );
    return;
  }

  const args = [scriptPath];

  // Ruta opcional de scripts auxiliares para el pipeline.
  if (sourcesPath) {
    args.push('-s', sourcesPath);
  }

  // Construye argumentos CLI con parámetros normalizados.
  args.push(
    '-i',
    params.inputPath,
    '-o',
    params.outputDir,
    '-m',
    params.runParams.methods,
    '-l',
    String(params.runParams.logfc),
    '-f',
    String(params.runParams.cpm),
    '-u',
    String(params.runParams.padjust)
  );

  if (params.runParams.batch !== null) {
    args.push('-b', params.runParams.batch);
  }

  args.push('-g', toRBoolean(params.runParams.generateZip), '-t', toRBoolean(params.runParams.top));

  const child = spawn(rscriptBin, args, {
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
    void markProjectRunCompleted(params.projectId, params.userId, params.resultPath).catch((dbError) => {
      console.error('[ANALYSIS] Error saving success status:', dbError);
    });
  };

  const finalizeFailure = (message: string): void => {
    if (settled) {
      return;
    }

    settled = true;
    const detail = sanitizeErrorMessage(message);
    void markProjectRunFailed(params.projectId, params.userId, detail).catch((dbError) => {
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
 * @access Privado (requiere autenticación Bearer y campo `projectName` o `title` en body)
 */
export const handleProjectUpload = async (req: Request, res: Response): Promise<void> => {
  try {
    const file = req.file;
    const payload = (req.body || {}) as UploadProjectPayloadLike;
    const projectNameRaw =
      typeof payload.projectName === 'string' && payload.projectName.trim().length > 0
        ? payload.projectName
        : payload.title;
    const projectName = typeof projectNameRaw === 'string' ? projectNameRaw.trim() : '';
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

    // Validar nombre del proyecto
    if (!projectName) {
      sendErrorResponse(res, 'Missing or invalid project name/title', null, 400);
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

      sendErrorResponse(res, 'A project with the same name already exists', null, 409);
      return;
    }

    // Construir la ruta relativa del archivo, manteniendo la misma sanitización que multer
    const emailPrefix = sanitizeEmailPrefix(user.email);
    const projectFolder = sanitizeName(projectName);
    const relativePath = path.posix.join(emailPrefix, projectFolder, file.filename);

    // Insertar proyecto en la base de datos
    const id_project = await createProject(
      user.id_user,
      projectName,
      description,
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

    if (isDuplicateEntryError(error)) {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        try {
          fs.rmSync(req.file.path, { force: true });
        } catch (cleanupError) {
          console.error('[FS] Error cleaning file after duplicate key:', cleanupError);
        }
      }
      sendErrorResponse(res, 'A project with the same name already exists', null, 409);
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

    if (project.locked_at) {
      sendErrorResponse(res, 'Project is locked and cannot be deleted after analysis start', null, 409);
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

    if (project.locked_at) {
      sendErrorResponse(res, 'This project already started analysis and is locked', null, 409);
      return;
    }

    // Normaliza body para un contrato estable hacia el ejecutor.
    const parsed = normalizeRunParams((req.body || {}) as Record<string, unknown>);
    if (!parsed.params) {
      sendErrorResponse(res, parsed.error || 'Invalid analysis parameters', null, 400);
      return;
    }

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
    const sampleValidation = validateSampleNamesAndBatch(inputPath, parsed.params);
    if (!sampleValidation.ok) {
      sendErrorResponse(res, sampleValidation.error, null, 400);
      return;
    }

    const outputDir = path.dirname(inputPath);
    const resultPath = path.relative(path.resolve(basePath), outputDir).split(path.sep).join('/');

    const scriptPath = process.env.ANALYSIS_SCRIPT_PATH;
    if (!scriptPath || !fs.existsSync(scriptPath)) {
      sendErrorResponse(
        res,
        'Analysis runtime is not configured correctly on server (ANALYSIS_SCRIPT_PATH)',
        null,
        500
      );
      return;
    }

    // Bloquea proyecto de forma atómica para evitar ejecuciones concurrentes.
    const locked = await lockProjectForRun(projectId, user.id_user, parsed.params, resultPath);

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
      resultPath,
      runParams: parsed.params,
    });

    sendSuccessResponse(
      res,
      'Analysis started successfully',
      {
        id_project: projectId,
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

    if (project.status !== 'completed') {
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
      id_project: project.id_project,
      status: project.status,
      result_path: project.result_path,
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

    if (project.status !== 'completed') {
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
