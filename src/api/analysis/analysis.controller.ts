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
import { spawn, spawnSync } from 'child_process';
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
import {
  type DifferentialExpression,
  type DifferentialExpressionComparison,
  type MethodStatus,
  type OutputFile,
  type Plot,
  type PlotType,
  type ProjectResults,
  type ProjectRunStatus,
} from '../../models/ProjectResults';
import { type ProjectRecord } from '../../models/Project';

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
const RESULT_IMAGE_EXTENSION_ALLOWLIST = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.svg',
  '.pdf',
]);
const RESULT_IMAGE_PDF_EXTENSION = '.pdf';
const RESULT_ARCHIVE_ZIP_NAME = 'DiffExpAllResults.zip';
const RESULT_ARCHIVE_TAR_GZ_NAME = 'DiffExpAllResults.tar.gz';
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

interface ProjectResultArchive {
  absolute_path: string;
  mime_type: string;
  extension: 'zip' | 'tar.gz';
}

interface ProjectCoverCandidate {
  name: string;
  score: number;
}

type AnalysisExecutionMode = 'local' | 'docker';

interface AnalysisRuntimeCommand {
  command: string;
  args: string[];
}

interface MethodDirectoryConfig {
  methodLabel: string;
  methodResultFolder: string;
}

const STRUCTURED_DE_METHODS: MethodDirectoryConfig[] = [
  { methodLabel: 'edgeR', methodResultFolder: 'edgeR_Results' },
  { methodLabel: 'DESeq2', methodResultFolder: 'DESeq2_Results' },
  { methodLabel: 'limma', methodResultFolder: 'limma_Results' },
];

/**
 * Mapea estado interno de proyecto al estado de corrida esperado por frontend.
 */
const mapProjectStatusToRunStatus = (status: string): ProjectRunStatus => {
  switch (status) {
    case 'PROCESSING':
      return 'running';
    case 'COMPLETED':
      return 'completed';
    case 'FAILED':
      return 'failed';
    case 'PENDING':
    default:
      return 'pending';
  }
};

/**
 * Construye URL relativa para descarga total del proyecto.
 */
const buildProjectArchiveDownloadUrl = (baseUrl: string, projectId: number): string =>
  `${baseUrl}/project/${projectId}/results/archive`;

/**
 * Construye URL relativa para descarga de archivo individual.
 */
const buildProjectFileDownloadUrl = (
  baseUrl: string,
  projectId: number,
  fileName: string
): string =>
  `${baseUrl}/project/${projectId}/results/file?name=${encodeURIComponent(fileName)}&download=true`;

/**
 * Construye URL relativa para visualización inline de archivo individual.
 */
const buildProjectFileInlineUrl = (
  baseUrl: string,
  projectId: number,
  fileName: string
): string =>
  `${baseUrl}/project/${projectId}/results/file?name=${encodeURIComponent(fileName)}`;

/**
 * Normaliza separador para parseo tabular simple (TSV/CSV/espacios).
 */
const splitRowByDetectedSeparator = (line: string, separator: ',' | '\t' | null): string[] => {
  if (separator) {
    return line.split(separator).map((cell) => cell.trim());
  }

  return line.trim().split(/\s+/).map((cell) => cell.trim());
};

/**
 * Obtiene índice de columna usando una lista de patrones sobre encabezado normalizado.
 */
const findHeaderColumnIndex = (headers: string[], patterns: RegExp[]): number => {
  return headers.findIndex((header) => patterns.some((pattern) => pattern.test(header)));
};

/**
 * Convierte cadena numérica a number, tolerando comas.
 */
const parseNumericCell = (value: string | undefined): number | null => {
  if (!value) {
    return null;
  }

  const normalized = value.trim().replace(',', '.');
  if (normalized.length === 0) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Lee un archivo tabular de texto y devuelve encabezado + filas.
 */
const parseDelimitedTableFile = (
  filePath: string
): { headers: string[]; rows: string[][] } | null => {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    return null;
  }

  const separator = detectCountTableSeparator(lines[0]);
  const headers = splitRowByDetectedSeparator(lines[0], separator).map((column) =>
    column.toLowerCase()
  );
  const rows = lines.slice(1).map((line) => splitRowByDetectedSeparator(line, separator));

  return { headers, rows };
};

/**
 * Cuenta genes del archivo de entrada (filas sin encabezado).
 */
const countGenesFromInputFile = (inputFilePath: string): number => {
  if (!fs.existsSync(inputFilePath) || !fs.statSync(inputFilePath).isFile()) {
    return 0;
  }

  const raw = fs.readFileSync(inputFilePath, 'utf8');
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return 0;
  }

  return Math.max(lines.length - 1, 0);
};

/**
 * Detecta tipo de plot soportado en contrato estructurado.
 */
const detectStructuredPlotType = (fileName: string): PlotType | null => {
  const normalized = fileName.toLowerCase();
  if (normalized.includes('boxplot') || normalized.includes('box_plot')) {
    return 'boxplot';
  }

  if (normalized.includes('density')) {
    return 'density';
  }

  if (normalized.includes('pca')) {
    return 'pca';
  }

  return null;
};

/**
 * Infiere etiqueta de método por prefijo de ruta de archivo.
 */
const inferMethodLabelFromFilePath = (fileName: string): string | undefined => {
  const normalized = fileName.toLowerCase();
  if (normalized.startsWith('edger_results/')) {
    return 'edgeR';
  }
  if (normalized.startsWith('deseq2_results/')) {
    return 'DESeq2';
  }
  if (normalized.startsWith('limma_results/')) {
    return 'limma';
  }
  if (normalized.startsWith('noiseq_results/')) {
    return 'NOISeq';
  }
  if (normalized.startsWith('integration_results/')) {
    return 'integrationResults';
  }

  return undefined;
};

/**
 * Obtiene lista única de comparaciones candidatas para un método.
 */
const resolveComparisonNamesForMethod = (
  methodFolderPath: string,
  comparisons: Array<{ base: string; target: string }> | null
): string[] => {
  const fromProjectConfig = (comparisons || [])
    .map((comparison) => `${comparison.target}vs${comparison.base}`)
    .filter((name) => name.trim().length > 0);

  const fromMethodFolder: string[] = [];
  if (fs.existsSync(methodFolderPath) && fs.statSync(methodFolderPath).isDirectory()) {
    const entries = fs.readdirSync(methodFolderPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        fromMethodFolder.push(entry.name);
      }
    }
  }

  return Array.from(new Set([...fromProjectConfig, ...fromMethodFolder])).sort((a, b) =>
    a.localeCompare(b)
  );
};

/**
 * Busca el primer archivo existente cuyo nombre cumpla un patrón dentro de un directorio.
 */
const findFirstFileInDirectoryByPattern = (
  directoryPath: string,
  fileNamePattern: RegExp
): string | null => {
  if (!fs.existsSync(directoryPath) || !fs.statSync(directoryPath).isDirectory()) {
    return null;
  }

  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && fileNamePattern.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  return files.length > 0 ? files[0] : null;
};

/**
 * Parsea genes top (gene, logFC, pValue) desde archivo *_TOP.txt.
 */
const parseTopGenesFromTopFile = (
  topFilePath: string,
  limit = 20
): Array<{ gene: string; logFC: number; pValue: number }> => {
  const table = parseDelimitedTableFile(topFilePath);
  if (!table) {
    return [];
  }

  const geneIndex = findHeaderColumnIndex(table.headers, [/^gene$/, /symbol/, /id$/]);
  const logFCIndex = findHeaderColumnIndex(table.headers, [/logfc/, /^lfc$/]);
  const pValueIndex = findHeaderColumnIndex(table.headers, [/pvalue/, /p\.value/, /fdr/, /padj/]);

  if (geneIndex < 0) {
    return [];
  }

  const output: Array<{ gene: string; logFC: number; pValue: number }> = [];

  for (const row of table.rows) {
    const gene = row[geneIndex];
    if (!gene || gene.trim().length === 0) {
      continue;
    }

    const logFC = parseNumericCell(logFCIndex >= 0 ? row[logFCIndex] : undefined) ?? 0;
    const pValue = parseNumericCell(pValueIndex >= 0 ? row[pValueIndex] : undefined) ?? 1;

    output.push({
      gene: gene.trim(),
      logFC,
      pValue,
    });

    if (output.length >= limit) {
      break;
    }
  }

  return output;
};

/**
 * Calcula conteos de regulación a partir de un archivo diferencial principal.
 */
const parseDifferentialCountsFromMainFile = (
  mainFilePath: string,
  significanceThreshold: number
): { upregulated: number; downregulated: number; significant: number } => {
  const table = parseDelimitedTableFile(mainFilePath);
  if (!table) {
    return { upregulated: 0, downregulated: 0, significant: 0 };
  }

  const logFCIndex = findHeaderColumnIndex(table.headers, [/logfc/, /^lfc$/]);
  const significanceIndex = findHeaderColumnIndex(table.headers, [/fdr/, /padj/, /pvalue/, /p\.value/]);

  if (logFCIndex < 0) {
    return { upregulated: 0, downregulated: 0, significant: 0 };
  }

  let upregulated = 0;
  let downregulated = 0;
  let significant = 0;

  for (const row of table.rows) {
    const logFC = parseNumericCell(row[logFCIndex]);
    if (logFC === null) {
      continue;
    }

    const significanceValue =
      significanceIndex >= 0 ? parseNumericCell(row[significanceIndex]) : null;
    const isSignificant =
      significanceValue === null ? true : significanceValue <= significanceThreshold;

    if (!isSignificant) {
      continue;
    }

    significant += 1;
    if (logFC >= 0) {
      upregulated += 1;
    } else {
      downregulated += 1;
    }
  }

  return { upregulated, downregulated, significant };
};

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

  const normalizedRelativePath = projectRelativePath.replace(/\\/g, '/');
  const normalizedBasePath = path.resolve(basePath);
  const absolutePath = path.resolve(normalizedBasePath, ...normalizedRelativePath.split('/'));

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
  const normalizedRelativePath = project.path.replace(/\\/g, '/');
  return resolveProjectAbsolutePath(basePath, path.posix.dirname(normalizedRelativePath));
};

/**
 * Resuelve rutas candidatas de carpeta de proyecto para limpieza en FS.
 * Incluye variantes para compatibilidad con datos legacy.
 */
const resolveProjectDirectoryCandidates = (
  basePath: string,
  project: { path: string; title: string },
  userEmail?: string
): string[] => {
  const candidates = new Set<string>();

  const normalizedRelativePath = project.path.replace(/\\/g, '/');
  const fromPath = resolveProjectAbsolutePath(basePath, path.posix.dirname(normalizedRelativePath));
  if (fromPath) {
    candidates.add(fromPath);
  }

  if (normalizedRelativePath.startsWith('projects/')) {
    const withoutPrefix = normalizedRelativePath.slice('projects/'.length);
    const legacyPath = resolveProjectAbsolutePath(basePath, path.posix.dirname(withoutPrefix));
    if (legacyPath) {
      candidates.add(legacyPath);
    }
  }

  if (typeof userEmail === 'string' && userEmail.trim().length > 0) {
    const byTitlePath = resolveProjectAbsolutePath(
      basePath,
      path.posix.join(sanitizeEmailPrefix(userEmail), sanitizeName(project.title))
    );
    if (byTitlePath) {
      candidates.add(byTitlePath);
    }
  }

  const normalizedBasePath = path.resolve(basePath);
  return Array.from(candidates).filter((folderPath) => {
    const normalizedFolder = path.resolve(folderPath);
    return normalizedFolder !== normalizedBasePath;
  });
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
 * Asigna prioridad visual a imágenes de resultados para portada del proyecto.
 * Se favorecen gráficos comúnmente más representativos (MDS/volcano/heatmap/PCA).
 */
const scoreResultImageCandidate = (fileName: string): number => {
  const normalized = fileName.toLowerCase();

  const keywordScores: Array<{ pattern: RegExp; score: number }> = [
    { pattern: /volcano/, score: 100 },
    { pattern: /heatmap/, score: 95 },
    { pattern: /pca|pc-?a/, score: 90 },
    { pattern: /mds/, score: 85 },
    { pattern: /corrplot|correlation/, score: 80 },
    { pattern: /ma[-_ ]?plot|maplot/, score: 75 },
    { pattern: /boxplot|box[-_ ]?plot/, score: 70 },
    { pattern: /barplot|bar[-_ ]?plot/, score: 65 },
    { pattern: /plot|graph|figure|fig/, score: 50 },
  ];

  for (const rule of keywordScores) {
    if (rule.pattern.test(normalized)) {
      return rule.score;
    }
  }

  return 10;
};

/**
 * Selecciona una imagen candidata para `image_url` dentro de la carpeta de resultados.
 * Devuelve la ruta relativa al directorio de resultados.
 */
const selectProjectCoverImageFromResults = (
  resultDir: string,
  options?: { includePdf?: boolean }
): string | null => {
  const includePdf = options?.includePdf ?? true;
  const files = listProjectResultFiles(resultDir);
  const candidates: ProjectCoverCandidate[] = files
    .filter((file) => {
      const extension = path.extname(file.name).toLowerCase();
      if (!RESULT_IMAGE_EXTENSION_ALLOWLIST.has(extension)) {
        return false;
      }
      if (!includePdf && extension === RESULT_IMAGE_PDF_EXTENSION) {
        return false;
      }
      return true;
    })
    .map((file) => ({
      name: file.name,
      score: scoreResultImageCandidate(file.name),
    }));

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.name.localeCompare(b.name);
  });

  return candidates[0].name;
};

/**
 * Intenta convertir la primera página de un PDF de resultados a PNG para portada.
 * Regresa la ruta relativa (a `resultDir`) del PNG generado.
 */
const tryGenerateCoverPreviewFromPdf = (
  resultDir: string,
  relativePdfPath: string
): string | null => {
  if (path.extname(relativePdfPath).toLowerCase() !== RESULT_IMAGE_PDF_EXTENSION) {
    return null;
  }

  const absolutePdfPath = resolveResultFilePath(resultDir, relativePdfPath);
  if (!absolutePdfPath || !fs.existsSync(absolutePdfPath) || !fs.statSync(absolutePdfPath).isFile()) {
    return null;
  }

  const pdfDir = path.dirname(absolutePdfPath);
  const pdfBaseName = path.basename(absolutePdfPath, RESULT_IMAGE_PDF_EXTENSION);
  const previewBaseName = pdfBaseName;
  const previewBasePath = path.join(pdfDir, previewBaseName);
  const previewPngPath = `${previewBasePath}.png`;

  // Si ya existe preview, la reutiliza para evitar trabajo repetido.
  if (fs.existsSync(previewPngPath) && fs.statSync(previewPngPath).isFile()) {
    return toPosixPath(path.relative(resultDir, previewPngPath));
  }

  const pdftoppmBin = (process.env.ANALYSIS_PDFTOPPM_BIN || 'pdftoppm').trim() || 'pdftoppm';
  const conversion = spawnSync(
    pdftoppmBin,
    ['-png', '-f', '1', '-singlefile', absolutePdfPath, previewBasePath],
    {
      encoding: 'utf-8',
    }
  );

  if (conversion.error || conversion.status !== 0) {
    const details = conversion.error?.message || conversion.stderr || conversion.stdout || '';
    console.warn(
      `[ANALYSIS] Unable to generate PNG preview with "${pdftoppmBin}" from "${relativePdfPath}": ${details.trim()}`
    );
    return null;
  }

  if (!fs.existsSync(previewPngPath) || !fs.statSync(previewPngPath).isFile()) {
    return null;
  }

  return toPosixPath(path.relative(resultDir, previewPngPath));
};

/**
 * Resuelve la ruta relativa final para `image_url` del proyecto
 * (relativa a `PROJECTS_BASE_PATH`).
 */
const resolveProjectCoverImagePath = (outputDir: string): string | null => {
  let relativeImageFromResult = selectProjectCoverImageFromResults(outputDir);
  if (!relativeImageFromResult) {
    return null;
  }

  // Si la mejor portada es PDF, intenta generar PNG para compatibilidad de UI.
  if (path.extname(relativeImageFromResult).toLowerCase() === RESULT_IMAGE_PDF_EXTENSION) {
    const generatedPreview = tryGenerateCoverPreviewFromPdf(outputDir, relativeImageFromResult);
    if (generatedPreview) {
      relativeImageFromResult = generatedPreview;
    } else {
      // Fallback: usa la mejor imagen no-PDF disponible si existe.
      const nonPdfCandidate = selectProjectCoverImageFromResults(outputDir, { includePdf: false });
      if (nonPdfCandidate) {
        relativeImageFromResult = nonPdfCandidate;
      }
    }
  }

  const projectsBasePath = getProjectsBasePath();
  if (!isPathInsideBase(projectsBasePath, outputDir)) {
    return null;
  }

  const relativeOutputDir = toPosixPath(path.relative(projectsBasePath, outputDir));
  const normalizedImagePath = relativeImageFromResult.split(path.sep).join('/');

  return path.posix.join(relativeOutputDir, normalizedImagePath);
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
 * Intenta crear un zip con todos los resultados dentro de `resultDir`.
 * Si el comando `zip` no está disponible o falla, regresa null y se usa fallback.
 */
const tryCreateProjectResultZip = (resultDir: string): string | null => {
  const zipPath = path.join(resultDir, RESULT_ARCHIVE_ZIP_NAME);

  if (fs.existsSync(zipPath) && fs.statSync(zipPath).isFile()) {
    return zipPath;
  }

  const zipBin = (process.env.ANALYSIS_ZIP_BIN || 'zip').trim() || 'zip';
  const zipExecution = spawnSync(
    zipBin,
    ['-r', '-q', RESULT_ARCHIVE_ZIP_NAME, '.', '-x', RESULT_ARCHIVE_ZIP_NAME],
    {
      cwd: resultDir,
      encoding: 'utf-8',
    }
  );

  if (zipExecution.error || zipExecution.status !== 0) {
    const details = zipExecution.error?.message || zipExecution.stderr || zipExecution.stdout || '';
    console.warn(`[RESULTS] Unable to generate zip archive with "${zipBin}": ${details.trim()}`);
    return null;
  }

  if (!fs.existsSync(zipPath) || !fs.statSync(zipPath).isFile()) {
    return null;
  }

  return zipPath;
};

/**
 * Resuelve el archivo comprimido de resultados para descarga:
 * 1) zip existente o generado on-demand
 * 2) fallback al tar.gz generado por el pipeline de R.
 */
const resolveProjectResultArchive = (resultDir: string): ProjectResultArchive | null => {
  const zipPath = tryCreateProjectResultZip(resultDir);
  if (zipPath) {
    return {
      absolute_path: zipPath,
      mime_type: 'application/zip',
      extension: 'zip',
    };
  }

  const tarPath = path.join(resultDir, RESULT_ARCHIVE_TAR_GZ_NAME);
  if (fs.existsSync(tarPath) && fs.statSync(tarPath).isFile()) {
    return {
      absolute_path: tarPath,
      mime_type: 'application/gzip',
      extension: 'tar.gz',
    };
  }

  return null;
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
    const coverImagePath = resolveProjectCoverImagePath(params.outputDir);
    void markProjectRunCompleted(params.projectId, params.userId, coverImagePath).catch((dbError) => {
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

    if (project.status === 'PROCESSING') {
      sendErrorResponse(
        res,
        'Project cannot be deleted while analysis is running',
        null,
        409
      );
      return;
    }

    // Resuelve ruta absoluta segura para evitar borrar fuera del storage permitido.
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

      // Limpieza opcional: elimina la carpeta de usuario si quedó vacía.
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
 * Construye payload estructurado de resultados conforme a `models/ProjectResults.ts`.
 */
const buildStructuredProjectResultsPayload = (
  req: Request,
  project: ProjectRecord,
  basePath: string,
  resultDir: string
): ProjectResults => {
  const apiBaseUrl = (req.baseUrl || '/analysis').replace(/\/+$/, '');
  const files = listProjectResultFiles(resultDir);
  const inputFilePath = resolveProjectAbsolutePath(basePath, project.path);
  const headerData =
    inputFilePath && fs.existsSync(inputFilePath) ? parseCountTableHeader(inputFilePath) : null;

  const samplesAnalyzed =
    project.samples?.length || headerData?.sampleNames.length || 0;
  const totalGenes =
    inputFilePath && fs.existsSync(inputFilePath) ? countGenesFromInputFile(inputFilePath) : 0;
  const runStatus = mapProjectStatusToRunStatus(project.status);
  const startedAt = project.created_at?.toISOString?.();
  const completedAt =
    project.status === 'COMPLETED' || project.status === 'FAILED'
      ? project.updated_at.toISOString()
      : null;

  const methodsStatus: MethodStatus[] = [];
  if (project.selectedMethods) {
    const methodSelectionMatrix: Array<{ enabled: boolean; label: string }> = [
      { enabled: project.selectedMethods.edgeR, label: 'edgeR' },
      { enabled: project.selectedMethods.deseq2, label: 'DESeq2' },
      { enabled: project.selectedMethods.limma, label: 'limma' },
      { enabled: project.selectedMethods.noiseq, label: 'NOISeq' },
      { enabled: project.selectedMethods.dataAnalysis, label: 'dataAnalysis' },
      { enabled: project.selectedMethods.integrationResults, label: 'integrationResults' },
    ];

    for (const row of methodSelectionMatrix) {
      if (!row.enabled) {
        continue;
      }

      methodsStatus.push({
        method: row.label,
        status: runStatus,
        startedAt,
        completedAt: completedAt || undefined,
      });
    }
  }

  const significanceThreshold = (() => {
    const parsed = Number(project.parameters?.fdr || '');
    return Number.isFinite(parsed) && parsed > 0 && parsed < 1 ? parsed : 0.05;
  })();

  const differentialExpression: DifferentialExpression[] = [];
  for (const methodConfig of STRUCTURED_DE_METHODS) {
    const methodEnabled = (() => {
      if (!project.selectedMethods) {
        return true;
      }

      switch (methodConfig.methodLabel) {
        case 'edgeR':
          return project.selectedMethods.edgeR;
        case 'DESeq2':
          return project.selectedMethods.deseq2;
        case 'limma':
          return project.selectedMethods.limma;
        default:
          return false;
      }
    })();

    if (!methodEnabled) {
      continue;
    }

    const methodFolderPath = path.join(resultDir, methodConfig.methodResultFolder);
    const comparisonNames = resolveComparisonNamesForMethod(
      methodFolderPath,
      project.comparisons
        ? project.comparisons.map((comparison) => ({
            base: comparison.base,
            target: comparison.target,
          }))
        : null
    );

    const comparisons: DifferentialExpressionComparison[] = [];
    for (const comparisonName of comparisonNames) {
      const comparisonPath = path.join(methodFolderPath, comparisonName);
      const topFileName = findFirstFileInDirectoryByPattern(comparisonPath, /(_top|top)\.txt$/i);
      const volcanoFileName = findFirstFileInDirectoryByPattern(
        comparisonPath,
        /volcano.*\.(png|jpg|jpeg|svg|pdf)$/i
      );
      const mainFileName = findFirstFileInDirectoryByPattern(
        comparisonPath,
        /^.*\.txt$/i
      );

      const topGenes = topFileName
        ? parseTopGenesFromTopFile(path.join(comparisonPath, topFileName))
        : [];

      const upFromTop = topGenes.filter((row) => row.logFC >= 0).length;
      const downFromTop = topGenes.filter((row) => row.logFC < 0).length;
      const mainCounts = mainFileName
        ? parseDifferentialCountsFromMainFile(
            path.join(comparisonPath, mainFileName),
            significanceThreshold
          )
        : { upregulated: 0, downregulated: 0, significant: 0 };

      const upregulated = mainCounts.upregulated > 0 ? mainCounts.upregulated : upFromTop;
      const downregulated = mainCounts.downregulated > 0 ? mainCounts.downregulated : downFromTop;
      const significant = mainCounts.significant > 0 ? mainCounts.significant : topGenes.length;

      comparisons.push({
        name: comparisonName,
        upregulated,
        downregulated,
        significant,
        volcanoPlotUrl: volcanoFileName
          ? buildProjectFileInlineUrl(
              apiBaseUrl,
              project.id_project,
              toPosixPath(
                path.join(methodConfig.methodResultFolder, comparisonName, volcanoFileName)
              )
            )
          : undefined,
        topGenes,
      });
    }

    differentialExpression.push({
      method: methodConfig.methodLabel as 'edgeR' | 'DESeq2' | 'limma',
      comparisons,
    });
  }

  const comparisonSummary = differentialExpression
    .flatMap((method) => method.comparisons)
    .reduce(
      (acc, comparison) => {
        acc.upregulated += comparison.upregulated;
        acc.downregulated += comparison.downregulated;
        acc.totalDifferential += comparison.significant;
        return acc;
      },
      { upregulated: 0, downregulated: 0, totalDifferential: 0 }
    );

  const outputFiles: OutputFile[] = files.map((file) => ({
    name: path.basename(file.name),
    path: file.name,
    sizeBytes: file.size_bytes,
    updatedAt: file.updated_at,
    mimeType: file.mime_type,
    method: inferMethodLabelFromFilePath(file.name),
    description: undefined,
    downloadUrl: buildProjectFileDownloadUrl(apiBaseUrl, project.id_project, file.name),
  }));

  const dataAnalysisPlots: Plot[] = files
    .map((file) => {
      const plotType = detectStructuredPlotType(file.name);
      if (!plotType) {
        return null;
      }

      return {
        id: sanitizeName(file.name) || path.basename(file.name),
        title: path.basename(file.name),
        type: plotType,
        imageUrl: buildProjectFileInlineUrl(apiBaseUrl, project.id_project, file.name),
      } as Plot;
    })
    .filter((plot): plot is Plot => !!plot);

  const vennDiagrams = files
    .filter((file) => /venn/i.test(file.name) && /image|pdf/.test(file.mime_type))
    .map((file) => ({
      id: sanitizeName(file.name) || path.basename(file.name),
      title: path.basename(file.name),
      imageUrl: buildProjectFileInlineUrl(apiBaseUrl, project.id_project, file.name),
    }));

  const heatmaps = files
    .filter((file) => /heatmap/i.test(file.name) && /image|pdf/.test(file.mime_type))
    .map((file) => ({
      id: sanitizeName(file.name) || path.basename(file.name),
      title: path.basename(file.name),
      imageUrl: buildProjectFileInlineUrl(apiBaseUrl, project.id_project, file.name),
    }));

  const totalResultBytes = files.reduce((acc, file) => acc + file.size_bytes, 0);

  return {
    projectId: String(project.id_project),
    projectTitle: project.title,
    description: project.description || '',
    status: runStatus,
    completedAt,
    summary: {
      samplesAnalyzed,
      totalGenes,
      methodsUsed: methodsStatus.length,
      comparisons: project.comparisons?.length || 0,
      methodsStatus,
      comparisonSummary,
    },
    dataAnalysis: {
      qcMetrics: [
        { label: 'result_files', value: files.length },
        { label: 'result_size', value: Number((totalResultBytes / (1024 * 1024)).toFixed(2)), unit: 'MB' },
        { label: 'selected_methods', value: methodsStatus.length },
      ],
      distributions: [],
      plots: dataAnalysisPlots,
    },
    differentialExpression,
    integratedResults: {
      vennDiagrams,
      consensusGenes: [],
      heatmaps,
      notes:
        project.selectedMethods && !project.selectedMethods.integrationResults
          ? 'Integration results were not selected for this run'
          : undefined,
    },
    outputFiles: {
      downloadAllUrl: buildProjectArchiveDownloadUrl(apiBaseUrl, project.id_project),
      files: outputFiles,
    },
  };
};

/**
 * Devuelve resultados estructurados de un proyecto finalizado.
 *
 * @route GET /analysis/project/:projectId/results/structured
 * @access Privado (requiere autenticación Bearer)
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

    const payload = buildStructuredProjectResultsPayload(req, project, basePath, resultDir);
    sendSuccessResponse(res, 'Project structured results retrieved successfully', payload, 200);
  } catch (error) {
    console.error('Error in handleGetProjectResultsStructured:', error);
    sendErrorResponse(res, 'Server error while retrieving structured project results', null, 500);
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
 * Descarga el archivo comprimido con todos los resultados del proyecto.
 *
 * @route GET /analysis/project/:projectId/results/archive
 * @access Privado (requiere autenticación Bearer)
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
