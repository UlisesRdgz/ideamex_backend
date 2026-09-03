/**
 * @file Contratos de respuesta estructurada de resultados de proyecto.
 *
 * @module models/ProjectResults
 *
 * @author Ulises Rodríguez García
 */

/**
 * Estado de la corrida tal como lo consume el frontend.
 *
 * Cuidado al leer el código: no es el mismo tipo que `ProjectStatus` de
 * `models/Project`, que usa mayúsculas (`PENDING`, `PROCESSING`, `COMPLETED`,
 * `FAILED`) y es el que guarda la base. Este es su equivalente en minúsculas
 * para la respuesta de la API, y `PROCESSING` corresponde aquí a `running`. La
 * conversión ocurre en `mapProjectStatusToRunStatus`.
 */
export type ProjectRunStatus = 'pending' | 'running' | 'completed' | 'failed';

/** Dirección de una métrica de control de calidad respecto a lo esperado. */
export type ProjectTrend = 'up' | 'down' | 'flat';

/** Sentido de la regulación de un gen: sobreexpresado o subexpresado. */
export type DifferentialDirection = 'up' | 'down';

/**
 * Método de expresión diferencial.
 * La grafía respeta la que usa el pipeline de R al nombrar sus carpetas de
 * resultados, porque el backend localiza los archivos por esa ruta.
 */
export type DifferentialMethod = 'EdgeR' | 'DESeq2' | 'Limma' | 'NOISeq';

/**
 * Tipo de gráfica, deducido del nombre del archivo que genera R.
 *
 * Conviven dos convenciones porque el pipeline no las unificó: las de análisis
 * exploratorio salen con nombres cortos (`boxplot`, `pca`, `mds`) y las de
 * comparación con el prefijo `plot` (`plotVolcano`, `plotMDS`). Por eso `mds` y
 * `plotMDS` aparecen ambos: son la misma gráfica en etapas distintas.
 *
 * La cadena vacía es el valor de reserva cuando el nombre no coincide con ningún
 * patrón conocido; el archivo se sigue exponiendo, solo que sin clasificar.
 */
export type PlotType =
  | 'boxplot'
  | 'density'
  | 'pca'
  | 'mds'
  | 'cpm'
  | 'md'
  | 'plotVolcano'
  | 'plotMDS'
  | 'plotSmear'
  | 'plotMA'
  | 'plotPCA'
  | 'plotMD'
  | '';

/**
 * Estado individual de un método dentro de la corrida.
 * Un método puede fallar sin tumbar el análisis completo: el resto sigue y la
 * corrida termina como `completed` con este método en `failed`.
 */
export type MethodStatus = {
  method: string;
  status: ProjectRunStatus;
  startedAt?: string;
  completedAt?: string;
};

export type ComparisonSummary = {
  upregulated: number;
  downregulated: number;
  totalDifferential: number;
};

export type QCmetric = {
  label: string;
  value: number;
  unit?: string;
  trend?: ProjectTrend;
};

export type Distribution = {
  name: string;
  series: Array<{ x: number | string; y: number }>;
};

export type Plot = {
  id: string;
  title: string;
  type: PlotType;
  imageUrl?: string;
  data?: unknown;
};

/**
 * Resultado de un contraste concreto dentro de un método.
 *
 * `significant` no es la suma de `upregulated` y `downregulated`: cuenta los
 * genes que pasan el umbral de p-valor ajustado, incluidos los que no alcanzan
 * el umbral de log fold-change y por tanto no se clasifican en ninguna
 * dirección. Los tres números se leen de archivos distintos del pipeline.
 */
export type DifferentialExpressionComparison = {
  name: string;
  upregulated: number;
  downregulated: number;
  significant: number;
  plots: Array<{ type: PlotType; imageUrl: string }>;
  topGenes: Array<{ gene: string; logFC: number; pValue: number }>;
};

export type DifferentialExpression = {
  method: DifferentialMethod;
  comparisons: Array<DifferentialExpressionComparison>;
};

/**
 * Gen detectado como diferencial por más de un método.
 * `methods` lista cuáles coincidieron: entre más métodos lo reporten, más
 * robusto es el hallazgo. Es el propósito integrador de IDEAMEX.
 */
export type ConsensusGene = {
  gene: string;
  methods: string[];
  direction: DifferentialDirection;
};

export type OutputFile = {
  name: string;
  path: string;
  sizeBytes: number;
  updatedAt: string;
  mimeType: string;
  method?: string;
  description?: string;
  downloadUrl: string;
};

export type IntegratedResultsTable = {
  id: string;
  title: string;
  type: string;
  path: string;
  mimeType: string;
  updatedAt: string;
  sizeBytes: number;
  downloadUrl: string;
};

/**
 * Respuesta completa del endpoint de resultados.
 *
 * Su estructura refleja las secciones de la interfaz, no la del pipeline: el
 * backend recorre el directorio de salida de R, clasifica los archivos y los
 * agrupa en estos cuatro bloques —resumen, análisis exploratorio, expresión
 * diferencial por método e integración—, de modo que el frontend pinte cada
 * pestaña sin volver a interpretar nombres de archivo.
 *
 * Las rutas expuestas son siempre URLs de descarga del propio backend, nunca
 * rutas del sistema de archivos del servidor.
 */
export interface ProjectResults {
  projectId: string;
  projectTitle: string;
  description: string;
  status: ProjectRunStatus;
  completedAt: string | null;

  summary: {
    samplesAnalyzed: number;
    totalGenes: number;
    methodsUsed: number;
    comparisons: number;
    methodsStatus: MethodStatus[];
    comparisonSummary: ComparisonSummary;
  };

  dataAnalysis: {
    qcMetrics: QCmetric[];
    distributions: Distribution[];
    plots: Plot[];
  };

  differentialExpression: DifferentialExpression[];

  integratedResults: {
    vennDiagrams: Array<{ id: string; title: string; imageUrl: string }>;
    consensusGenes: ConsensusGene[];
    heatmaps: Array<{ id: string; title: string; imageUrl: string }>;
    tables: IntegratedResultsTable[];
    notes?: string;
  };

  outputFiles: {
    downloadAllUrl: string;
    files: OutputFile[];
  };
}
