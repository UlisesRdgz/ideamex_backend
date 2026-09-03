/**
 * @file Contratos de respuesta estructurada de resultados de proyecto.
 *
 * @module models/ProjectResults
 *
 * @author Ulises Rodríguez García
 */

/**
 * Estado de la corrida tal como lo consume el frontend.
 * Ojo: no es `ProjectStatus` de `models/Project`, que va en mayúsculas y guarda
 * la base. Convierte `mapProjectStatusToRunStatus`; `PROCESSING` es `running`.
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
 * Conviven dos convenciones: nombres cortos en el análisis exploratorio (`mds`)
 * y con prefijo en las comparaciones (`plotMDS`). La vacía no clasifica.
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
 * `significant` no es la suma de los otros dos: cuenta los genes que pasan el
 * p-valor ajustado, aunque no alcancen el umbral de log fold-change.
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
 * Su estructura refleja las secciones de la interfaz, no la del pipeline. Las
 * rutas son siempre URLs de descarga del backend, nunca rutas del disco.
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
