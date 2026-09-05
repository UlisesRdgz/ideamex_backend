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
 * Carpeta de tránsito donde aterrizan las subidas antes de validarse.
 *
 * @function getUploadStagingPath
 */
export const getUploadStagingPath = (): string => {
  const basePath = process.env.PROJECTS_BASE_PATH || path.resolve(process.cwd(), 'projects');
  return path.join(basePath, '.uploads');
};

/**
 * Configuración del almacenamiento de archivos para proyectos.
 *
 * El archivo se escribe en una carpeta de tránsito, no en la del proyecto. El
 * controlador lo valida y solo entonces lo traslada a su ubicación definitiva.
 *
 * Se hace así por dos motivos. El primero es que la carpeta del proyecto se
 * construye a partir del título, y en una petición multiparte los campos de
 * texto solo están disponibles si el cliente los envió antes del archivo:
 * depender de ello hacía que la carga fallara según el orden de los campos.
 * El segundo es que un archivo rechazado por la validación no debe quedar en el
 * árbol de proyectos ni por un instante.
 */
export const projectStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const authHeader = req.header('Authorization');
    const withStatus = (message: string, statusCode: number): Error => {
      const err = new Error(message) as Error & { statusCode?: number };
      err.statusCode = statusCode;
      return err;
    };

    if (!authHeader?.startsWith('Bearer ')) {
      return cb(withStatus('Missing Bearer token', 401), '');
    }

    const token = authHeader.split(' ')[1];

    try {
      // `appConfig.jwtSecret` está garantizada por `checkRequiredConfig` al arranque.
      jwt.verify(token, appConfig.jwtSecret);
    } catch (err) {
      console.error('[MULTER] Invalid token:', err);
      return cb(withStatus('Invalid or expired token', 401), '');
    }

    const stagingPath = getUploadStagingPath();

    try {
      ensureDirectory(stagingPath);
      cb(null, stagingPath);
    } catch (err) {
      console.error('[MULTER] Storage path error:', { stagingPath, err });
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
