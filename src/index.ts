/**
 * @file Archivo principal de la aplicación.
 * Configura el servidor Express, la conexión a la base de datos, las rutas principales y la documentación Swagger protegida.
 * 
 * @module index
 * @requires express
 * @requires dotenv
 * @requires cors
 * @requires helmet
 * @requires morgan
 * @requires swagger-jsdoc
 * @requires swagger-ui-express
 * @requires cookie-parser
 * @requires passport
 * @requires express-rate-limit
 * @requires ./routes/auth
 * @requires ./routes/protected
 * @requires ./routes/contactRoutes
 * @requires ./config/db
 * @requires ./config/swagger
 * @requires ./config/passportConfig
 * @requires ./middlewares/swaggerAuthMiddleware
 * @requires ./utils/responseUtils
 * 
 * @author Ulises Rodríguez García
 */

import express, { Application, Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import cookieParser from 'cookie-parser';

import authRoutes from './routes/auth';
import { checkDatabaseConnection, pool } from './config/db';
import passport from './config/passportConfig';
import swaggerOptions from './config/swagger';
import { swaggerAuth } from './middlewares/swaggerAuthMiddleware';
import protectedRoutes from './routes/protected';
import { sendErrorResponse } from './utils/responseUtils';
import contactRoutes from './routes/contactRoutes';
import rateLimit from 'express-rate-limit';

// Carga las variables de entorno
dotenv.config();

// Configuración de la aplicación
const app: Application = express();
const PORT: number = parseInt(process.env.PORT || '3000', 10);
const BASE_PATH: string = process.env.BASE_PATH || '/api';

// Middlewares globales
app.use(express.json());
app.use(cookieParser());
app.use(helmet());
app.use(cors());

if (process.env.NODE_ENV !== 'production') {
    app.use(morgan('dev'));
}

// Inicializar Passport
app.use(passport.initialize());

// Verifica la conexión a la base de datos
checkDatabaseConnection();

// Configuración de Swagger
const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use(`${BASE_PATH}/docs`, swaggerAuth, swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/**
 * Middleware de limitación de solicitudes para evitar spam en la ruta de contacto.
 * Limita a 2 solicitudes por IP cada 15 minutos.
 */
const contactLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 2,
    handler: (req: Request, res: Response) => {
        sendErrorResponse(res, 'Has alcanzado el límite de solicitudes. Inténtalo de nuevo más tarde.', null, 429);
    },
});

// Definición de rutas
app.use(`${BASE_PATH}/auth`, authRoutes);
app.use(`${BASE_PATH}/contact`, contactLimiter, contactRoutes);
app.use(`${BASE_PATH}/protected`, protectedRoutes);

/**
 * Ruta principal.
 * @name GET /
 * @function
 * @returns {Object} Mensaje de bienvenida.
 */
app.get(`${BASE_PATH}`, (req: Request, res: Response) => {
    res.json({ message: `Welcome to the IDEAMEX Backend API!` });
});

/**
 * Middleware para manejar errores no controlados.
 * @function
 * @param {Error} err - Error capturado.
 * @param {Request} req - Objeto de solicitud de Express.
 * @param {Response} res - Objeto de respuesta de Express.
 * @param {NextFunction} next - Función para pasar al siguiente middleware.
 * @returns {void}
 */
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('Unhandled Error:', err);
    const statusCode = err.statusCode || 500;
    sendErrorResponse(res, err.message || 'Internal Server Error', err.errors, statusCode);
});

// Inicia el servidor
app.listen(PORT, '127.0.0.1', () => {
    console.log(`Server running on http://127.0.0.1:${PORT}${BASE_PATH}`);
    console.log(`Swagger docs available at http://127.0.0.1:${PORT}${BASE_PATH}/docs`);
});