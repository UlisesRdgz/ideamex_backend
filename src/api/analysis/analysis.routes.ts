/**
 * @file Rutas raíz del módulo de análisis.
 * Compone sub-rutas por dominio: proyectos, corrida y resultados.
 * 
 * @module api/analysis/analysis.routes
 * @requires express
 * @requires ./routes/analysis.projects.routes
 * @requires ./routes/analysis.run.routes
 * @requires ./routes/analysis.results.routes
 * 
 * @author Ulises Rodríguez García
 */

import { Router } from 'express';
import analysisProjectsRoutes from './routes/analysis.projects.routes';
import analysisRunRoutes from './routes/analysis.run.routes';
import analysisResultsRoutes from './routes/analysis.results.routes';

const router = Router();

router.use(analysisProjectsRoutes);
router.use(analysisRunRoutes);
router.use(analysisResultsRoutes);

export default router;
