/**
 * @file Archivo principal de la aplicación.
 * Configura el servidor Express, la conexión a la base de datos, las rutas principales y la documentación Swagger protegida.
 * 
 * @module index
 * @requires express
 * @requires dotenv
 * @requires helmet
 * @requires cors
 * @requires morgan
 * @requires cookie-parser
 * @requires swagger-jsdoc
 * @requires swagger-ui-express
 * @requires express-rate-limit
 * @requires ./config/*
 * @requires ./routes/*
 * @requires ./middlewares/*
 * @requires ./utils/*
 * 
 * @author Ulises Rodríguez García
 */

import express, { Application, Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';

import { appConfig } from './config/appConfig';
import { checkDatabaseConnection } from './config/db';
import swaggerOptions from './config/swagger';

import { swaggerAuth } from './middlewares/swaggerAuth.middleware';
import { sendErrorResponse } from './utils/response';

import authRoutes from './api/auth/auth.routes';
import contactRoutes from './api/contact/contact.routes';
import analysisRoutes from './api/analysis/analysis.routes';

// Inicialización
dotenv.config();
const app: Application = express();

// Middleware base
app.use(express.json());
app.use(helmet());
app.use(cors());

// Logging solo en desarrollo
if (appConfig.env !== 'production') {
  app.use(morgan('dev'));
}

// Verificaciones iniciales
checkDatabaseConnection(); // Base de datos

// Documentación Swagger protegida
const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use(`${appConfig.basePath}/docs`, swaggerAuth, swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Rate limit para evitar spam
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2,
  handler: (req: Request, res: Response) => {
    sendErrorResponse(res, 'Has alcanzado el límite de solicitudes. Inténtalo más tarde.', null, 429);
  },
});

// Rutas principales
app.use(`${appConfig.basePath}/auth`, authRoutes);
app.use(`${appConfig.basePath}/contact`, contactLimiter, contactRoutes);
app.use(`${appConfig.basePath}/analysis`, analysisRoutes);

// Ruta principal
app.get(appConfig.basePath, (req: Request, res: Response) => {
  res.json({ message: `Bienvenido a la API de ${appConfig.appName}` });
});

// Manejador global de errores
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[ERROR] Unhandled:', err);
  sendErrorResponse(res, err.message || 'Internal Server Error', err.errors || null, err.statusCode || 500);
});

// Arranque del servidor
app.listen(appConfig.port, '0.0.0.0', () => {
  console.log(`[SERVER] Servidor corriendo en http://132.248.32.106:${appConfig.port}${appConfig.basePath}`);
  console.log(`[DOCS] Swagger disponible en http://132.248.32.106:${appConfig.port}${appConfig.basePath}/docs`);
});
