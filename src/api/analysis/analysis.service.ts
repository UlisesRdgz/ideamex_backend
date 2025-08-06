/**
 * @file Servicio de análisis.
 * Maneja operaciones de guardado y validación de proyectos en la base de datos.
 * 
 * @module api/analysis/analysis.service
 * @requires ../../config/db
 *  
 * @author Ulises Rodríguez García
 */

import { pool } from '../../config/db';

/**
 * Guarda un nuevo proyecto en la base de datos.
 * 
 * @async
 * @function createProject
 * @param id_user - ID del usuario propietario del proyecto.
 * @param name - Nombre del proyecto.
 * @param description - Descripción opcional del proyecto.
 * @param status - Estado del proyecto ('active', 'inactive', 'completed').
 * @param path - Ruta del archivo almacenado.
 * @returns ID del nuevo proyecto creado.
 */
export const createProject = async (
  id_user: number,
  name: string,
  description: string | null,
  status: 'active' | 'inactive' | 'completed',
  path: string
): Promise<number> => {
  const query = `
    INSERT INTO projects (id_user, name, description, status, path)
    VALUES (?, ?, ?, ?, ?)
  `;

  const values = [id_user, name, description, status, path];

  const conn = await pool.getConnection();
  try {
    const result = await conn.query(query, values);
    return result.insertId;
  } finally {
    conn.release();
  }
};

/**
 * Verifica si un proyecto con el mismo nombre ya existe para el usuario.
 * Previene errores por claves únicas duplicadas.
 * 
 * @async
 * @function projectExists
 * @param id_user - ID del usuario.
 * @param name - Nombre del proyecto a verificar.
 * @returns true si el proyecto ya existe, false en caso contrario.
 */
export const projectExists = async (
  id_user: number,
  name: string
): Promise<boolean> => {
  const conn = await pool.getConnection();
  try {
    const [row]: any = await conn.query(
      'SELECT 1 FROM projects WHERE id_user = ? AND name = ? LIMIT 1',
      [id_user, name]
    );
    return !!row;
  } finally {
    conn.release();
  }
};

/**
 * Obtiene todos los proyectos de un usuario.
 * 
 * @async
 * @function getProjectsByUser
 * @param id_user - ID del usuario autenticado.
 * @returns Lista de proyectos del usuario.
 */
export const getProjectsByUser = async (id_user: number): Promise<any[]> => {
  const query = `
    SELECT id_project, name, description, status, path, created_at
    FROM projects
    WHERE id_user = ?
    ORDER BY created_at DESC
  `;

  const conn = await pool.getConnection();
  try {
    const rows = await conn.query(query, [id_user]);
    return rows;
  } finally {
    conn.release();
  }
};

/**
 * Elimina un proyecto de la base de datos.
 * 
 * @async
 * @function deleteProjectById
 * @param id_user - ID del usuario.
 * @param id_project - ID del proyecto a eliminar.
 */
export const deleteProjectById = async (
  id_project: number,
  id_user: number
): Promise<void> => {
  const conn = await pool.getConnection();
  try {
    const result = await conn.query(
      `DELETE FROM projects WHERE id_project = ? AND id_user = ?`,
      [id_project, id_user]
    );

    if (result.affectedRows === 0) {
      throw new Error('No rows deleted from DB');
    }
  } finally {
    conn.release();
  }
};

/**
 * Obtiene la ruta de almacenamiento relativa de un proyecto.
 * 
 * @async
 * @function getProjectPathById
 * @param id_user - ID del usuario.
 * @param id_project - ID del proyecto.
 * @returns Ruta relativa del proyecto si existe, null si no.
 */
export const getProjectPathById = async (
  id_project: number,
  id_user: number
): Promise<string | null> => {
  const conn = await pool.getConnection();
  try {
    const rows = await conn.query(
      `SELECT path FROM projects WHERE id_project = ? AND id_user = ?`,
      [id_project, id_user]
    );
    return rows[0]?.path || null;
  } finally {
    conn.release();
  }
};