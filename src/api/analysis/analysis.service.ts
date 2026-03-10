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
 * Parámetros normalizados que el backend envía al motor de análisis en R.
 * Este contrato evita depender directamente del body HTTP en capas internas.
 */
export interface AnalysisRunParams {
  /**
   * Métodos seleccionados en formato compacto (ejemplo: "1236").
   */
  methods: string;
  /**
   * Umbral de log fold-change.
   */
  logfc: number;
  /**
   * Umbral CPM (counts per million).
   */
  cpm: number;
  /**
   * Umbral de p-adjusted para significancia estadística.
   */
  padjust: number;
  /**
   * Lista opcional de lotes separada por comas para corrección batch.
   */
  batch: string | null;
  /**
   * Indica si el pipeline debe generar archivo ZIP de resultados.
   */
  generateZip: boolean;
  /**
   * Indica si deben incluirse tablas/gráficos top en la salida.
   */
  top: boolean;
}

/**
 * Representa una fila completa de la tabla `projects`.
 * Se usa en lecturas detalladas de estado de corrida.
 */
export interface ProjectRecord {
  /**
   * Identificador interno del proyecto.
   */
  id_project: number;
  /**
   * Propietario del proyecto (FK a users.id_user).
   */
  user_id: number;
  /**
   * Nombre visible del proyecto.
   */
  name: string;
  /**
   * Descripción opcional proporcionada por el usuario.
   */
  description: string | null;
  /**
   * Estado lógico del proyecto dentro del flujo de análisis.
   */
  status: 'active' | 'inactive' | 'completed';
  /**
   * Ruta relativa del archivo principal del proyecto.
   */
  path: string;
  /**
   * Marca de bloqueo para evitar corridas concurrentes.
   */
  locked_at: Date | null;
  /**
   * Fecha/hora de inicio de ejecución.
   */
  run_started_at: Date | null;
  /**
   * Fecha/hora de finalización de ejecución.
   */
  run_finished_at: Date | null;
  /**
   * Snapshot serializado de parámetros de ejecución.
   */
  run_params_json: string | null;
  /**
   * Ruta relativa a carpeta de resultados.
   */
  result_path: string | null;
  /**
   * Mensaje de error persistido cuando la corrida falla.
   */
  run_error: string | null;
  /**
   * Marca temporal de creación del registro.
   */
  created_at: Date;
  /**
   * Marca temporal de última actualización del registro.
   */
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
  // Inserta metadatos iniciales del proyecto y archivo cargado.
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
    // Consulta mínima para validar duplicado por la llave única (user_id, name).
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
    // Devuelve resumen ordenado por creación para la vista principal del usuario.
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
    // Borra solo si el proyecto pertenece al usuario autenticado.
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
    // Lee estado completo del proyecto para operaciones sensibles (run/delete).
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
    // Bloquea atómicamente: si ya está bloqueado, affectedRows será 0.
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
    // Persiste cierre exitoso y limpia mensaje de error previo.
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
    // Persiste estado fallido sin desbloquear `locked_at` para mantener trazabilidad.
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
