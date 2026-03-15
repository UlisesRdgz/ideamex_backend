/**
 * @file Contratos de datos del módulo de análisis.
 * Centraliza tipos para request/adapter entre frontend y backend.
 *
 * @module api/analysis/analysis.types
 *
 * @author Ulises Rodríguez García
 */

/**
 * Método enviado por frontend en formato de lista de selección.
 */
export interface FrontMethodLike {
  name?: unknown;
  isSelected?: unknown;
}

/**
 * Muestra enviada por frontend para definir lote (`batch`).
 */
export interface FrontSampleLike {
  name?: unknown;
  batch?: unknown;
}

/**
 * Parámetros de análisis enviados por frontend.
 */
export interface FrontAnalysisParametersLike {
  fdr?: unknown;
  logFC?: unknown;
  cpm?: unknown;
  top?: unknown;
  corrplot?: unknown;
  padjust?: unknown;
  logfc?: unknown;
  generateZip?: unknown;
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
 * Comparación enviada por frontend (aún no consumida por el pipeline R).
 */
export interface FrontComparisonLike {
  base?: unknown;
  target?: unknown;
  isCustom?: unknown;
  selected?: unknown;
}

/**
 * Payload flexible aceptado por el endpoint de corrida.
 * Incluye formato legacy y formato de clases del frontend.
 */
export interface AnalysisRunPayloadLike {
  methods?: unknown;
  selectedMethods?: unknown;
  comparisons?: unknown;
  logfc?: unknown;
  cpm?: unknown;
  padjust?: unknown;
  batch?: unknown;
  generateZip?: unknown;
  top?: unknown;
  samples?: unknown;
  parameters?: unknown;
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
