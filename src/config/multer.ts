/**
 * @file Configuración de subida de archivos para proyectos usando multer.
 * Define el almacenamiento en disco con validaciones y estructura por usuario y proyecto.
 * 
 * @module middlewares/upload.middleware
 * @requires multer
 * @requires path
 * @requires express
 * @requires ../utils/file
 * 
 * @author Ulises Rodríguez García
 */

import multer from 'multer';
import path from 'path';
import { Request } from 'express';
import {
  isValidExtension,
  sanitizeName,
  ensureDirectory,
} from '../utils/file';

/**
 * Configuración del almacenamiento de archivos para proyectos.
 * Crea carpetas por usuario y proyecto, usando headers `x-username`, `x-user-id` y `x-project-name`.
 */
export const projectStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const username = req.headers['x-username'];
    const userId = req.headers['x-user-id'];
    const projectName = req.headers['x-project-name'];

    if (
      typeof username !== 'string' ||
      typeof userId !== 'string' ||
      typeof projectName !== 'string'
    ) {
      return cb(new Error('Missing headers: x-user-id, x-username, or x-project-name'), '');
    }

    const userFolder = `${sanitizeName(username)}_${userId}`;
    const projectFolder = sanitizeName(projectName);
    const fullFolder = path.join('projects', userFolder, projectFolder);

    ensureDirectory(fullFolder);
    cb(null, fullFolder);
  },

  filename: (req, file, cb) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const cleanName = file.originalname.replace(/\s+/g, '_');
    cb(null, `${timestamp}_${cleanName}`);
  },
});

/**
 * Middleware multer para manejar la subida de archivos de proyectos.
 * Valida extensión y tamaño del archivo.
 */
export const uploadProject = multer({
  storage: projectStorage,
  fileFilter: (req: Request, file, cb) => {
    if (!isValidExtension(file.originalname)) {
      return cb(new Error('Invalid file type. Only .csv, .tsv, and .txt are allowed.'));
    }
    cb(null, true);
  },
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB máximo
  },
});
