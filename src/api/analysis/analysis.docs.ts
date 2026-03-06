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
 *               - projectName
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Archivo a subir (.csv, .tsv o .txt)
 *               projectName:
 *                 type: string
 *                 description: Nombre del proyecto
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
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               methods:
 *                 type: string
 *                 example: "123456"
 *                 description: Debe incluir al menos un método de 1-5. Si incluye 6, también debe incluir 1-4.
 *               logfc:
 *                 type: number
 *                 example: 1
 *               cpm:
 *                 type: number
 *                 example: 1
 *               padjust:
 *                 type: number
 *                 example: 0.01
 *               batch:
 *                 type: string
 *                 example: "0,0,5,1"
 *                 description: Opcional. Lista numérica separada por comas con el mismo número de elementos que muestras.
 *               generateZip:
 *                 type: boolean
 *                 example: true
 *               top:
 *                 type: boolean
 *                 example: true
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
