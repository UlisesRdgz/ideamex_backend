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

  // Clave de firma de los JWT de sesión. Sin valor por defecto a propósito:
  // `checkRequiredConfig` aborta el arranque si falta. Ver la nota más abajo.
  jwtSecret: (process.env.JWT_SECRET || '').trim(),

  // Información general de la aplicación
  appName: 'IDEAMEX API',
  version: '1.0.0',
  publicApiUrl: (process.env.PUBLIC_API_URL || 'https://iauusmb.ibt.unam.mx/ideamex2/api/').trim(),

  contact: {
    name: 'Ulises Rodríguez García',
    email: 'ulises.rdgz@ciencias.unam.mx',
  },
};

/**
 * Valor que `JWT_SECRET` tuvo como respaldo hasta septiembre de 2026.
 * Se rechaza explícitamente: estuvo publicado en el código fuente, así que
 * cualquiera que lo conozca puede firmar tokens válidos.
 */
const INSECURE_JWT_SECRET = 'defaultsecret';

/**
 * Verifica la configuración obligatoria antes de aceptar tráfico.
 *
 * `JWT_SECRET` no tiene valor por defecto de forma deliberada. Cuando lo tenía,
 * un despliegue sin esa variable arrancaba sin avisar y firmaba todos los tokens
 * de sesión con una cadena conocida: el fallo era invisible y el sistema quedaba
 * abierto. Es preferible que el servidor no levante.
 *
 * @function checkRequiredConfig
 * @throws {Error} Si falta alguna variable obligatoria o su valor no es seguro.
 */
export const checkRequiredConfig = (): void => {
  const problems: string[] = [];

  if (!appConfig.jwtSecret) {
    problems.push('JWT_SECRET no está definida');
  } else if (appConfig.jwtSecret === INSECURE_JWT_SECRET) {
    problems.push(`JWT_SECRET tiene el valor inseguro '${INSECURE_JWT_SECRET}'`);
  }

  if (problems.length > 0) {
    throw new Error(
      `Configuración inválida: ${problems.join('; ')}. ` +
        'Defínela en el entorno del contenedor (env_file del docker-compose) antes de iniciar.'
    );
  }
};
