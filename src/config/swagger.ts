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
 * 
 * @constant {Options} swaggerOptions
 */
const swaggerOptions: Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: appConfig.appName,
            version: appConfig.version,
            description: 'API documentation for the IDEAMEX backend',
            contact: {
                name: appConfig.contact.name,
                email: appConfig.contact.email,
            },
        },
        servers: [
            {
                url: `http://127.0.0.1:${appConfig.port}${appConfig.basePath}`,
                description: 'Local development server',
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
        },
        security: [
            {
                bearerAuth: [],
            },
        ],
    },
    // Incluye anotaciones de Swagger de todos los módulos
    apis: ['./src/api/**/*.docs.ts'],
};

export default swaggerOptions;
