/**
 * @file Modelo tipado para la entidad contact_requests en la base de datos.
 * Define la estructura de una solicitud de contacto enviada por un usuario.
 * 
 * @module models/ContactRequest
 * 
 * @author Ulises Rodríguez García
 */

export interface ContactRequest {
  /**
   * Identificador único de la solicitud.
   */
  id_contact_request: number;

  /**
   * Nombre completo de quien envía la solicitud.
   */
  full_name: string;

  /**
   * Correo electrónico del remitente.
   */
  email: string;

  /**
   * Número telefónico de contacto.
   */
  phone: string;

  /**
   * Asunto del mensaje.
   */
  subject: string;

  /**
   * Cuerpo del mensaje o consulta.
   */
  message: string;

  /**
   * Fecha de creación de la solicitud (automáticamente generada).
   */
  created_at: Date;
}
