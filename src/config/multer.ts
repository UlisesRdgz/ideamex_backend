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
    const withStatus = (message: string, statusCode: number): Error => {
      const err = new Error(message) as Error & { statusCode?: number };
      err.statusCode = statusCode;
      return err;
    };

    if (!authHeader?.startsWith('Bearer ')) {
      return cb(withStatus('Missing Bearer token', 401), '');
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET || 'defaultsecret';
    let decoded: jwt.JwtPayload;

    try {
      decoded = jwt.verify(token, secret) as jwt.JwtPayload;
    } catch (err) {
      console.error('[MULTER] Invalid token:', err);
      return cb(withStatus('Invalid or expired token', 401), '');
    }

    const email = decoded.email;
    if (!email || typeof projectName !== 'string') {
      return cb(withStatus('Missing user or projectName', 400), '');
    }

    const emailPrefix = sanitizeEmailPrefix(email.split('@')[0]);
    const projectFolder = sanitizeName(projectName);
    const basePath = process.env.PROJECTS_BASE_PATH || path.resolve(process.cwd(), 'projects');
    const fullFolder = path.join(basePath, emailPrefix, projectFolder);

    try {
      ensureDirectory(fullFolder);
      cb(null, fullFolder);
    } catch (err) {
      console.error('[MULTER] Storage path error:', { basePath, fullFolder, err });
      return cb(withStatus('Storage path is not writable. Verify PROJECTS_BASE_PATH permissions.', 500), '');
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
