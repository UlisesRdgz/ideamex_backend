/**
 * @file Contratos de datos del módulo de análisis.
 * Centraliza tipos para request/adapter entre frontend y backend.
 *
 * @module api/analysis/analysis.types
 *
 * @author Ulises Rodríguez García
 */

/**
 * Muestra enviada por frontend para definir lote (`batch`).
 */
export interface FrontSampleLike {
  name?: unknown;
  batch?: unknown;
  originalName?: unknown;
}

/**
 * Selección booleana de métodos en formato `selectedMethods`.
 */
export interface FrontMethodsSelectionLike {
  edgeR?: unknown;
  limma?: unknown;
  noiseq?: unknown;
  deseq2?: unknown;
  dataAnalysis?: unknown;
  integrationResults?: unknown;
}

/**
 * Payload esperado por el endpoint de corrida (formato Project estricto).
 */
export interface AnalysisRunPayloadLike {
  samples?: unknown;
  selectedMethods?: unknown;
  comparisons?: unknown;
  parameters?: unknown;
  [key: string]: unknown;
}

/**
 * Campos esperados para crear un proyecto desde multipart/form-data.
 * Se usa `title` como único identificador de nombre del proyecto.
 */
export interface UploadProjectPayloadLike {
  title?: unknown;
  description?: unknown;
  imageUrl?: unknown;
  samples?: unknown;
  selectedMethods?: unknown;
  comparisons?: unknown;
  parameters?: unknown;
  status?: unknown;
  userId?: unknown;
}
