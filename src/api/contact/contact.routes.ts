/**
 * @file Rutas de contacto.
 * Define la ruta POST para recibir solicitudes de contacto con validación.
 * 
 * @module api/contact/contact.routes
 * @requires express
 * @requires ./contact.controller
 * @requires ../../middlewares/validation.middleware
 * 
 * @author Ulises Rodríguez García
 */

import { Router } from 'express';
import { submitContactForm } from './contact.controller';
import { validateContactForm, validateRequest } from '../../middlewares/validation.middleware';

const router = Router();

/**
 * @route POST /contact
 * @desc Envía una solicitud de contacto validada
 * @access Público
 */
router.post('/', validateContactForm, validateRequest, submitContactForm);

export default router;
