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
import { appConfig } from './appConfig';

/**
 * Configuración del almacenamiento de archivos para proyectos.
 * Crea carpetas por usuario y proyecto usando el token JWT y `req.body.title`.
 */
export const projectStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const authHeader = req.header('Authorization');
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const withStatus = (message: string, statusCode: number): Error => {
      const err = new Error(message) as Error & { statusCode?: number };
      err.statusCode = statusCode;
      return err;
    };

    if (!authHeader?.startsWith('Bearer ')) {
      return cb(withStatus('Missing Bearer token', 401), '');
    }

    const token = authHeader.split(' ')[1];
    let decoded: jwt.JwtPayload;

    try {
      // `appConfig.jwtSecret` está garantizada por `checkRequiredConfig` al arranque.
      decoded = jwt.verify(token, appConfig.jwtSecret) as jwt.JwtPayload;
    } catch (err) {
      console.error('[MULTER] Invalid token:', err);
      return cb(withStatus('Invalid or expired token', 401), '');
    }

    const email = decoded.email;
    if (!email || !title) {
      return cb(withStatus('Missing user or title', 400), '');
    }

    // Reproduce la misma sanitización usada por controladores para evitar rutas inconsistentes.
    const emailPrefix = sanitizeEmailPrefix(email.split('@')[0]);
    const projectFolder = sanitizeName(title);
    const basePath = process.env.PROJECTS_BASE_PATH || path.resolve(process.cwd(), 'projects');
    const fullFolder = path.join(basePath, emailPrefix, projectFolder);

    try {
      // Crea recursivamente la carpeta de destino si no existe.
      ensureDirectory(fullFolder);
      cb(null, fullFolder);
    } catch (err) {
      console.error('[MULTER] Storage path error:', { basePath, fullFolder, err });
      return cb(withStatus('Storage path is not writable. Verify PROJECTS_BASE_PATH permissions.', 500), '');
    }
  },

  filename: (req, file, cb) => {
    // Prefijo temporal para evitar colisiones de nombres en subidas concurrentes.
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
    // Solo se aceptan extensiones soportadas por el pipeline de análisis.
    if (!isValidExtension(file.originalname)) {
      return cb(new Error('Invalid file type. Only .csv, .tsv, and .txt are allowed.'));
    }
    cb(null, true);
  },
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB máximo
  },
});
