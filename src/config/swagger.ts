/**
 * @file Configuración de Swagger para la documentación de la API.
 * Define la configuración general y especifica los archivos que contienen las anotaciones de Swagger.
 * 
 * @module config/swagger
 * @requires swagger-jsdoc
 * @requires ./appConfig
 * 
 * @author Ulises Rodríguez García
 */

import { Options } from 'swagger-jsdoc';
import { appConfig } from './appConfig';

/**
 * Configuración para generar la documentación de Swagger.
 * Solo lo transversal: datos de la API, servidores, autenticación y los
 * componentes que las rutas referencian con `$ref`. La documentación de cada
 * endpoint vive en los `.docs.ts` de su módulo.
 *
 * @constant {Options} swaggerOptions
 */
const swaggerOptions: Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: appConfig.appName,
      version: appConfig.version,
      description:
        'API del backend de IDEAMEX para autenticación, contacto y gestión/ejecución de análisis.',
      contact: {
        name: appConfig.contact.name,
        email: appConfig.contact.email,
      },
    },
    // Se declaran ambos porque la ruta pública no coincide con la interna: nginx
    // atiende en /ideamex2/api/ y elimina ese prefijo antes de pasar la petición
    // a Express, que solo ve "/". Sin la entrada pública, el botón de probar de
    // Swagger apuntaría a una URL inexistente desde fuera del servidor.
    servers: [
      {
        url: `http://127.0.0.1:${appConfig.port}${appConfig.basePath}`,
        description: 'Servidor local',
      },
      {
        url: appConfig.publicApiUrl,
        description: 'Servidor público',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          required: ['status', 'message', 'details'],
          properties: {
            status: {
              type: 'string',
              enum: ['error'],
              example: 'error',
            },
            message: {
              type: 'string',
              example: 'Validation failed',
            },
            details: {
              nullable: true,
              description: 'Detalles opcionales del error (objeto, arreglo o null).',
              example: null,
            },
          },
          example: {
            status: 'error',
            message: 'Validation failed',
            details: null,
          },
        },
      },
      responses: {
        BadRequest: {
          description: 'Solicitud inválida',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse',
              },
              example: {
                status: 'error',
                message: 'Validation failed',
                details: [
                  {
                    msg: 'Correo electrónico inválido',
                    path: 'email',
                  },
                ],
              },
            },
          },
        },
        Unauthorized: {
          description: 'No autenticado o token inválido',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse',
              },
              example: {
                status: 'error',
                message: 'Token inválido o expirado',
                details: null,
              },
            },
          },
        },
        Forbidden: {
          description: 'Acceso prohibido para la operación solicitada',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse',
              },
              example: {
                status: 'error',
                message: 'No tienes permisos para esta operación',
                details: null,
              },
            },
          },
        },
        NotFound: {
          description: 'Recurso no encontrado',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse',
              },
              example: {
                status: 'error',
                message: 'Recurso no encontrado',
                details: null,
              },
            },
          },
        },
        Conflict: {
          description: 'Conflicto de estado o de datos',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse',
              },
              example: {
                status: 'error',
                message: 'Conflicto de estado del recurso',
                details: null,
              },
            },
          },
        },
        TooManyRequests: {
          description: 'Límite de solicitudes excedido',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse',
              },
              example: {
                status: 'error',
                message: 'Has alcanzado el límite de solicitudes',
                details: null,
              },
            },
          },
        },
        InternalServerError: {
          description: 'Error interno del servidor',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse',
              },
              example: {
                status: 'error',
                message: 'Error interno del servidor',
                details: null,
              },
            },
          },
        },
      },
    },
  },
  // Incluye anotaciones de Swagger de todos los módulos.
  // La ruta es relativa al directorio de trabajo del proceso, no a este archivo,
  // y apunta al código fuente: los `.docs.ts` llevan las anotaciones en
  // comentarios, que desaparecen al compilar a `dist/`. Por eso el contenedor de
  // producción también copia `src/`, aunque ejecute el compilado.
  apis: ['./src/api/**/*.docs.ts'],
};

export default swaggerOptions;
