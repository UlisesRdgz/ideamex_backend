/**
 * @file Configuración centralizada de la aplicación.
 * Contiene parámetros globales reutilizables en todo el backend.
 * 
 * @module config/appConfig
 * @requires dotenv
 * 
 * @author Ulises Rodríguez García
 */

import dotenv from 'dotenv';

dotenv.config();

export const appConfig = {
  // Entorno y puerto
  env: process.env.NODE_ENV || 'production',
  port: parseInt(process.env.PORT || '5000', 10),

  // Express recibirá solo "/", porque nginx elimina el prefijo /ideamex2/api/
  basePath: "/",

  // Información general de la aplicación
  appName: 'IDEAMEX API',
  version: '1.0.0',

  contact: {
    name: 'Ulises Rodríguez García',
    email: 'ulises.rdgz@ciencias.unam.mx',
  },
};