/**
 * @file Utilidad para la generación de tokens.
 * Contiene funciones relacionadas con la creación de tokens únicos.
 * 
 * @module utils/tokenUtils
 * @requires crypto
 * 
 * @author Ulises Rodríguez García
 */
import jwt, { SignOptions }  from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { StringValue } from 'ms';

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
 * @param {StringValue | number} [expiresIn='15m'] - Tiempo de expiración del token JWT.
 * @returns {string} Token JWT firmado.
 */
export const generateJwtToken = (userId: number, expiresIn: StringValue | number = '15m'): string => {
    const secret = process.env.JWT_SECRET || 'defaultsecret';
    const options: SignOptions = { expiresIn };
    return jwt.sign({ userId }, secret, options);
};

/**
 * Genera un refresh token JWT para el usuario.
 * 
 * @function generateRefreshToken
 * @param {number} userId - ID del usuario.
 * @param {StringValue | number} [expiresIn='1d'] - Tiempo de expiración del refresh token.
 * @returns {string} Refresh token JWT firmado.
 */
export const generateRefreshToken = (userId: number, expiresIn: StringValue | number = '1d'): string => {
    const secret = process.env.JWT_REFRESH_SECRET || 'defaultrefreshsecret';
    const options: SignOptions = { expiresIn };
    return jwt.sign({ userId }, secret, options);
};