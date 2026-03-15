/**
 * @file Modelo de datos de proyectos.
 * Contrato público `Project` (frontend) + mapeo interno desde base de datos.
 *
 * @module models/Project
 */

export type ProjectStatus = 'PENDING' | 'PROCESSING' | 'FAILED' | 'COMPLETED';

type NullableDateValue = Date | string | null | undefined;

export interface Sample {
  name: string;
  batch: string;
}

export interface MethodsSelection {
  edgeR: boolean;
  limma: boolean;
  noiseq: boolean;
  deseq2: boolean;
  dataAnalysis: boolean;
  integrationResults: boolean;
}

export interface ProjectComparison {
  base: string;
  target: string;
  selected: boolean;
}

export interface AnalysisParameters {
  fdr: string;
  logFC: string;
  cpm: string;
  top: boolean;
  corrplot: boolean;
}

// Contrato de proyecto expuesto al frontend.
// Los campos de configuración pueden iniciar en `null` hasta ejecutar la corrida.
export interface Project {
  id?: number;
  title: string;
  description: string;
  imageUrl: string | undefined;
  file: File;
  samples: Sample[] | null;
  selectedMethods: MethodsSelection | null;
  comparisons: ProjectComparison[] | null;
  parameters: AnalysisParameters | null;
  createdAt?: Date;
  updatedAt?: Date;
  status?: ProjectStatus;
  userId?: string;
}

interface ProjectRow {
  id_project: number;
  title: string | null;
  description: string | null;
  image_url?: string | null;
  path: string;
  samples_json?: string | null;
  selected_methods_json?: string | null;
  comparisons_json?: string | null;
  parameters_json?: string | null;
  created_at: NullableDateValue;
  updated_at: NullableDateValue;
  status: ProjectStatus;
  user_id: number;
}

const DEFAULT_SELECTED_METHODS: MethodsSelection = {
  edgeR: false,
  limma: false,
  noiseq: false,
  deseq2: false,
  dataAnalysis: false,
  integrationResults: false,
};

const DEFAULT_PARAMETERS: AnalysisParameters = {
  fdr: '0.01',
  logFC: '1',
  cpm: '1',
  top: true,
  corrplot: false,
};

const normalizeDate = (value: NullableDateValue): Date | null => {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value : new Date(value);
};

const parseJsonOrNull = (value: string | null | undefined): unknown | null => {
  if (!value || value.trim().length === 0) {
    return null;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
};

const normalizeSelectedMethods = (value: unknown): MethodsSelection => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_SELECTED_METHODS };
  }

  const methods = value as Record<string, unknown>;
  return {
    edgeR: Boolean(methods.edgeR),
    limma: Boolean(methods.limma),
    noiseq: Boolean(methods.noiseq),
    deseq2: Boolean(methods.deseq2),
    dataAnalysis: Boolean(methods.dataAnalysis),
    integrationResults: Boolean(methods.integrationResults),
  };
};

const normalizeParameters = (value: unknown): AnalysisParameters => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_PARAMETERS };
  }

  const params = value as Record<string, unknown>;
  return {
    fdr:
      typeof params.fdr === 'string' && params.fdr.trim().length > 0
        ? params.fdr.trim()
        : DEFAULT_PARAMETERS.fdr,
    logFC:
      typeof params.logFC === 'string' && params.logFC.trim().length > 0
        ? params.logFC.trim()
        : typeof params.logfc === 'string' && params.logfc.trim().length > 0
          ? params.logfc.trim()
          : DEFAULT_PARAMETERS.logFC,
    cpm:
      typeof params.cpm === 'string' && params.cpm.trim().length > 0
        ? params.cpm.trim()
        : DEFAULT_PARAMETERS.cpm,
    top: params.top === undefined ? DEFAULT_PARAMETERS.top : Boolean(params.top),
    corrplot: params.corrplot === undefined ? DEFAULT_PARAMETERS.corrplot : Boolean(params.corrplot),
  };
};

const normalizeSamples = (value: unknown): Sample[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((row) => row && typeof row === 'object')
    .map((row) => row as Record<string, unknown>)
    .map((row) => ({
      name: typeof row.name === 'string' ? row.name.trim() : '',
      batch: row.batch === undefined || row.batch === null ? '' : String(row.batch).trim(),
    }))
    .filter((row) => row.name.length > 0);
};

const normalizeComparisons = (value: unknown): ProjectComparison[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((row) => row && typeof row === 'object')
    .map((row) => row as Record<string, unknown>)
    .map((row) => ({
      base: typeof row.base === 'string' ? row.base.trim() : '',
      target: typeof row.target === 'string' ? row.target.trim() : '',
      selected: Boolean(row.selected),
    }))
    .filter((row) => row.base.length > 0 && row.target.length > 0);
};

export class ProjectRecord {
  id_project: number;
  user_id: number;
  title: string;
  description: string;
  path: string;
  imageUrl: string | undefined;
  samples: Sample[] | null;
  selectedMethods: MethodsSelection | null;
  comparisons: ProjectComparison[] | null;
  parameters: AnalysisParameters | null;
  status: ProjectStatus;
  created_at: Date;
  updated_at: Date;

  constructor(row: ProjectRow) {
    this.id_project = row.id_project;
    this.user_id = row.user_id;
    this.title = typeof row.title === 'string' ? row.title.trim() : '';
    this.description = row.description || '';
    this.path = row.path;
    this.imageUrl = row.image_url || undefined;
    const samplesRaw = parseJsonOrNull(row.samples_json);
    const selectedMethodsRaw = parseJsonOrNull(row.selected_methods_json);
    const comparisonsRaw = parseJsonOrNull(row.comparisons_json);
    const parametersRaw = parseJsonOrNull(row.parameters_json);
    this.samples = samplesRaw === null ? null : normalizeSamples(samplesRaw);
    this.selectedMethods =
      selectedMethodsRaw === null ? null : normalizeSelectedMethods(selectedMethodsRaw);
    this.comparisons = comparisonsRaw === null ? null : normalizeComparisons(comparisonsRaw);
    this.parameters = parametersRaw === null ? null : normalizeParameters(parametersRaw);
    this.status = row.status;
    this.created_at = normalizeDate(row.created_at) || new Date(0);
    this.updated_at = normalizeDate(row.updated_at) || new Date(0);
  }

  static fromDatabaseRow(row: ProjectRow): ProjectRecord {
    return new ProjectRecord(row);
  }

  toProject(): Project {
    return {
      id: this.id_project,
      title: this.title,
      description: this.description,
      // `undefined` no viaja en JSON; serializamos `null` para mantener la llave.
      imageUrl: (this.imageUrl ?? null) as unknown as string | undefined,
      file: this.path as unknown as File,
      samples: this.samples,
      selectedMethods: this.selectedMethods,
      comparisons: this.comparisons,
      parameters: this.parameters,
      createdAt: this.created_at,
      updatedAt: this.updated_at,
      status: this.status,
      userId: String(this.user_id),
    };
  }
}
