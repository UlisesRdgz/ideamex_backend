/**
 * @file Configuración de la conexión a la base de datos MariaDB.
 * Utiliza variables de entorno para los parámetros de conexión.
 * 
 * @module config/db
 * @requires mariadb
 * @requires dotenv
 * 
 * @author Ulises Rodríguez García
 */

import mariadb from 'mariadb';
import dotenv from 'dotenv';

// Carga las variables de entorno desde el archivo .env
dotenv.config();

/**
 * Pool de conexiones para la base de datos MariaDB.
 * Permite reutilizar conexiones para optimizar el rendimiento.
 */
export const pool = mariadb.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectionLimit: 5,
    supportBigNumbers: true,
});

/**
 * Verifica la conexión a la base de datos al iniciar la aplicación.
 * Si hay un error, detiene la ejecución del servidor.
 */
export const checkDatabaseConnection = async () => {
    try {
        const conn = await pool.getConnection();
        console.log('Connected to MariaDB');
        conn.release();
    } catch (err) {
        console.error('Database connection error:', err);
        process.exit(1);
    }
};