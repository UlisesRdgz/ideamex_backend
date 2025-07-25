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
import { isValidExtension, sanitizeName, ensureDirectory } from '../utils/file';

/**
 * Configuración del almacenamiento de archivos para proyectos.
 * Crea carpetas por usuario y proyecto usando `req.user` y `req.body.projectName`.
 */
export const projectStorage = multer.diskStorage({
  destination: (req: any, file, cb) => {
    const user = req.user;
    const projectName = req.body.projectName;

    if (
      !user ||
      typeof user.username !== 'string' ||
      typeof user.id_user !== 'number' ||
      typeof projectName !== 'string'
    ) {
      return cb(new Error('Missing user or project information'), '');
    }

    const userFolder = `${sanitizeName(user.username)}_${user.id_user}`;
    const projectFolder = sanitizeName(projectName);
    const fullFolder = path.join('projects', userFolder, projectFolder);

    ensureDirectory(fullFolder);
    cb(null, fullFolder);
  },

  filename: (req: any, file, cb) => {
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
  fileFilter: (req, file, cb) => {
    if (!isValidExtension(file.originalname)) {
      return cb(new Error('Invalid file type. Only .csv, .tsv, and .txt are allowed.'));
    }
    cb(null, true);
  },
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB máximo
  },
});
