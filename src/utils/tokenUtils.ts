/**
 * @file Utilidad para la generación de tokens.
 * Contiene funciones relacionadas con la creación de tokens únicos.
 * 
 * @module utils/tokenUtils
 * @requires crypto
 * 
 * @author Ulises Rodriguez García
 */
import { randomBytes } from 'crypto';

/**
 * Genera un token único en formato hexadecimal.
 * 
 * @function generateToken
 * @returns {string} Token generado de 32 bytes en formato hexadecimal.
 */
export const generateToken = (): string => {
    return randomBytes(32).toString('hex');
};