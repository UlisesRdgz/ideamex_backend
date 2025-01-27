/**
 * @file Configuración de Swagger para la documentación de la API.
 * Define la configuración general y especifica los archivos que contienen las anotaciones de Swagger.
 * 
 * @module config/swagger
 * @requires swagger-jsdoc
 * 
 * @author Ulises Rodríguez García
 */

import { Options } from 'swagger-jsdoc';

/**
 * Configuración para generar la documentación de Swagger.
 * 
 * @constant {Options} swaggerOptions
 */
const swaggerOptions: Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'IDEAMEX API',
            version: '1.0.0',
            description: 'API documentation for the IDEAMEX backend',
            contact: {
                name: 'Ulises Rodriguez García',
                email: 'ulises.rdgz@ciencias.unam.mx',
            },
        },
        servers: [
            {
                url: 'http://localhost:3000',
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
    // Incluye los archivos de la carpeta `docs` en la generación de documentación
    apis: ['./src/docs/*.ts'],
};

export default swaggerOptions;