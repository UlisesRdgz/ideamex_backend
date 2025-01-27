/**
 * @file Servicios para la gestión de autenticación de usuarios.
 * Contiene funciones para interactuar con la base de datos relacionadas con usuarios.
 * 
 * @module services/authService
 * @requires ../config/db
 * 
 * @author Ulises Rodríguez García
 */

import { pool } from '../config/db';

interface User {
    email: string;
    username: string;
    password: string;
    activation: number;
    token: string;
    token_expiration?: Date;
}

/**
 * Crea un nuevo usuario en la base de datos.
 * 
 * @async
 * @function createUser
 * @param {User} user - Datos del usuario a registrar.
 * @throws {Error} Si ocurre un error durante la consulta.
 */
export const createUser = async (user: User) => {
    const query = `
        INSERT INTO users (email, username, password, activation, token, token_expiration)
        VALUES (?, ?, ?, ?, ?, ?)
    `;
    try {
        const conn = await pool.getConnection();
        const result = await conn.query(query, [
            user.email,
            user.username,
            user.password,
            user.activation,
            user.token,
            user.token_expiration,
        ]);
        conn.release(); 
        return { id: result.insertId, ...user };
    } catch (error) {
        throw error;
    }
};

/**
 * Busca un usuario por su correo electrónico.
 * 
 * @async
 * @function findUserByEmail
 * @param {string} email - Correo electrónico a buscar.
 * @throws {Error} Si ocurre un error durante la consulta.
 */
export const findUserByEmail = async (email: string) => {
    const query = 'SELECT * FROM users WHERE email = ?';
    try {
        const conn = await pool.getConnection();
        const rows = await conn.query(query, [email]);
        conn.release();
        return rows[0];
    } catch (error) {
        throw error;
    }
};

/**
 * Busca un usuario por su token de activación.
 * 
 * @async
 * @function findUserByToken
 * @param {string} token - Token de activación a buscar.
 * @throws {Error} Si ocurre un error durante la consulta.
 */
export const findUserByToken = async (token: string) => {
    try {
        const query = `
            SELECT * FROM users 
            WHERE token = ? 
            AND token_expiration > NOW()
        `;
        const [rows]: any = await pool.query(query, [token]);
        return rows || null;
    } catch (error) {
        throw new Error('Database query failed');
    }
};

/**
 * Activa la cuenta de un usuario por su ID.
 * 
 * @async
 * @function activateUserAccount
 * @param {number} id_user - ID del usuario a activar.
 * @throws {Error} Si ocurre un error durante la actualización.
 */
export const activateUserAccount = async (id_user: number) => {
    const query = `
        UPDATE users 
        SET activation = 1, 
            token = NULL, 
            token_expiration = NULL
        WHERE id_user = ?
    `;
    try {
        await pool.query(query, [id_user]);
    } catch (error) {
        throw new Error('Failed to activate user account');
    }
};

/**
 * Actualiza el token de restablecimiento y su expiración en la base de datos.
 * 
 * @async
 * @function updateUserResetToken
 * @param {number} userId - ID del usuario.
 * @param {string} token - Token de restablecimiento de contraseña.
 * @param {Date} tokenExpiration - Fecha de expiración del token.
 * @throws {Error} Error al actualizar el token en la base de datos.
 */
export const updateUserResetToken = async (userId: number, token: string, tokenExpiration: Date) => {
    const query = `
        UPDATE users 
        SET token = ?, token_expiration = ? 
        WHERE id_user = ?
    `;
    try {
        await pool.query(query, [token, tokenExpiration, userId]);
    } catch (error) {
        throw error;
    }
};

/**
 * Busca un usuario por su token de restablecimiento.
 * 
 * @async
 * @function findUserByResetToken
 * @param {string} token - Token de restablecimiento de contraseña.
 * @returns {Promise<Object|null>} Usuario encontrado o `null` si no existe.
 * @throws {Error} Error al buscar el usuario en la base de datos.
 */
export const findUserByResetToken = async (token: string) => {
    const query = `
        SELECT * FROM users 
        WHERE token = ? 
        AND token_expiration > NOW()
    `;
    try {
        const [rows]: any = await pool.query(query, [token]);
        return rows || null;
    } catch (error) {
        throw error;
    }
};

/**
 * Actualiza la contraseña de un usuario y elimina el token de restablecimiento.
 * 
 * @async
 * @function updateUserPassword
 * @param {number} userId - ID del usuario.
 * @param {string} hashedPassword - Nueva contraseña cifrada.
 * @throws {Error} Error al actualizar la contraseña en la base de datos.
 */
export const updateUserPassword = async (userId: number, hashedPassword: string) => {
    const query = `
        UPDATE users 
        SET password = ?, token = NULL, token_expiration = NULL 
        WHERE id_user = ?
    `;
    try {
        await pool.query(query, [hashedPassword, userId]);
    } catch (error) {
        throw error;
    }
};

/**
 * Busca un usuario por email o Google ID, o lo crea si no existe.
 * 
 * @async
 * @function findOrCreateUser
 * @param {Object} params - Datos del usuario.
 * @param {string} params.email - Correo electrónico del usuario.
 * @param {string} params.username - Nombre de usuario.
 * @param {string} params.googleId - ID de Google del usuario.
 * @throws {Error} Error al buscar o crear el usuario en la base de datos.
 */
export const findOrCreateUser = async ({ email, username, googleId }: { email: string; username: string; googleId: string }) => {
    const queryFind = `SELECT * FROM users WHERE email = ? OR google_id = ?`;
    const queryInsert = `
        INSERT INTO users (email, username, google_id, password, activation, auth_provider) 
        VALUES (?, ?, ?, ?, 1, ?)
    `;

    try {
        const conn = await pool.getConnection();
        
        // Buscar al usuario por email o google_id
        const [user]: any = await conn.query(queryFind, [email, googleId]);

        if (user) {
            conn.release();
            return user; // Usuario ya existe
        }

        // Crear el usuario si no existe
        const result = await conn.query(queryInsert, [
            email,
            username,
            googleId,
            null, // La contraseña será NULL para usuarios de Google
            'google', // Indicar el proveedor de autenticación
        ]);

        conn.release();

        return {
            id_user: result.insertId,
            email,
            username,
        };
    } catch (error) {
        throw error;
    }
};

/**
 * Busca un usuario por su ID.
 * 
 * @async
 * @function findUserById
 * @param {number} id_user - ID del usuario.
 * @throws {Error} Error al buscar el usuario en la base de datos.
 */
export const findUserById = async (id_user: number) => {
    const query = `SELECT * FROM users WHERE id_user = ?`;

    try {
        const conn = await pool.getConnection();
        const [user]: any = await conn.query(query, [id_user]);
        conn.release();

        return user || null;
    } catch (error) {
        throw error;
    }
};