/**
 * @file Configuración de subida de archivos para proyectos usando multer.
 * Define el almacenamiento en disco con validaciones y estructura por usuario y proyecto.
 * 
 * @module config/multer.ts
 * @requires multer
 * @requires path
 * @requires express
 * @requires ../utils/file
 * 
 * @author Ulises Rodríguez García
 */

import multer from 'multer';
import path from 'path';
import jwt from 'jsonwebtoken';
import { isValidExtension, sanitizeName, ensureDirectory, sanitizeEmailPrefix } from '../utils/file';

/**
 * Configuración del almacenamiento de archivos para proyectos.
 * Crea carpetas por usuario y proyecto usando el token JWT y `req.body.projectName`.
 */
export const projectStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const authHeader = req.header('Authorization');
    const projectName = req.body.projectName;

    if (!authHeader?.startsWith('Bearer ')) {
      return cb(new Error('Missing Bearer token'), '');
    }

    const token = authHeader.split(' ')[1];

    try {
      const secret = process.env.JWT_SECRET || 'defaultsecret';
      const decoded = jwt.verify(token, secret) as jwt.JwtPayload;

      const email = decoded.email;
      if (!email || typeof projectName !== 'string') {
        return cb(new Error('Missing user or projectName'), '');
      }

      const emailPrefix = sanitizeEmailPrefix(email.split('@')[0]);
      const projectFolder = sanitizeName(projectName);

      // Ruta base configurable según entorno (.env)
      const basePath = process.env.PROJECTS_BASE_PATH || path.resolve(__dirname, '../../../projects');
      const fullFolder = path.join(basePath, emailPrefix, projectFolder);

      ensureDirectory(fullFolder);
      cb(null, fullFolder);
    } catch (err) {
      console.error('[MULTER] Error decoding token:', err);
      return cb(new Error('Invalid or expired token'), '');
    }
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
