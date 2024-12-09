/**
 * @file Servicios para la gestión de autenticación de usuarios.
 * Contiene funciones para interactuar con la base de datos relacionadas con usuarios.
 * 
 * @module services/authService
 * @requires ../config/db
 * 
 * @author Ulises Rodriguez García
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