/**
 * @file Documentación Swagger del módulo de contacto.
 *
 * @module api/contact/contact.docs
 * @swagger
 * tags:
 *   - name: Contact
 *     description: Recepción de solicitudes de contacto del sitio público.
 *
 * @author Ulises Rodríguez García
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     ContactRequestInput:
 *       type: object
 *       required: [fullName, email, phone, subject, message]
 *       properties:
 *         fullName:
 *           type: string
 *           maxLength: 255
 *           example: Juan Perez
 *         email:
 *           type: string
 *           format: email
 *           example: juan.perez@example.com
 *         phone:
 *           type: string
 *           maxLength: 20
 *           example: "+525512345678"
 *         subject:
 *           type: string
 *           maxLength: 255
 *           example: Consulta sobre corrida de analisis
 *         message:
 *           type: string
 *           maxLength: 1000
 *           example: Quiero apoyo para interpretar mis resultados.
 *       additionalProperties: false
 *
 *     ContactSuccessResponse:
 *       type: object
 *       required: [status, message, data]
 *       properties:
 *         status:
 *           type: string
 *           enum: [success]
 *           example: success
 *         message:
 *           type: string
 *           example: Tu solicitud fue enviada exitosamente.
 *         data:
 *           nullable: true
 *           example: null
 *       example:
 *         status: success
 *         message: Tu solicitud fue enviada exitosamente.
 *         data: null
 */

/**
 * @swagger
 * /contact:
 *   post:
 *     tags: [Contact]
 *     operationId: submitContactForm
 *     summary: Envía una solicitud de contacto
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ContactRequestInput'
 *     responses:
 *       201:
 *         description: Solicitud registrada y notificada correctamente.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ContactSuccessResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
