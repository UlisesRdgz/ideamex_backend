/**
 * @file Utilidad para la generación de tokens.
 * Contiene funciones relacionadas con la creación de tokens únicos.
 * 
 * @module utils/tokenUtils
 * @requires crypto
 * 
 * @author Ulises Rodríguez García
 */
import jwt from 'jsonwebtoken';
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


/**
 * Genera un token JWT para el usuario.
 * 
 * @function generateJwtToken
 * @param {number} userId - ID del usuario.
 * @returns {string} Token JWT firmado.
 */
export const generateJwtToken = (userId: number): string => {
    const secret = process.env.JWT_SECRET || 'defaultsecret';
    const expiresIn = process.env.JWT_EXPIRES_IN || '1h';

    return jwt.sign({ userId }, secret, { expiresIn });
};