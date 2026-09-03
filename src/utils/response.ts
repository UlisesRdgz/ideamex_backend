/**
 * @file Utilidades para enviar respuestas estandarizadas en la API.
 * Este archivo contiene funciones para enviar respuestas exitosas y de error
 * con un formato consistente en toda la aplicación.
 * 
 * @module utils/response
 * @requires express
 *
 * @author Ulises Rodríguez García
 */

import { Response } from 'express';

/**
 * Envía una respuesta exitosa al cliente.
 * 
 * @function sendSuccessResponse
 * @param res - Objeto de respuesta de Express.
 * @param message - Mensaje descriptivo de la respuesta.
 * @param data - Datos adicionales para incluir en la respuesta (por defecto `null`).
 * @param statusCode - Código de estado HTTP (por defecto `200`).
 */
export const sendSuccessResponse = (
  res: Response,
  message: string,
  data: unknown = null,
  statusCode = 200
): void => {
  // Envelope de éxito para respuestas JSON de negocio.
  res.status(statusCode).json({
    status: 'success',
    message,
    data,
  });
};

/**
 * Envía una respuesta de error al cliente.
 * 
 * @function sendErrorResponse
 * @param res - Objeto de respuesta de Express.
 * @param message - Mensaje descriptivo del error.
 * @param details - Detalles adicionales sobre el error (puede ser objeto o array).
 * @param statusCode - Código de estado HTTP (por defecto `400`).
 */
export const sendErrorResponse = (
  res: Response,
  message: string,
  details: unknown = null,
  statusCode = 400
): void => {
  res.status(statusCode).json({
    status: 'error',
    message,
    details,
  });
};
