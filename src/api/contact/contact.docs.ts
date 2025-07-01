/**
 * @file Documentación Swagger para el módulo de contacto.
 * 
 * @module api/contact/contact.docs
 * @swagger
 * tags:
 *   name: Contact
 *   description: Gestión de solicitudes de contacto
 * 
 * @author Ulises Rodríguez García
 */

/**
 * @swagger
 * /contact:
 *   post:
 *     summary: Enviar una solicitud de contacto
 *     tags: [Contact]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fullName
 *               - email
 *               - phone
 *               - subject
 *               - message
 *             properties:
 *               fullName:
 *                 type: string
 *                 example: Juan Pérez
 *               email:
 *                 type: string
 *                 example: juan.perez@example.com
 *               phone:
 *                 type: string
 *                 example: +5215512345678
 *               subject:
 *                 type: string
 *                 example: Consulta sobre análisis de datos
 *               message:
 *                 type: string
 *                 example: Quiero saber más sobre el análisis de expresión diferencial.
 *     responses:
 *       201:
 *         description: Solicitud de contacto enviada exitosamente
 *       400:
 *         description: Validación fallida
 *       429:
 *         description: Límite de envíos alcanzado
 *       500:
 *         description: Error interno del servidor
 */
