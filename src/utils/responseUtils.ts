/**
 * @file Utilidades para enviar respuestas estandarizadas en la API.
 * Este archivo contiene funciones para enviar respuestas exitosas y de error
 * con un formato consistente en toda la aplicación.
 * 
 * @module utils/responseUtils
 * @requires express
 * 
 * @author Ulises Rodríguez García
 */
import { Response } from 'express';

/**
 * Envía una respuesta exitosa al cliente.
 * 
 * @param res Objeto de respuesta de Express.
 * @param message Mensaje descriptivo de la respuesta.
 * @param data Datos adicionales para incluir en la respuesta.
 * @param statusCode Código de estado HTTP (por defecto 200).
 */
export const sendSuccessResponse = (
    res: Response,
    message: string,
    data: any = null,
    statusCode: number = 200
): void => {
    res.status(statusCode).json({
        status: 'success',
        message,
        data,
    });
};

/**
 * Envía una respuesta de error al cliente.
 * 
 * @param res Objeto de respuesta de Express.
 * @param message Mensaje descriptivo del error.
 * @param details Detalles adicionales sobre el error (por defecto null).
 * @param statusCode Código de estado HTTP (por defecto 400).
 */
export const sendErrorResponse = (
    res: Response,
    message: string,
    details: any = null,
    statusCode: number = 400
): void => {
    res.status(statusCode).json({
        status: 'error',
        message,
        details,
    });
};