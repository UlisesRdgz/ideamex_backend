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
 * @author
 * Ulises Rodríguez García
 */

/**
 * @swagger
 * /analysis/upload:
 *   post:
 *     summary: Subir un archivo de proyecto
 *     tags: [Analysis]
 *     parameters:
 *       - in: header
 *         name: x-user-id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del usuario autenticado
 *       - in: header
 *         name: x-username
 *         required: true
 *         schema:
 *           type: string
 *         description: Nombre de usuario autenticado
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *               - name
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Archivo a subir (.csv, .tsv o .txt)
 *               name:
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
 *         description: Usuario no autenticado (headers faltantes)
 *       500:
 *         description: Error interno del servidor
 */
