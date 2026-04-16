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
import {
  ProjectRecord,
  type Project,
  type ProjectRow,
  type ProjectStatus,
} from '../../models/Project';
import { mapProjectRowToRecord } from '../../models/ProjectMapper';

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
 * Campos opcionales que se aceptan al crear un proyecto.
 * La configuración de análisis se deja en `NULL` hasta ejecutar `run`.
 */
export interface ProjectJsonPayload {
  imageUrl?: string;
}

/**
 * Snapshot de configuración de corrida.
 * Se persiste al iniciar `run` para reflejar exactamente lo ejecutado.
 */
export interface ProjectRunConfigPayload {
  samples: unknown[];
  selectedMethods: Record<string, unknown>;
  comparisons: unknown[];
  parameters: Record<string, unknown>;
}

/**
 * Guarda un nuevo proyecto en la base de datos.
 *
 * @async
 * @function createProject
 * @param id_user - ID del usuario propietario del proyecto.
 * @param title - Título del proyecto.
 * @param description - Descripción opcional del proyecto.
 * @param status - Estado interno del proyecto (`ProjectStatusEnum`).
 * @param path - Ruta del archivo almacenado.
 * @returns ID del nuevo proyecto creado.
 */
export const createProject = async (
  id_user: number,
  title: string,
  description: string | null,
  status: ProjectStatus,
  path: string,
  payload: ProjectJsonPayload
): Promise<number> => {
  const query = `
    INSERT INTO projects (
      user_id,
      title,
      description,
      status,
      path,
      image_url,
      samples_json,
      selected_methods_json,
      comparisons_json,
      parameters_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    id_user,
    title,
    description,
    status,
    path,
    payload.imageUrl || null,
    null,
    null,
    null,
    null,
  ];

  const conn = await pool.getConnection();
  try {
    const result = await conn.query(query, values);
    return result.insertId;
  } finally {
    conn.release();
  }
};

/**
 * Verifica si un proyecto con el mismo título ya existe para el usuario.
 */
export const projectExists = async (id_user: number, title: string): Promise<boolean> => {
  const conn = await pool.getConnection();
  try {
    const [row]: any = await conn.query(
      'SELECT 1 FROM projects WHERE user_id = ? AND title = ? LIMIT 1',
      [id_user, title]
    );
    return !!row;
  } finally {
    conn.release();
  }
};

/**
 * Obtiene todos los proyectos de un usuario.
 */
export const getProjectsByUser = async (id_user: number): Promise<Project[]> => {
  const query = `
    SELECT
      id_project,
      user_id,
      title,
      description,
      status,
      path,
      image_url,
      samples_json,
      selected_methods_json,
      comparisons_json,
      parameters_json,
      created_at,
      updated_at
    FROM projects
    WHERE user_id = ?
    ORDER BY created_at DESC
  `;

  const conn = await pool.getConnection();
  try {
    const rows = await conn.query(query, [id_user]);
    return rows.map((row: any) => mapProjectRowToRecord(row as ProjectRow).toProject());
  } finally {
    conn.release();
  }
};

/**
 * Elimina un proyecto de la base de datos.
 */
export const deleteProjectById = async (id_project: number, id_user: number): Promise<void> => {
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
        title,
        description,
        status,
        path,
        image_url,
        samples_json,
        selected_methods_json,
        comparisons_json,
        parameters_json,
        created_at,
        updated_at
      FROM projects
      WHERE id_project = ? AND user_id = ?
      LIMIT 1
      `,
      [id_project, id_user]
    );

    return rows[0] ? mapProjectRowToRecord(rows[0] as ProjectRow) : null;
  } finally {
    conn.release();
  }
};

/**
 * Persiste configuración de corrida y bloquea proyecto en una sola operación atómica.
 * Regresa false si el proyecto ya no está en `PENDING`.
 */
export const lockProjectForRun = async (
  id_project: number,
  id_user: number,
  payload: ProjectRunConfigPayload
): Promise<boolean> => {
  const conn = await pool.getConnection();
  try {
    const result = await conn.query(
      `
      UPDATE projects
      SET
        samples_json = ?,
        selected_methods_json = ?,
        comparisons_json = ?,
        parameters_json = ?,
        status = 'PROCESSING',
        updated_at = NOW()
      WHERE id_project = ? AND user_id = ? AND status = 'PENDING'
      `,
      [
        JSON.stringify(payload.samples),
        JSON.stringify(payload.selectedMethods),
        JSON.stringify(payload.comparisons),
        JSON.stringify(payload.parameters),
        id_project,
        id_user,
      ]
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
  imageUrl: string | null
): Promise<void> => {
  const conn = await pool.getConnection();
  try {
    await conn.query(
      `
      UPDATE projects
      SET
        status = 'COMPLETED',
        image_url = COALESCE(?, image_url),
        updated_at = NOW()
      WHERE id_project = ? AND user_id = ?
      `,
      [imageUrl, id_project, id_user]
    );
  } finally {
    conn.release();
  }
};

/**
 * Marca un proyecto como análisis fallido.
 */
export const markProjectRunFailed = async (
  id_project: number,
  id_user: number
): Promise<void> => {
  const conn = await pool.getConnection();
  try {
    await conn.query(
      `
      UPDATE projects
      SET
        status = 'FAILED',
        updated_at = NOW()
      WHERE id_project = ? AND user_id = ?
      `,
      [id_project, id_user]
    );
  } finally {
    conn.release();
  }
};
