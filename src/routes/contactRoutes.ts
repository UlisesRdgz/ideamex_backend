/**
 * @file Rutas de contacto.
 * Define las rutas relacionadas con el formulario de contacto, incluyendo validaciones 
 * y la comunicación con el controlador.
 * 
 * @module routes/contactRoutes
 * @requires express
 * @requires ../controllers/contactController
 * @requires ../middlewares/validationMiddleware
 * 
 * @author Ulises Rodríguez García
 */
import { Router } from 'express';
import { submitContactForm } from '../controllers/contactController';
import { validateContactForm, validateRequest } from '../middlewares/validationMiddleware';

const router = Router();

/**
 * Envía una solicitud de contacto.
 * 
 * @name POST /contact
 * @function
 * @middleware {validateContactForm} Valida los datos del formulario de contacto.
 * @middleware {validateRequest} Maneja errores de validación.
 * @controller {submitContactForm} Controlador para enviar la solicitud de contacto.
 */
router.post('', validateContactForm, validateRequest, submitContactForm);

export default router;