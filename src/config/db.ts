/**
 * @file Configura la conexión a la base de datos MariaDB.
 * 
 * @module config/db
 * @requires mariadb
 * @requires dotenv
 * 
 * @author Ulises Rodríguez García
 */

import mariadb from 'mariadb';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Pool de conexiones para la base de datos MariaDB.
 * Permite reutilizar conexiones para optimizar el rendimiento.
 */
export const pool = mariadb.createPool({
    // En Docker, DB_HOST suele ser el nombre del servicio (ej. `db`).
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ideamex',
    connectionLimit: 10,
    supportBigNumbers: true,
    bigNumberStrings: true,
    connectTimeout: 5000,
});

/**
 * Verifica la conexión a la base de datos al iniciar la aplicación.
 * Si hay un error, detiene la ejecución del servidor.
 */
export const checkDatabaseConnection = async (): Promise<void> => {
  // Abre y libera una conexión real para verificar credenciales/red.
  const conn = await pool.getConnection();
  conn.release();
};
