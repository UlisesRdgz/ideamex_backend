/**
 * @file Archivo principal de la aplicación.
 * Configura el servidor Express, la conexión a la base de datos,
 * las rutas principales y la documentación Swagger protegida.
 * 
 * @module index
 * @requires express
 * @requires dotenv
 */

import dotenv from 'dotenv';
dotenv.config(); // ✔ Cargar .env ANTES de cualquier otro import que lea variables

import express, { Application, Request, Response, NextFunction } from 'express';
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

// Inicialización del servidor
const app: Application = express();

// Middlewares globales
// Permite parsear body JSON en todos los endpoints.
app.use(express.json());

// Helmet con configuración recomendada para evitar bloqueos CORP
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

// CORS abierto, lo puedes personalizar más adelante
app.use(cors());

// Logging solo en desarrollo
if (appConfig.env !== 'production') {
  app.use(morgan('dev'));
}

// Verificación de conexión a la base de datos
// Se ejecuta al arranque para fallar rápido si DB no está disponible.
checkDatabaseConnection();

// Configuración de Swagger (documentación protegida con auth)
const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use(
  `${appConfig.basePath}docs`,
  swaggerAuth,
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec)
);

// Rate limit para evitar spam en el formulario de contacto
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    sendErrorResponse(
      res,
      'Has alcanzado el límite de solicitudes. Inténtalo más tarde.',
      null,
      429
    );
  },
});

// Rutas principales
// Todas usan `basePath` para soportar despliegues detrás de reverse proxy.
app.use(`${appConfig.basePath}auth`, authRoutes);
app.use(`${appConfig.basePath}contact`, contactLimiter, contactRoutes);
app.use(`${appConfig.basePath}analysis`, analysisRoutes);

// Ruta base
app.get(appConfig.basePath, (req: Request, res: Response) => {
  res.json({ message: `Bienvenido a la API de ${appConfig.appName}` });
});

// Manejador global de errores
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[ERROR] Unhandled:', err);

  if (err?.type === 'entity.parse.failed') {
    sendErrorResponse(res, 'JSON inválido en el body de la solicitud', null, 400);
    return;
  }

  if (err?.name === 'MulterError') {
    // Errores nativos de multer (p.ej. tamaño máximo).
    const fileErrorMessage =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'Archivo demasiado grande. El máximo permitido es 25 MB'
        : 'Error al procesar archivo de subida';
    sendErrorResponse(res, fileErrorMessage, null, 400);
    return;
  }

  if (typeof err?.message === 'string' && err.message.includes('Invalid file type')) {
    // Error semántico emitido desde `fileFilter` de multer.
    sendErrorResponse(res, err.message, null, 400);
    return;
  }

  sendErrorResponse(
    res,
    err.message || 'Internal Server Error',
    err.errors || null,
    err.statusCode || 500
  );
});

// Inicio del servidor
app.listen(appConfig.port, '0.0.0.0', () => {
  console.log(
    `[SERVER] API interna escuchando en http://0.0.0.0:${appConfig.port}${appConfig.basePath}`
  );

  // Ruta pública real (con prefijo que NGINX expone)
  console.log(
    `[NGINX] API pública disponible en https://iauusmb.ibt.unam.mx/ideamex2/api/`
  );

  console.log(
    `[DOCS] Swagger público disponible en https://iauusmb.ibt.unam.mx/ideamex2/api/docs`
  );
});
