/**
 * @file Documentación Swagger para el módulo de análisis.
 * Define el esquema y comportamiento del endpoint de carga de proyectos.
 * 
 * @module api/analysis/analysis.docs
 * @swagger
 * tags:
 *   name: Analysis
 *   description: Gestión y análisis de proyectos de usuario
 * 
 * @author Ulises Rodríguez García
 */

/**
 * @swagger
 * /analysis/upload:
 *   post:
 *     summary: Subir un archivo de proyecto
 *     tags: [Analysis]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *               - title
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Archivo a subir (.csv, .tsv o .txt)
 *               title:
 *                 type: string
 *                 description: Título del proyecto
 *               description:
 *                 type: string
 *                 description: Descripción opcional del proyecto
 *     responses:
 *       201:
 *         description: Proyecto cargado exitosamente
 *       400:
 *         description: Error de validación o formato
 *       401:
 *         description: Usuario no autenticado o token inválido
 *       500:
 *         description: Error interno del servidor
 */

/**
 * @swagger
 * /analysis/project/{projectId}/run:
 *   post:
 *     summary: Inicia la corrida de análisis para un proyecto y lo bloquea
 *     tags: [Analysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del proyecto
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - samples
 *               - selectedMethods
 *               - comparisons
 *               - parameters
 *             additionalProperties: false
 *             properties:
 *               samples:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required:
 *                     - name
 *                     - batch
 *                   additionalProperties: false
 *                   properties:
 *                     name:
 *                       type: string
 *                       example: mock_3
 *                     batch:
 *                       type: string
 *                       example: "0"
 *               selectedMethods:
 *                 type: object
 *                 required:
 *                   - edgeR
 *                   - limma
 *                   - noiseq
 *                   - deseq2
 *                   - dataAnalysis
 *                   - integrationResults
 *                 additionalProperties: false
 *                 properties:
 *                   edgeR:
 *                     type: boolean
 *                     example: true
 *                   limma:
 *                     type: boolean
 *                     example: true
 *                   noiseq:
 *                     type: boolean
 *                     example: false
 *                   deseq2:
 *                     type: boolean
 *                     example: false
 *                   dataAnalysis:
 *                     type: boolean
 *                     example: false
 *                   integrationResults:
 *                     type: boolean
 *                     example: false
 *               comparisons:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - base
 *                     - target
 *                     - selected
 *                   additionalProperties: false
 *                   properties:
 *                     base:
 *                       type: string
 *                       example: mock
 *                     target:
 *                       type: string
 *                       example: hrcc
 *                     selected:
 *                       type: boolean
 *                       example: false
 *               parameters:
 *                 type: object
 *                 required:
 *                   - fdr
 *                   - logFC
 *                   - cpm
 *                   - top
 *                   - corrplot
 *                 additionalProperties: false
 *                 properties:
 *                   fdr:
 *                     type: string
 *                     example: "0.01"
 *                   logFC:
 *                     type: string
 *                     example: "1"
 *                   cpm:
 *                     type: string
 *                     example: "1"
 *                   top:
 *                     type: boolean
 *                     example: true
 *                   corrplot:
 *                     type: boolean
 *                     example: false
 *     responses:
 *       202:
 *         description: Corrida iniciada correctamente
 *       400:
 *         description: Parámetros inválidos
 *       401:
 *         description: Usuario no autenticado
 *       404:
 *         description: Proyecto no encontrado
 *       409:
 *         description: Proyecto ya bloqueado o ya iniciado
 *       500:
 *         description: Error interno del servidor
 */

/**
 * @swagger
 * /analysis/project/{projectId}/results:
 *   get:
 *     summary: Lista archivos de resultados de un proyecto completado
 *     tags: [Analysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del proyecto
 *     responses:
 *       200:
 *         description: Resultados obtenidos correctamente
 *       401:
 *         description: Usuario no autenticado
 *       404:
 *         description: Proyecto o carpeta de resultados no encontrado
 *       409:
 *         description: El proyecto aún no ha finalizado exitosamente
 *       500:
 *         description: Error interno del servidor
 */

/**
 * @swagger
 * /analysis/project/{projectId}/results/file:
 *   get:
 *     summary: Descarga o visualiza un archivo individual de resultados
 *     tags: [Analysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del proyecto
 *       - in: query
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: Ruta relativa del archivo dentro de la carpeta de resultados
 *       - in: query
 *         name: download
 *         required: false
 *         schema:
 *           type: string
 *           example: "true"
 *         description: Si es true/1/yes fuerza descarga; en otro caso intenta visualización inline
 *     responses:
 *       200:
 *         description: Archivo servido correctamente
 *       400:
 *         description: Parámetros inválidos o tipo de archivo no permitido
 *       401:
 *         description: Usuario no autenticado
 *       404:
 *         description: Proyecto o archivo no encontrado
 *       409:
 *         description: El proyecto aún no ha finalizado exitosamente
 *       500:
 *         description: Error interno del servidor
 */
