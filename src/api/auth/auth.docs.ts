/**
 * @file Documentación Swagger del módulo de autenticación.
 *
 * @module api/auth/auth.docs
 * @swagger
 * tags:
 *   - name: Auth
 *     description: Registro, activación y autenticación de usuarios.
 *
 * @author Ulises Rodríguez García
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     RegisterInput:
 *       type: object
 *       required: [email, username, password, confirmPassword]
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: user@example.com
 *         username:
 *           type: string
 *           example: usuario_demo
 *         password:
 *           type: string
 *           format: password
 *           example: Segura@123
 *         confirmPassword:
 *           type: string
 *           format: password
 *           example: Segura@123
 *       additionalProperties: false
 *
 *     LoginInput:
 *       type: object
 *       required: [email, password]
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: user@example.com
 *         password:
 *           type: string
 *           format: password
 *           example: Segura@123
 *       additionalProperties: false
 *
 *     GoogleLoginInput:
 *       type: object
 *       required: [idToken]
 *       properties:
 *         idToken:
 *           type: string
 *           description: Token ID generado por Google Sign-In en frontend.
 *       additionalProperties: false
 *
 *     PasswordResetRequestInput:
 *       type: object
 *       required: [email]
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: user@example.com
 *       additionalProperties: false
 *
 *     PasswordResetInput:
 *       type: object
 *       required: [token, password, confirmPassword]
 *       properties:
 *         token:
 *           type: string
 *           description: Token de recuperación recibido por correo.
 *         password:
 *           type: string
 *           format: password
 *           example: NuevaSegura@123
 *         confirmPassword:
 *           type: string
 *           format: password
 *           example: NuevaSegura@123
 *       additionalProperties: false
 *
 *     AuthSessionData:
 *       type: object
 *       required: [token, id, email, username]
 *       properties:
 *         token:
 *           type: string
 *           description: JWT de sesión.
 *         id:
 *           type: integer
 *           example: 4
 *         email:
 *           type: string
 *           format: email
 *         username:
 *           type: string
 *         auth_provider:
 *           type: string
 *           enum: [local, google]
 *           nullable: true
 *
 *     BasicSuccessResponse:
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
 *         message: Account activated successfully
 *         data: null
 *
 *     AuthSuccessResponse:
 *       type: object
 *       required: [status, message, data]
 *       properties:
 *         status:
 *           type: string
 *           enum: [success]
 *         message:
 *           type: string
 *         data:
 *           $ref: '#/components/schemas/AuthSessionData'
 *       example:
 *         status: success
 *         message: Login successful
 *         data:
 *           token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *           id: 4
 *           email: user@example.com
 *           username: usuario_demo
 *           auth_provider: local
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     operationId: registerUser
 *     summary: Registra un nuevo usuario local
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterInput'
 *     responses:
 *       201:
 *         description: Usuario registrado y correo de activación enviado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BasicSuccessResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @swagger
 * /auth/activate:
 *   get:
 *     tags: [Auth]
 *     operationId: activateUser
 *     summary: Activa una cuenta mediante token
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Token de activación enviado por correo.
 *     responses:
 *       200:
 *         description: Cuenta activada correctamente.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BasicSuccessResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     operationId: loginUser
 *     summary: Inicia sesión con credenciales locales
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginInput'
 *     responses:
 *       200:
 *         description: Login exitoso.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthSuccessResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @swagger
 * /auth/google:
 *   get:
 *     tags: [Auth]
 *     operationId: startGoogleOAuth
 *     summary: Inicia el flujo OAuth2 con Google
 *     description: Redirige al usuario a Google para autorización.
 *     responses:
 *       302:
 *         description: Redirección a Google OAuth.
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @swagger
 * /auth/google/callback:
 *   get:
 *     tags: [Auth]
 *     operationId: handleGoogleOAuthCallback
 *     summary: Callback OAuth2 de Google
 *     parameters:
 *       - in: query
 *         name: code
 *         required: false
 *         schema:
 *           type: string
 *         description: Código OAuth enviado por Google.
 *       - in: query
 *         name: error
 *         required: false
 *         schema:
 *           type: string
 *         description: Error OAuth devuelto por Google si el flujo fue rechazado.
 *     responses:
 *       200:
 *         description: Login/registro con Google exitoso.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthSuccessResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @swagger
 * /auth/google/login:
 *   post:
 *     tags: [Auth]
 *     operationId: loginWithGoogle
 *     summary: Inicia sesión con Google usando idToken
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/GoogleLoginInput'
 *     responses:
 *       200:
 *         description: Login con Google exitoso.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthSuccessResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @swagger
 * /auth/request-password-reset:
 *   post:
 *     tags: [Auth]
 *     operationId: requestPasswordReset
 *     summary: Solicita correo de restablecimiento de contraseña
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PasswordResetRequestInput'
 *     responses:
 *       200:
 *         description: Correo de recuperación enviado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BasicSuccessResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     operationId: resetPassword
 *     summary: Restablece contraseña mediante token válido
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PasswordResetInput'
 *     responses:
 *       200:
 *         description: Contraseña actualizada.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BasicSuccessResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
