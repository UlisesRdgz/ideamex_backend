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
 * Normaliza correos electrónicos para evitar duplicados.
 */
const normalizeEmail = (email: string): string => {
  return email.trim().toLowerCase();
};

/**
 * Convierte un registro de la BD en un objeto User tipado.
 */
const mapUser = (row: any): User => ({
  id_user: row.id_user,
  email: row.email,
  username: row.username,
  password: row.password,
  activation: row.activation,
  token: row.token,
  token_expiration: row.token_expiration,
  password_request: row.password_request,
  google_id: row.google_id,
  auth_provider: row.auth_provider,
  last_session: row.last_session,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

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
  try {
    const normalizedEmail = normalizeEmail(user.email);

    const [result]: any = await conn.query(query, [
      normalizedEmail,
      user.username,
      user.password,
      user.activation,
      user.token,
      user.token_expiration,
      user.password_request,
      user.google_id,
      user.auth_provider,
    ]);

    if (!result.insertId) throw new Error("User creation failed");

    return {
      id_user: result.insertId,
      created_at: new Date(),
      updated_at: new Date(),
      last_session: null,
      ...user,
      email: normalizedEmail,
    };

  } finally {
    conn.release();
  }
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
  const normalizedEmail = normalizeEmail(email);

  const conn = await pool.getConnection();
  try {
    const result: any = await conn.query(
      'SELECT * FROM users WHERE email = ?',
      [normalizedEmail]
    );

    const rows = result[0];

    return rows && rows.length > 0 ? mapUser(rows[0]) : null;
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
  const conn = await pool.getConnection();
  try {
    const result: any = await conn.query(
      `SELECT * FROM users WHERE token = ? AND token_expiration > NOW()`,
      [token]
    );

    const rows = result[0];

    return rows && rows.length > 0 ? mapUser(rows[0]) : null;
  } finally {
    conn.release();
  }
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

  const conn = await pool.getConnection();
  try {
    await conn.query(query, [id_user]);
  } finally {
    conn.release();
  }
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
  const conn = await pool.getConnection();
  try {
    await conn.query(
      `UPDATE users SET token = ?, token_expiration = ? WHERE id_user = ?`,
      [token, tokenExpiration, userId]
    );
  } finally {
    conn.release();
  }
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
  const conn = await pool.getConnection();
  try {
    const result: any = await conn.query(
      `SELECT * FROM users WHERE token = ? AND token_expiration > NOW()`,
      [token]
    );

    const rows = result[0];

    return rows && rows.length > 0 ? mapUser(rows[0]) : null;
  } finally {
    conn.release();
  }
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
  const conn = await pool.getConnection();
  try {
    await conn.query(
      `UPDATE users 
       SET password = ?, token = NULL, token_expiration = NULL 
       WHERE id_user = ?`,
      [hashedPassword, userId]
    );
  } finally {
    conn.release();
  }
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
  const normalizedEmail = normalizeEmail(params.email);

  try {
    const result: any = await conn.query(
      `
      SELECT * FROM users 
      WHERE email = ? 
         OR (google_id IS NOT NULL AND google_id = ?)
      `,
      [normalizedEmail, params.googleId]
    );

    const rows = result[0];

    if (rows && rows.length > 0) {
      return mapUser(rows[0]);
    }

    const insertResult: any = await conn.query(
      `
      INSERT INTO users (
        email, username, password, activation,
        auth_provider, google_id, password_request
      )
      VALUES (?, ?, NULL, 1, 'google', ?, 0)
      `,
      [normalizedEmail, params.username, params.googleId]
    );

    const insert = insertResult[0];

    if (!insert?.insertId) {
      throw new Error('Failed to create Google auth user');
    }

    return {
      id_user: insert.insertId,
      email: normalizedEmail,
      username: params.username,
      password: null,
      activation: 1,
      token: null,
      token_expiration: null,
      password_request: 0,
      google_id: params.googleId,
      auth_provider: 'google',
      created_at: new Date(),
      updated_at: new Date(),
      last_session: null,
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
    const result: any = await conn.query(
      'SELECT * FROM users WHERE id_user = ?',
      [id_user]
    );

    const rows = result[0];

    return rows && rows.length > 0 ? mapUser(rows[0]) : null;
  } finally {
    conn.release();
  }
};
