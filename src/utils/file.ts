/**
 * @file Funciones auxiliares para validación y sanitización de archivos.
 * Incluye lógica para extensiones, rutas y nombres seguros para almacenamiento de proyectos.
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
 * Sanitiza cualquier nombre (usuario o proyecto) para uso seguro en sistema de archivos.
 * 
 * @param name - Nombre a limpiar.
 * @returns Nombre convertido a slug.
 */
export const sanitizeName = (name: string): string => {
  return slugify(name, {
    lower: true,
    strict: true,
    locale: 'es',
  });
};

/**
 * Sanitiza correos para usarlos como nombres de carpeta, permitiendo puntos.
 */
export const sanitizeEmailPrefix = (email: string): string => {
  const prefix = email.split('@')[0];
  return prefix.replace(/[^a-zA-Z0-9._-]/g, '');
};

/**
 * Asegura que el directorio de destino exista.
 * 
 * @param dir - Ruta absoluta del directorio.
 */
export const ensureDirectory = (dir: string): void => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

/**
 * Construye una ruta relativa y absoluta para guardar un archivo de proyecto.
 * 
 * @param username - Nombre del usuario (sin sanitizar).
 * @param userId - ID numérico del usuario.
 * @param projectName - Nombre del proyecto (sin sanitizar).
 * @param filename - Nombre original del archivo subido.
 * @returns Objeto con ruta relativa y absoluta del archivo.
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
