/**
 * @file Funciones auxiliares para validación y sanitización de archivos.
 * Incluye lógica para extensiones, rutas y nombres seguros.
 * 
 * @module utils/file
 * 
 * @author Ulises Rodríguez García
 */

import path from 'path';
import fs from 'fs';
import slugify from 'slugify';

/**
 * Extensiones de archivo válidas para análisis IDEAMEX.
 */
const allowedExtensions = ['.csv', '.tsv', '.txt'];

/**
 * Verifica que la extensión del archivo sea válida.
 * 
 * @param filename - Nombre original del archivo.
 * @returns True si es válida, false si no.
 */
export const isValidExtension = (filename: string): boolean => {
  const ext = path.extname(filename).toLowerCase();
  return allowedExtensions.includes(ext);
};

/**
 * Sanitiza cualquier nombre (usuario o proyecto) para uso en sistema de archivos.
 * 
 * @param name - Nombre a limpiar.
 * @returns Nombre en formato slug seguro.
 */
export const sanitizeName = (name: string): string => {
  return slugify(name, {
    lower: true,
    strict: true,
    locale: 'es',
  });
};

/**
 * Asegura que un directorio exista (lo crea si no).
 * 
 * @param dir - Ruta absoluta del directorio.
 */
export const ensureDirectory = (dir: string): void => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

/**
 * Devuelve la ruta de almacenamiento para un archivo de proyecto.
 * 
 * @param username - Nombre del usuario (sin sanitizar).
 * @param userId - ID del usuario.
 * @param projectName - Nombre del proyecto (sin sanitizar).
 * @param filename - Nombre original del archivo.
 * @returns Rutas relativa y absoluta del archivo.
 */
export const buildProjectPath = (
  username: string,
  userId: number,
  projectName: string,
  filename: string
): { relativePath: string; fullPath: string } => {
  const safeUsername = sanitizeName(username);
  const safeProject = sanitizeName(projectName);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeFilename = `${timestamp}_${filename}`;
  const userFolder = `${safeUsername}_${userId}`;
  const relativePath = path.join('projects', userFolder, safeProject, safeFilename);
  const fullPath = path.resolve(relativePath);
  return { relativePath, fullPath };
};
