/**
 * @file Contratos de respuesta estructurada de resultados de proyecto.
 *
 * @module models/ProjectResults
 */

export type ProjectRunStatus = 'pending' | 'running' | 'completed' | 'failed';
export type ProjectTrend = 'up' | 'down' | 'flat';
export type DifferentialDirection = 'up' | 'down';
export type DifferentialMethod = 'EdgeR' | 'DESeq2' | 'Limma' | 'NOISeq';
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
