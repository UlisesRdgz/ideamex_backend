/**
 * @file Archivo principal de la aplicación.
 * Configura el servidor Express, la conexión a la base de datos,
 * las rutas principales y la documentación Swagger protegida.
 * 
 * @module index
 * @requires express
 * @requires dotenv
 *
 * @author Ulises Rodríguez García
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

import { appConfig, checkRequiredConfig } from './config/appConfig';
import { checkDatabaseConnection } from './config/db';
import { checkEmailConnection } from './config/email';
import swaggerOptions from './config/swagger';

import { swaggerAuth } from './middlewares/swaggerAuth.middleware';
import { sendErrorResponse, sendSuccessResponse } from './utils/response';

import authRoutes from './api/auth/auth.routes';
import contactRoutes from './api/contact/contact.routes';
import analysisRoutes from './api/analysis/analysis.routes';

// Inicialización del servidor
const app: Application = express();

// Middlewares globales
// Permite parsear body JSON en todos los endpoints.
app.use(express.json());

// Helmet aplica las cabeceras de seguridad recomendadas, salvo
// Cross-Origin-Resource-Policy: con su valor por defecto el navegador bloquea
// las imágenes de resultados que el frontend incrusta desde este origen.
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

// CORS abierto, lo puedes personalizar más adelante.
// Pendiente: en producción conviene restringirlo al dominio del frontend, ya que
// la API maneja tokens de sesión.
app.use(cors());

// Logging solo en desarrollo
if (appConfig.env !== 'production') {
  app.use(morgan('dev'));
}

// Configuración de Swagger (documentación protegida con auth)
const swaggerSpec = swaggerJsdoc(swaggerOptions);
const docsPath = `${appConfig.basePath}docs`;

// Canonicaliza /docs -> /docs/ con redirección relativa, sin romper prefijos en reverse proxy.
//
// Swagger UI resuelve sus recursos (hojas de estilo y scripts) con rutas
// relativas, así que necesita la barra final para que apunten dentro de /docs/ y
// no al directorio padre. La redirección se emite como ruta relativa —"docs/" y
// no "/docs/"— porque Express solo ve "/": nginx ya quitó el prefijo
// /ideamex2/api/, y una ruta absoluta mandaría al usuario fuera de la aplicación.
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path === docsPath && !req.originalUrl.endsWith('/')) {
    res.redirect(301, 'docs/');
    return;
  }
  next();
});

app.use(
  docsPath,
  swaggerAuth,
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec)
);

// Rate limit para evitar spam en el formulario de contacto.
// Es el único endpoint sin autenticación que provoca un efecto externo —envía
// correo—, de modo que sin límite sería utilizable para inundar el buzón del
// proyecto. Dos envíos cada quince minutos por IP bastan para el uso legítimo.
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
  sendSuccessResponse(res, `Bienvenido a la API de ${appConfig.appName}`, null, 200);
});

// Manejador global de errores.
//
// Debe declararse al final y con los cuatro parámetros: Express identifica un
// manejador de errores por su aridad, y si `next` se omite lo trata como un
// middleware normal que nunca recibirá las excepciones.
//
// Su papel es traducir errores que se originan fuera de los controladores
// —el parseo del body y las validaciones de multer ocurren antes de que estos
// se ejecuten— a la misma forma de respuesta que usa el resto de la API, para
// que el frontend no tenga que distinguir de dónde vino el fallo.
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
const startServer = (): void => {
  const localBaseUrl = `http://127.0.0.1:${appConfig.port}${appConfig.basePath}`;
  const internalBaseUrl = `http://0.0.0.0:${appConfig.port}${appConfig.basePath}`;
  const publicBaseUrl = appConfig.publicApiUrl;

  // Se escucha en 0.0.0.0 y no en 127.0.0.1 porque el proceso vive dentro de un
  // contenedor: atado a la interfaz local solo sería alcanzable desde el propio
  // contenedor, y nginx no podría llegar a él.
  app.listen(appConfig.port, '0.0.0.0', () => {
    console.log('====================================================');
    console.log(`[SERVER] API interna escuchando en ${internalBaseUrl}`);
    console.log(`[DOCS]   Swagger local disponible en ${localBaseUrl}docs`);
    console.log(`[PUBLIC] API pública disponible en ${publicBaseUrl}`);
    console.log(`[DOCS]   Swagger público disponible en ${publicBaseUrl}docs`);
    console.log('====================================================');
  });
};

/**
 * Arranque de la aplicación.
 *
 * Verifica configuración, base de datos y correo antes de abrir el puerto, y
 * termina el proceso si algo falla. Es deliberado que no arranque a medias: bajo
 * pm2 un `exit(1)` provoca reintentos y, si el fallo persiste, deja el
 * contenedor detenido con el error en el log. Escuchar peticiones sin base de
 * datos daría errores intermitentes mucho más difíciles de diagnosticar.
 */
const bootstrap = async (): Promise<void> => {
  try {
    // Primero la configuración: si falta, no tiene sentido abrir conexiones.
    checkRequiredConfig();
    console.log('[CONFIG] Variables obligatorias presentes');

    await checkDatabaseConnection();
    console.log('[DB] Conexión exitosa a MariaDB');

    await checkEmailConnection();
    console.log('[EMAIL] Servidor de correo listo para enviar mensajes.');

    startServer();
  } catch (error) {
    console.error('[BOOT] Error al iniciar la aplicación:', error);
    process.exit(1);
  }
};

bootstrap();
