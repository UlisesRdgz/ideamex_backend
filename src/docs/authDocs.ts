/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: Endpoints for user authentication and authorization
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user (local authentication)
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - username
 *               - password
 *               - confirmPassword
 *             properties:
 *               email:
 *                 type: string
 *                 example: user@example.com
 *               username:
 *                 type: string
 *                 example: johndoe
 *               password:
 *                 type: string
 *                 example: Password123!
 *               confirmPassword:
 *                 type: string
 *                 example: Password123!
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Validation error
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /api/auth/activate:
 *   get:
 *     summary: Activate a user's account using a token
 *     tags: [Authentication]
 *     parameters:
 *       - in: query
 *         name: token
 *         schema:
 *           type: string
 *           example: d5f5b4b0-1fcd-40b4-9c0e-4b25620746a3
 *         required: true
 *         description: Activation token sent to the user's email
 *     responses:
 *       200:
 *         description: Account activated successfully
 *       400:
 *         description: Invalid or missing token
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login a user (local authentication)
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 example: Password123!
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR...
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     email:
 *                       type: string
 *                       example: user@example.com
 *                     username:
 *                       type: string
 *                       example: johndoe
 *       400:
 *         description: Invalid credentials
 *       403:
 *         description: Account not activated or Google login required
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /api/auth/google:
 *   get:
 *     summary: Initiate authentication with Google
 *     tags: [Authentication]
 *     responses:
 *       302:
 *         description: Redirects to Google's OAuth2 login page
 */

/**
 * @swagger
 * /api/auth/google/callback:
 *   get:
 *     summary: Handle Google OAuth2 callback
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR...
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     email:
 *                       type: string
 *                       example: user@example.com
 *                     username:
 *                       type: string
 *                       example: johndoe
 *       500:
 *         description: Server error
 */