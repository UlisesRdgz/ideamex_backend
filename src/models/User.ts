/**
 * @file Modelo de datos del usuario.
 * Representa la estructura de la tabla `users` en la base de datos MariaDB.
 * 
 * @module models/User
 * 
 * @author Ulises Rodríguez García
 */

export interface User {
  /**
   * Identificador único del usuario (clave primaria).
   */
  id_user: number;

  /**
   * Correo electrónico único del usuario.
   */
  email: string;

  /**
   * Nombre de usuario.
   */
  username: string;

  /**
   * Contraseña cifrada (puede ser null para usuarios de Google).
   */
  password: string | null;

  /**
   * Indica si la cuenta está activada (1) o no (0).
   */
  activation: 0 | 1;

  /**
   * Token de activación o restablecimiento (puede ser null).
   */
  token: string | null;

  /**
   * Fecha de expiración del token (si aplica).
   */
  token_expiration: Date | null;

  /**
   * Flag que indica si hay una solicitud de recuperación de contraseña.
   */
  password_request: 0 | 1;

  /**
   * Fecha y hora de la última sesión iniciada (puede ser null).
   */
  last_session: Date | null;

  /**
   * Fecha de creación del registro.
   */
  created_at: Date;

  /**
   * Fecha de última actualización del registro.
   */
  updated_at: Date;

  /**
   * ID de Google (si aplica).
   */
  google_id: string | null;

  /**
   * Proveedor de autenticación: `local` o `google`.
   */
  auth_provider: 'local' | 'google';
}
