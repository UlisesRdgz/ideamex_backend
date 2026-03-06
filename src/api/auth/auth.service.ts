/**
 * @file Servicio de autenticación.
 * Contiene funciones para interactuar con la base de datos relacionadas con usuarios.
 * 
 * @module api/auth/auth.service
 * @requires ../../config/db
 * @requires ../../models/User
 * 
 * @author Ulises Rodríguez García
 */

import { pool } from '../../config/db';
import { User } from '../../models/User';

/**
 * Crea un nuevo usuario en la base de datos.
 * 
 * @async
 * @function createUser
 * @param user - Objeto con los datos del nuevo usuario.
 * @returns Usuario recién creado (con su ID).
 */
export const createUser = async (
  user: Omit<User, 'id_user' | 'created_at' | 'updated_at' | 'last_session'>
): Promise<User> => {
  const query = `
    INSERT INTO users (email, username, password, activation, token, token_expiration, password_request, google_id, auth_provider)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const conn = await pool.getConnection();
  let result: { insertId: number };
  try {
    result = await conn.query(query, [
      user.email,
      user.username,
      user.password,
      user.activation,
      user.token,
      user.token_expiration,
      user.password_request,
      user.google_id,
      user.auth_provider,
    ]);
  } finally {
    conn.release();
  }

  return {
    id_user: result.insertId,
    created_at: new Date(),
    updated_at: new Date(),
    last_session: null,
    ...user,
  };
};

/**
 * Busca un usuario por su correo electrónico.
 * 
 * @async
 * @function findUserByEmail
 * @param email - Correo electrónico del usuario.
 * @returns Usuario encontrado o null.
 */
export const findUserByEmail = async (email: string): Promise<User | null> => {
  const conn = await pool.getConnection();
  try {
    const rows = await conn.query('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0] || null;
  } finally {
    conn.release();
  }
};

/**
 * Busca un usuario por su token de activación o recuperación válido.
 *
 * @param token - Token enviado al usuario por correo.
 * @returns Usuario válido o null si está expirado o no existe.
 */
export const findUserByToken = async (token: string): Promise<User | null> => {
  const query = `SELECT * FROM users WHERE token = ? AND token_expiration > NOW()`;
  const [row]: any = await pool.query(query, [token]);
  return row || null;
};

/**
 * Activa la cuenta de un usuario.
 * 
 * @async
 * @function activateUserAccount
 * @param id_user - ID del usuario.
 */
export const activateUserAccount = async (id_user: number): Promise<void> => {
  const query = `
    UPDATE users
    SET activation = 1,
        token = NULL,
        token_expiration = NULL
    WHERE id_user = ?
  `;
  await pool.query(query, [id_user]);
};

/**
 * Actualiza el token de restablecimiento de contraseña y su expiración.
 * 
 * @async
 * @function updateUserResetToken
 * @param userId - ID del usuario.
 * @param token - Token generado.
 * @param tokenExpiration - Fecha de expiración.
 */
export const updateUserResetToken = async (
  userId: number,
  token: string,
  tokenExpiration: Date
): Promise<void> => {
  const query = `UPDATE users SET token = ?, token_expiration = ? WHERE id_user = ?`;
  await pool.query(query, [token, tokenExpiration, userId]);
};

/**
 * Busca un usuario por su token de restablecimiento.
 * 
 * @async
 * @function findUserByResetToken
 * @param token - Token de recuperación de contraseña.
 * @returns Usuario válido o null.
 */
export const findUserByResetToken = async (token: string): Promise<User | null> => {
  const query = `SELECT * FROM users WHERE token = ? AND token_expiration > NOW()`;
  const [row]: any = await pool.query(query, [token]);
  return row || null;
};

/**
 * Actualiza la contraseña del usuario y limpia su token de recuperación.
 * 
 * @async
 * @function updateUserPassword
 * @param userId - ID del usuario.
 * @param hashedPassword - Nueva contraseña cifrada.
 */
export const updateUserPassword = async (
  userId: number,
  hashedPassword: string
): Promise<void> => {
  const query = `
    UPDATE users 
    SET password = ?, token = NULL, token_expiration = NULL 
    WHERE id_user = ?
  `;
  await pool.query(query, [hashedPassword, userId]);
};

/**
 * Busca un usuario por email o Google ID, o lo crea si no existe.
 * 
 * @async
 * @function findOrCreateUser
 * @param params - Datos del usuario (email, username, googleId).
 * @returns Usuario encontrado o recién creado.
 */
export const findOrCreateUser = async (params: {
  email: string;
  username: string;
  googleId: string;
}): Promise<User> => {
  const conn = await pool.getConnection();
  try {
    // Buscar usuario existente
    const [existing]: any = await conn.query(
      'SELECT * FROM users WHERE email = ? OR google_id = ?',
      [params.email, params.googleId]
    );

    if (existing) {
      return existing;
    }

    // Crear usuario nuevo
    const result = await conn.query(
      `INSERT INTO users (email, username, password, activation, auth_provider, google_id, password_request)
       VALUES (?, ?, NULL, 1, 'google', ?, 0)`,
      [params.email, params.username, params.googleId]
    );

    return {
      id_user: result.insertId,
      email: params.email,
      username: params.username,
      password: null,
      activation: 1,
      token: null,
      password_request: 0,
      last_session: null,
      created_at: new Date(),
      updated_at: new Date(),
      google_id: params.googleId,
      token_expiration: null,
      auth_provider: 'google',
    };
  } finally {
    conn.release();
  }
};

/**
 * Busca un usuario por su ID.
 * 
 * @async
 * @function findUserById
 * @param id_user - ID del usuario.
 * @returns Usuario encontrado o null.
 */
export const findUserById = async (id_user: number): Promise<User | null> => {
  const conn = await pool.getConnection();
  try {
    const rows = await conn.query('SELECT * FROM users WHERE id_user = ?', [id_user]);
    return rows[0] || null;
  } finally {
    conn.release();
  }
};
