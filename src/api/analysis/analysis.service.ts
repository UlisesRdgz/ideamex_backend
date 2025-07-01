/**
 * @file Servicio de análisis.
 * Maneja operaciones de guardado de proyectos en la base de datos.
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
