/**
 * @file Helpers compartidos del módulo de análisis.
 *
 * @module api/analysis/controllers/analysis.shared.controller
 */

import fs from 'fs';
import path from 'path';
import { spawn, spawnSync } from 'child_process';
import { Request } from 'express';
import { sanitizeEmailPrefix, sanitizeName } from '../../../utils/file';
import {
  AnalysisRunParams,
  ProjectRunConfigPayload,
  markProjectRunCompleted,
  markProjectRunFailed,
} from '../analysis.service';
import {
  AnalysisRunPayloadLike,
  FrontMethodsSelectionLike,
  FrontSampleLike,
  UploadProjectPayloadLike,
} from '../analysis.types';
import {
  type DifferentialExpression,
  type DifferentialExpressionComparison,
  type MethodStatus,
  type OutputFile,
  type Plot,
  type PlotType,
  type ProjectResults,
  type ProjectRunStatus,
} from '../../../models/ProjectResults';
import { type ProjectRecord } from '../../../models/Project';

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
const RESULT_VISUAL_FILE_PATTERN = /\.(png|jpg|jpeg|svg|pdf)$/i;
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
  methodLabel: DifferentialExpression['method'];
  methodResultFolder: string;
}

const STRUCTURED_DE_METHODS: MethodDirectoryConfig[] = [
  { methodLabel: 'EdgeR', methodResultFolder: 'edgeR_Results' },
  { methodLabel: 'DESeq2', methodResultFolder: 'DESeq2_Results' },
  { methodLabel: 'Limma', methodResultFolder: 'limma_Results' },
  { methodLabel: 'NOISeq', methodResultFolder: 'NOISeq_Results' },
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
  const extension = path.extname(normalized);
  const isVisual = ['.png', '.jpg', '.jpeg', '.svg', '.pdf'].includes(extension);
  if (!isVisual) {
    return null;
  }

  if (normalized.includes('boxplot') || normalized.includes('box_plot')) {
    return 'boxplot';
  }

  if (normalized.includes('density')) {
    return 'density';
  }

  if (normalized.includes('pca')) {
    return 'pca';
  }

  if (normalized.includes('mds')) {
    return 'mds';
  }

  if (normalized.includes('cpm')) {
    return 'cpm';
  }

  if (normalized.includes('md')) {
    return 'md';
  }

  return null;
};

/**
 * Infiere tipo de plot para gráficas por comparación (DE).
 */
const inferComparisonPlotType = (fileName: string): PlotType => {
  const normalized = fileName.toLowerCase();

  if (normalized.includes('plotvolcano')) {
    return 'plotVolcano';
  }
  if (normalized.includes('plotmds')) {
    return 'plotMDS';
  }
  if (normalized.includes('plotsmear')) {
    return 'plotSmear';
  }
  if (normalized.includes('plotma')) {
    return 'plotMA';
  }
  if (normalized.includes('plotpca')) {
    return 'plotPCA';
  }
  if (normalized.includes('plotmd')) {
    return 'plotMD';
  }

  if (normalized.includes('boxplot') || normalized.includes('box_plot')) {
    return 'boxplot';
  }
  if (normalized.includes('density')) {
    return 'density';
  }
  if (normalized.includes('pca')) {
    return 'pca';
  }
  if (normalized.includes('mds')) {
    return 'mds';
  }
  if (normalized.includes('cpm')) {
    return 'cpm';
  }
  if (normalized.includes('md')) {
    return 'md';
  }

  return '';
};

/**
 * Infiere etiqueta de método por prefijo de ruta de archivo.
 */
const inferMethodLabelFromFilePath = (fileName: string): string | undefined => {
  const normalized = fileName.toLowerCase();
  if (normalized.startsWith('edger_results/')) {
    return 'EdgeR';
  }
  if (normalized.startsWith('deseq2_results/')) {
    return 'DESeq2';
  }
  if (normalized.startsWith('limma_results/')) {
    return 'Limma';
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
 * Devuelve todas las imágenes de una comparación ordenadas por relevancia visual.
 */
const findAllComparisonPlotFileNames = (comparisonPath: string): string[] => {
  if (!fs.existsSync(comparisonPath) || !fs.statSync(comparisonPath).isDirectory()) {
    return [];
  }

  const entries = fs.readdirSync(comparisonPath, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && RESULT_VISUAL_FILE_PATTERN.test(entry.name))
    .map((entry) => entry.name);

  files.sort((a, b) => {
    const scoreDiff = scoreResultImageCandidate(b) - scoreResultImageCandidate(a);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    return a.localeCompare(b);
  });

  return files;
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
export const getProjectsBasePath = (): string => {
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
export const buildAnalysisRuntimeCommand = (params: {
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
export const extractUploadImageUrl = (payload: UploadProjectPayloadLike): string | undefined => {
  if (typeof payload.imageUrl !== 'string') {
    return undefined;
  }

  const normalized = payload.imageUrl.trim();
  return normalized.length > 0 ? normalized : undefined;
};

/**
 * Detecta errores de duplicado de llave única devueltos por MariaDB.
 */
export const isDuplicateEntryError = (error: unknown): boolean => {
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
export const resolveProjectAbsolutePath = (basePath: string, projectRelativePath: string): string | null => {
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
export const resolveResultDirectory = (basePath: string, project: { path: string }): string | null => {
  const normalizedRelativePath = project.path.replace(/\\/g, '/');
  return resolveProjectAbsolutePath(basePath, path.posix.dirname(normalizedRelativePath));
};

/**
 * Resuelve rutas candidatas de carpeta de proyecto para limpieza en FS.
 * Incluye variantes para compatibilidad con datos legacy.
 */
export const resolveProjectDirectoryCandidates = (
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
export const isAllowedResultFile = (fileName: string): boolean => {
  const ext = path.extname(fileName).toLowerCase();
  return RESULT_FILE_EXTENSION_ALLOWLIST.has(ext);
};

/**
 * Infere MIME type por extensión para render inline o descarga.
 */
export const inferMimeType = (fileName: string): string => {
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
export const listProjectResultFiles = (resultDir: string, currentDir = resultDir): ProjectResultFile[] => {
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
 * Resuelve la ruta de imagen a exponer en API:
 * - Si el archivo ya es imagen (png/jpg/svg), regresa la ruta original.
 * - Si es PDF, intenta convertir primera página a PNG y regresa esa ruta.
 * - Si no se puede convertir, regresa el PDF original como fallback.
 */
const resolveApiImagePath = (resultDir: string, relativePath: string): string => {
  const extension = path.extname(relativePath).toLowerCase();
  if (extension !== RESULT_IMAGE_PDF_EXTENSION) {
    return relativePath;
  }

  const previewPath = tryGenerateCoverPreviewFromPdf(resultDir, relativePath);
  return previewPath || relativePath;
};

/**
 * Genera previews PNG para todos los PDFs del directorio de resultados.
 * Se ejecuta al finalizar la corrida para que las URLs de imagen estén listas
 * sin conversión perezosa en la primera consulta.
 */
const generatePngPreviewsForAllResultPdfs = (resultDir: string): void => {
  const files = listProjectResultFiles(resultDir);
  const pdfFiles = files.filter(
    (file) => path.extname(file.name).toLowerCase() === RESULT_IMAGE_PDF_EXTENSION
  );

  for (const pdf of pdfFiles) {
    tryGenerateCoverPreviewFromPdf(resultDir, pdf.name);
  }
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
export const resolveResultFilePath = (resultDir: string, fileName: string): string | null => {
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
export const resolveProjectResultArchive = (resultDir: string): ProjectResultArchive | null => {
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
export const validateSampleNamesAndBatch = (
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
export const normalizeRunRequest = (
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
export const executeAnalysisInBackground = (params: {
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
    // Convierte todos los PDFs a PNG al cierre de la corrida exitosa.
    generatePngPreviewsForAllResultPdfs(params.outputDir);
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
export const buildStructuredProjectResultsPayload = (
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
      { enabled: project.selectedMethods.edgeR, label: 'EdgeR' },
      { enabled: project.selectedMethods.deseq2, label: 'DESeq2' },
      { enabled: project.selectedMethods.limma, label: 'Limma' },
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
        case 'EdgeR':
          return project.selectedMethods.edgeR;
        case 'DESeq2':
          return project.selectedMethods.deseq2;
        case 'Limma':
          return project.selectedMethods.limma;
        case 'NOISeq':
          return project.selectedMethods.noiseq;
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
      const plotFileNames = findAllComparisonPlotFileNames(comparisonPath);
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
      const plots = Array.from(
        new Map(
          plotFileNames.map((plotFileName) => {
            const imageUrl = buildProjectFileInlineUrl(
              apiBaseUrl,
              project.id_project,
              resolveApiImagePath(
                resultDir,
                toPosixPath(path.join(methodConfig.methodResultFolder, comparisonName, plotFileName))
              )
            );
            return [imageUrl, { type: inferComparisonPlotType(plotFileName), imageUrl }];
          })
        ).values()
      );

      comparisons.push({
        name: comparisonName,
        upregulated,
        downregulated,
        significant,
        plots,
        topGenes,
      });
    }

    differentialExpression.push({
      method: methodConfig.methodLabel,
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
        imageUrl: buildProjectFileInlineUrl(
          apiBaseUrl,
          project.id_project,
          resolveApiImagePath(resultDir, file.name)
        ),
      } as Plot;
    })
    .filter((plot): plot is Plot => !!plot);

  const vennDiagrams = files
    .filter((file) => /venn/i.test(file.name) && /image|pdf/.test(file.mime_type))
    .map((file) => ({
      id: sanitizeName(file.name) || path.basename(file.name),
      title: path.basename(file.name),
      imageUrl: buildProjectFileInlineUrl(
        apiBaseUrl,
        project.id_project,
        resolveApiImagePath(resultDir, file.name)
      ),
    }));

  const heatmaps = files
    .filter((file) => /heatmap/i.test(file.name) && /image|pdf/.test(file.mime_type))
    .map((file) => ({
      id: sanitizeName(file.name) || path.basename(file.name),
      title: path.basename(file.name),
      imageUrl: buildProjectFileInlineUrl(
        apiBaseUrl,
        project.id_project,
        resolveApiImagePath(resultDir, file.name)
      ),
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
