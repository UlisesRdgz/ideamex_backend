/**
 * @file Barrel de controladores del módulo de análisis.
 * Permite mantener imports existentes mientras la implementación se divide por flujo.
 *
 * @module api/analysis/analysis.controller
 */

export {
  handleProjectUpload,
  handleGetUserProjects,
  handleDeleteProject,
} from './controllers/analysis.projects.controller';

export {
  handleRunProjectAnalysis,
} from './controllers/analysis.run.controller';

export {
  handleGetProjectResults,
  handleGetProjectResultsStructured,
  handleDownloadProjectResultsArchive,
  handleGetProjectResultFile,
} from './controllers/analysis.results.controller';
