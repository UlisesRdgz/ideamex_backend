/**
 * @file Utilidad para la generación de tokens únicos.
 * Se utiliza para activación de cuenta y recuperación de contraseña.
 * 
 * @module utils/token
 * @requires crypto
 * 
 * @author Ulises Rodríguez García
 */

import { randomBytes } from 'crypto';

/**
 * Genera un token aleatorio de 32 bytes en formato hexadecimal.
 */
export const generateToken = (): string => {
  return randomBytes(32).toString('hex');
};
