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

export interface AnalysisRunParams {
  methods: string;
  logfc: number;
  cpm: number;
  padjust: number;
  batch: string | null;
  generateZip: boolean;
  top: boolean;
}

export interface ProjectRecord {
  id_project: number;
  user_id: number;
  name: string;
  description: string | null;
  status: 'active' | 'inactive' | 'completed';
  path: string;
  locked_at: Date | null;
  run_started_at: Date | null;
  run_finished_at: Date | null;
  run_params_json: string | null;
  result_path: string | null;
  run_error: string | null;
  created_at: Date;
  updated_at: Date;
}

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
    INSERT INTO projects (user_id, name, description, status, path)
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
      'SELECT 1 FROM projects WHERE user_id = ? AND name = ? LIMIT 1',
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
    SELECT
      id_project,
      name,
      description,
      status,
      path,
      locked_at,
      run_started_at,
      run_finished_at,
      result_path,
      run_error,
      created_at
    FROM projects
    WHERE user_id = ?
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
      `DELETE FROM projects WHERE id_project = ? AND user_id = ?`,
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
      `SELECT path FROM projects WHERE id_project = ? AND user_id = ?`,
      [id_project, id_user]
    );
    return rows[0]?.path || null;
  } finally {
    conn.release();
  }
};

/**
 * Obtiene un proyecto específico perteneciente a un usuario.
 */
export const getProjectById = async (
  id_project: number,
  id_user: number
): Promise<ProjectRecord | null> => {
  const conn = await pool.getConnection();
  try {
    const rows = await conn.query(
      `
      SELECT
        id_project,
        user_id,
        name,
        description,
        status,
        path,
        locked_at,
        run_started_at,
        run_finished_at,
        run_params_json,
        result_path,
        run_error,
        created_at,
        updated_at
      FROM projects
      WHERE id_project = ? AND user_id = ?
      LIMIT 1
      `,
      [id_project, id_user]
    );

    return rows[0] || null;
  } finally {
    conn.release();
  }
};

/**
 * Bloquea un proyecto para iniciar su corrida.
 * Regresa false si el proyecto ya estaba bloqueado.
 */
export const lockProjectForRun = async (
  id_project: number,
  id_user: number,
  runParams: AnalysisRunParams,
  resultPath: string
): Promise<boolean> => {
  const conn = await pool.getConnection();
  try {
    const result = await conn.query(
      `
      UPDATE projects
      SET
        locked_at = NOW(),
        run_started_at = NOW(),
        run_finished_at = NULL,
        run_params_json = ?,
        result_path = ?,
        run_error = NULL
      WHERE id_project = ? AND user_id = ? AND locked_at IS NULL
      `,
      [JSON.stringify(runParams), resultPath, id_project, id_user]
    );

    return result.affectedRows === 1;
  } finally {
    conn.release();
  }
};

/**
 * Marca un proyecto como análisis exitoso.
 */
export const markProjectRunCompleted = async (
  id_project: number,
  id_user: number,
  resultPath: string
): Promise<void> => {
  const conn = await pool.getConnection();
  try {
    await conn.query(
      `
      UPDATE projects
      SET
        status = 'completed',
        run_finished_at = NOW(),
        result_path = ?,
        run_error = NULL
      WHERE id_project = ? AND user_id = ?
      `,
      [resultPath, id_project, id_user]
    );
  } finally {
    conn.release();
  }
};

/**
 * Marca un proyecto como análisis fallido y registra el error.
 */
export const markProjectRunFailed = async (
  id_project: number,
  id_user: number,
  errorMessage: string
): Promise<void> => {
  const conn = await pool.getConnection();
  try {
    await conn.query(
      `
      UPDATE projects
      SET
        status = 'inactive',
        run_finished_at = NOW(),
        run_error = ?
      WHERE id_project = ? AND user_id = ?
      `,
      [errorMessage, id_project, id_user]
    );
  } finally {
    conn.release();
  }
};
