/**
 * @file Contratos y entidad de proyecto.
 * Este módulo define únicamente tipos/entidades, sin parseo de DB.
 *
 * @module models/Project
 */

export type ProjectStatus = 'PENDING' | 'PROCESSING' | 'FAILED' | 'COMPLETED';

export type NullableDateValue = Date | string | null | undefined;

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

// Fila cruda de la tabla `projects` en MariaDB.
export interface ProjectRow {
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

export interface ProjectRecordParams {
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
}

// Entidad interna usada por el backend para operar un proyecto ya normalizado.
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

  constructor(params: ProjectRecordParams) {
    this.id_project = params.id_project;
    this.user_id = params.user_id;
    this.title = params.title;
    this.description = params.description;
    this.path = params.path;
    this.imageUrl = params.imageUrl;
    this.samples = params.samples;
    this.selectedMethods = params.selectedMethods;
    this.comparisons = params.comparisons;
    this.parameters = params.parameters;
    this.status = params.status;
    this.created_at = params.created_at;
    this.updated_at = params.updated_at;
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
