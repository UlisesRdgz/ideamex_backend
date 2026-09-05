/**
 * @file Documentación Swagger del módulo de análisis.
 *
 * @module api/analysis/analysis.docs
 * @swagger
 * tags:
 *   - name: Analysis
 *     description: Carga de proyectos, ejecución de análisis y consulta de resultados.
 *
 * @author Ulises Rodríguez García
 */

/**
 * @swagger
 * components:
 *   parameters:
 *     ProjectIdParam:
 *       in: path
 *       name: projectId
 *       required: true
 *       schema:
 *         type: integer
 *         minimum: 1
 *       description: ID del proyecto.
 *     ForceDeleteQueryParam:
 *       in: query
 *       name: force
 *       required: false
 *       schema:
 *         type: boolean
 *       description: Si es true, permite borrar el proyecto aunque esté en PROCESSING.
 *
 *   schemas:
 *     AnalysisSampleInput:
 *       type: object
 *       required: [name, batch]
 *       properties:
 *         name:
 *           type: string
 *           example: mock_1
 *         originalName:
 *           type: string
 *           description: Cabecera original en el archivo de conteos. Se envía solo cuando el usuario renombró la muestra; si se omite, se usa el mismo valor de name.
 *           example: DMSO_1
 *         batch:
 *           nullable: true
 *           oneOf:
 *             - type: string
 *             - type: number
 *           description: Lote de la muestra. Usa null en todas las muestras para correr sin batch. Si se usa batch, todas las muestras deben tener un valor numérico; se envía a R tal como fue capturado.
 *           example: "0"
 *       additionalProperties: false
 *
 *     AnalysisSelectedMethodsInput:
 *       type: object
 *       required: [edgeR, limma, noiseq, deseq2, dataAnalysis, integrationResults]
 *       properties:
 *         edgeR:
 *           type: boolean
 *         limma:
 *           type: boolean
 *         noiseq:
 *           type: boolean
 *         deseq2:
 *           type: boolean
 *         dataAnalysis:
 *           type: boolean
 *         integrationResults:
 *           type: boolean
 *       additionalProperties: false
 *
 *     AnalysisComparisonInput:
 *       type: object
 *       required: [base, target, selected]
 *       properties:
 *         base:
 *           type: string
 *           example: mock
 *         target:
 *           type: string
 *           example: hrcc
 *         selected:
 *           type: boolean
 *           example: false
 *       additionalProperties: false
 *
 *     AnalysisParametersInput:
 *       type: object
 *       required: [fdr, logFC, cpm, top, corrplot]
 *       properties:
 *         fdr:
 *           type: string
 *           example: "0.01"
 *         logFC:
 *           type: string
 *           example: "1"
 *         cpm:
 *           type: string
 *           example: "1"
 *         top:
 *           type: boolean
 *           example: true
 *         corrplot:
 *           type: boolean
 *           example: false
 *       additionalProperties: false
 *
 *     AnalysisRunRequest:
 *       type: object
 *       required: [samples, selectedMethods, comparisons, parameters]
 *       properties:
 *         samples:
 *           type: array
 *           minItems: 1
 *           items:
 *             $ref: '#/components/schemas/AnalysisSampleInput'
 *         selectedMethods:
 *           $ref: '#/components/schemas/AnalysisSelectedMethodsInput'
 *         comparisons:
 *           type: array
 *           minItems: 1
 *           items:
 *             $ref: '#/components/schemas/AnalysisComparisonInput'
 *         parameters:
 *           $ref: '#/components/schemas/AnalysisParametersInput'
 *       additionalProperties: false
 *
 *     AnalysisProject:
 *       type: object
 *       required: [id, title, description, imageUrl, file, samples, selectedMethods, comparisons, parameters, createdAt, updatedAt, status, userId]
 *       properties:
 *         id:
 *           type: integer
 *           example: 14
 *         title:
 *           type: string
 *           example: postman-crud-523744
 *         description:
 *           type: string
 *           nullable: true
 *           example: Proyecto para prueba CRUD desde Postman
 *         imageUrl:
 *           type: string
 *           nullable: true
 *           example: null
 *         file:
 *           type: string
 *           example: user123/proyecto-demo/2026-04-15T23-25-23-757Z_arab.txt
 *         samples:
 *           nullable: true
 *         selectedMethods:
 *           nullable: true
 *         comparisons:
 *           nullable: true
 *         parameters:
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         status:
 *           type: string
 *           enum: [PENDING, PROCESSING, FAILED, COMPLETED]
 *         userId:
 *           type: string
 *           example: "4"
 *
 *     AnalysisUploadSuccessResponse:
 *       type: object
 *       required: [status, message, data]
 *       properties:
 *         status:
 *           type: string
 *           enum: [success]
 *         message:
 *           type: string
 *         data:
 *           $ref: '#/components/schemas/AnalysisProject'
 *       example:
 *         status: success
 *         message: Project uploaded successfully
 *         data:
 *           id: 14
 *           title: proyecto-demo
 *           description: Proyecto para corrida desde Postman
 *           imageUrl: null
 *           file: user123/proyecto-demo/2026-04-15T23-25-23-757Z_arab.txt
 *           samples: null
 *           selectedMethods: null
 *           comparisons: null
 *           parameters: null
 *           createdAt: '2026-04-15T23:25:23.000Z'
 *           updatedAt: '2026-04-15T23:25:23.000Z'
 *           status: PENDING
 *           userId: '4'
 *
 *     AnalysisProjectListSuccessResponse:
 *       type: object
 *       required: [status, message, data]
 *       properties:
 *         status:
 *           type: string
 *           enum: [success]
 *         message:
 *           type: string
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/AnalysisProject'
 *       example:
 *         status: success
 *         message: User projects retrieved successfully
 *         data:
 *           - id: 14
 *             title: proyecto-demo
 *             description: Proyecto para corrida desde Postman
 *             imageUrl: null
 *             file: user123/proyecto-demo/2026-04-15T23-25-23-757Z_arab.txt
 *             samples: null
 *             selectedMethods: null
 *             comparisons: null
 *             parameters: null
 *             createdAt: '2026-04-15T23:25:23.000Z'
 *             updatedAt: '2026-04-15T23:25:23.000Z'
 *             status: PENDING
 *             userId: '4'
 *
 *     AnalysisRunAcceptedSuccessResponse:
 *       type: object
 *       required: [status, message, data]
 *       properties:
 *         status:
 *           type: string
 *           enum: [success]
 *         message:
 *           type: string
 *         data:
 *           type: object
 *           required: [id, run_status]
 *           properties:
 *             id:
 *               type: integer
 *               example: 14
 *             run_status:
 *               type: string
 *               example: running
 *       example:
 *         status: success
 *         message: Analysis started successfully
 *         data:
 *           id: 14
 *           run_status: running
 *
 *     AnalysisResultFile:
 *       type: object
 *       required: [name, size_bytes, updated_at, mime_type]
 *       properties:
 *         name:
 *           type: string
 *           example: RunSummary.log
 *         size_bytes:
 *           type: integer
 *           example: 1920
 *         updated_at:
 *           type: string
 *           format: date-time
 *         mime_type:
 *           type: string
 *           example: text/plain; charset=utf-8
 *
 *     AnalysisProjectResultsSuccessResponse:
 *       type: object
 *       required: [status, message, data]
 *       properties:
 *         status:
 *           type: string
 *           enum: [success]
 *         message:
 *           type: string
 *         data:
 *           type: object
 *           required: [id, status, files]
 *           properties:
 *             id:
 *               type: integer
 *               example: 14
 *             status:
 *               type: string
 *               enum: [COMPLETED]
 *             files:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/AnalysisResultFile'
 *       example:
 *         status: success
 *         message: Project results retrieved successfully
 *         data:
 *           id: 14
 *           status: COMPLETED
 *           files:
 *             - name: RunSummary.log
 *               size_bytes: 1920
 *               updated_at: '2026-04-16T03:14:51.000Z'
 *               mime_type: text/plain; charset=utf-8
 *
 *     AnalysisProjectStructuredResultsSuccessResponse:
 *       type: object
 *       required: [status, message, data]
 *       properties:
 *         status:
 *           type: string
 *           enum: [success]
 *         message:
 *           type: string
 *         data:
 *           type: object
 *           description: Contrato estructurado ProjectResults para frontend.
 *           properties:
 *             projectId:
 *               type: string
 *             projectTitle:
 *               type: string
 *             description:
 *               type: string
 *             status:
 *               type: string
 *               enum: [pending, running, completed, failed]
 *             completedAt:
 *               type: string
 *               nullable: true
 *               format: date-time
 *             summary:
 *               type: object
 *             dataAnalysis:
 *               type: object
 *             differentialExpression:
 *               type: array
 *               items:
 *                 type: object
 *             integratedResults:
 *               type: object
 *             outputFiles:
 *               type: object
 *       example:
 *         status: success
 *         message: Project structured results retrieved successfully
 *         data:
 *           projectId: "14"
 *           projectTitle: postman-crud-523744
 *           description: Proyecto para prueba CRUD desde Postman
 *           status: completed
 *           completedAt: '2026-04-16T03:14:51.000Z'
 *           summary:
 *             samplesAnalyzed: 6
 *             totalGenes: 12000
 *             methodsUsed: 2
 *             comparisons: 1
 *             methodsStatus: []
 *             comparisonSummary:
 *               upregulated: 120
 *               downregulated: 98
 *               totalDifferential: 218
 *           dataAnalysis:
 *             qcMetrics: []
 *             distributions: []
 *             plots: []
 *           differentialExpression: []
 *           integratedResults:
 *             vennDiagrams: []
 *             consensusGenes: []
 *             heatmaps: []
 *             tables: []
 *           outputFiles:
 *             downloadAllUrl: /analysis/project/14/results/archive
 *             files: []
 *
 *     GenericSuccessResponse:
 *       type: object
 *       required: [status, message, data]
 *       properties:
 *         status:
 *           type: string
 *           enum: [success]
 *         message:
 *           type: string
 *         data:
 *           nullable: true
 *       example:
 *         status: success
 *         message: Project deleted successfully
 *         data: null
 */

/**
 * @swagger
 * /analysis/upload:
 *   post:
 *     tags: [Analysis]
 *     operationId: uploadProject
 *     summary: Sube archivo de conteos y crea proyecto
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file, title]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Archivo .txt/.csv/.tsv con tabla de conteos.
 *               title:
 *                 type: string
 *                 description: Nombre único del proyecto por usuario.
 *               description:
 *                 type: string
 *                 description: Descripción opcional.
 *               imageUrl:
 *                 type: string
 *                 description: URL opcional de imagen asociada.
 *     responses:
 *       201:
 *         description: Proyecto creado correctamente.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AnalysisUploadSuccessResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 *
 * /analysis/project/{projectId}/config:
 *   patch:
 *     tags: [Analysis]
 *     operationId: saveProjectConfig
 *     summary: Guarda el avance parcial de la configuracion del proyecto
 *     description: >
 *       Conserva en el servidor un formulario de configuracion a medio llenar.
 *       Acepta cualquier subconjunto de los cuatro bloques y deja intactos los
 *       que no se envian. No altera el estatus del proyecto, que permanece
 *       "Incompleto" hasta que se ejecute el analisis. Solo se admite mientras
 *       el proyecto esta pendiente: una vez ejecutado, la configuracion es
 *       inmutable.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             minProperties: 1
 *             properties:
 *               samples:
 *                 type: array
 *                 items:
 *                   type: object
 *               selectedMethods:
 *                 type: object
 *               comparisons:
 *                 type: array
 *                 items:
 *                   type: object
 *               parameters:
 *                 type: object
 *     responses:
 *       200:
 *         description: Configuracion guardada.
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: El proyecto ya no esta pendiente y su configuracion es inmutable.
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @swagger
 * /analysis/user-projects:
 *   get:
 *     tags: [Analysis]
 *     operationId: getUserProjects
 *     summary: Lista proyectos del usuario autenticado
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista obtenida correctamente.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AnalysisProjectListSuccessResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 *
 * /analysis/project/{projectId}:
 *   delete:
 *     tags: [Analysis]
 *     operationId: deleteProject
 *     summary: Elimina proyecto (base de datos + archivos)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/ProjectIdParam'
 *       - $ref: '#/components/parameters/ForceDeleteQueryParam'
 *     responses:
 *       200:
 *         description: Proyecto eliminado correctamente.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GenericSuccessResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 *
 * /analysis/project/{projectId}/run:
 *   post:
 *     tags: [Analysis]
 *     operationId: runProjectAnalysis
 *     summary: Inicia el análisis de un proyecto
 *     description: Bloquea el proyecto en estado PROCESSING y ejecuta el pipeline en background.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/ProjectIdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AnalysisRunRequest'
 *     responses:
 *       202:
 *         description: Corrida aceptada e iniciada.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AnalysisRunAcceptedSuccessResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 *
 * /analysis/project/{projectId}/results:
 *   get:
 *     tags: [Analysis]
 *     operationId: getProjectResults
 *     summary: Lista archivos de resultados de un proyecto finalizado
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/ProjectIdParam'
 *     responses:
 *       200:
 *         description: Resultados listados correctamente.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AnalysisProjectResultsSuccessResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 *
 * /analysis/project/{projectId}/results/structured:
 *   get:
 *     tags: [Analysis]
 *     operationId: getProjectStructuredResults
 *     summary: Devuelve resultados estructurados para frontend (ProjectResults)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/ProjectIdParam'
 *     responses:
 *       200:
 *         description: Resultados estructurados obtenidos correctamente.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AnalysisProjectStructuredResultsSuccessResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 *
 * /analysis/project/{projectId}/results/archive:
 *   get:
 *     tags: [Analysis]
 *     operationId: downloadProjectResultsArchive
 *     summary: Descarga ZIP con todos los resultados
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/ProjectIdParam'
 *     responses:
 *       200:
 *         description: ZIP enviado correctamente.
 *         content:
 *           application/zip:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 *
 * /analysis/project/{projectId}/results/file:
 *   get:
 *     tags: [Analysis]
 *     operationId: getProjectResultFile
 *     summary: Sirve un archivo individual de resultados
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/ProjectIdParam'
 *       - in: query
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: Ruta relativa del archivo dentro de resultados.
 *       - in: query
 *         name: download
 *         required: false
 *         schema:
 *           type: string
 *           enum: ["true", "false", "1", "0", "yes", "no"]
 *           example: "true"
 *         description: Si es true/1/yes fuerza descarga.
 *     responses:
 *       200:
 *         description: Archivo servido correctamente.
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
