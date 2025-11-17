/**
 * @file Documentación Swagger del módulo de autenticación.
 * Define los esquemas y endpoints relacionados con login, registro, activación y recuperación de contraseña.
 * 
 * @module api/auth/auth.docs
 * @swagger
 * tags:
 *   name: Auth
 *   description: Endpoints relacionados con la autenticación de usuarios.
 * 
 * @auth Ulises Rodríguez García
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     RegisterInput:
 *       type: object
 *       required:
 *         - email
 *         - username
 *         - password
 *         - confirmPassword
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         username:
 *           type: string
 *         password:
 *           type: string
 *         confirmPassword:
 *           type: string
 *
 *     LoginInput:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *         password:
 *           type: string
 *
 *     PasswordResetRequest:
 *       type: object
 *       required:
 *         - email
 *       properties:
 *         email:
 *           type: string
 *
 *     PasswordReset:
 *       type: object
 *       required:
 *         - token
 *         - password
 *         - confirmPassword
 *       properties:
 *         token:
 *           type: string
 *         password:
 *           type: string
 *         confirmPassword:
 *           type: string
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Registra un nuevo usuario
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterInput'
 *     responses:
 *       201:
 *         description: Usuario registrado correctamente.
 *       400:
 *         description: Datos inválidos o correo duplicado.
 */

/**
 * @swagger
 * /auth/activate:
 *   get:
 *     tags: [Auth]
 *     summary: Activa una cuenta de usuario mediante token
 *     parameters:
 *       - in: query
 *         name: token
 *         schema:
 *           type: string
 *         required: true
 *         description: Token de activación recibido por correo
 *     responses:
 *       200:
 *         description: Cuenta activada correctamente.
 *       400:
 *         description: Token inválido o ausente.
 *       404:
 *         description: Usuario no encontrado.
 */

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Inicia sesión para usuarios registrados
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginInput'
 *     responses:
 *       200:
 *         description: Inicio de sesión exitoso.
 *       401:
 *         description: Credenciales inválidas.
 *       403:
 *         description: Cuenta no activada o registrada con Google.
 */

/**
 * @swagger
 * /auth/request-password-reset:
 *   post:
 *     tags: [Auth]
 *     summary: Solicita un token de restablecimiento de contraseña
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PasswordResetRequest'
 *     responses:
 *       200:
 *         description: Token enviado al correo electrónico.
 *       404:
 *         description: Correo no encontrado.
 */

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Establece una nueva contraseña mediante token válido
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PasswordReset'
 *     responses:
 *       200:
 *         description: Contraseña actualizada correctamente.
 *       400:
 *         description: Token inválido o expirado.
 */

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Cierra la sesión del usuario (solo si implementas refresh tokens)
 *     responses:
 *       200:
 *         description: Logout exitoso.
 */

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Refresca el token de acceso (pendiente de implementación)
 *     responses:
 *       200:
 *         description: Nuevo token de acceso generado.
 *       401:
 *         description: Token de refresh faltante.
 *       403:
 *         description: Token inválido.
 */
