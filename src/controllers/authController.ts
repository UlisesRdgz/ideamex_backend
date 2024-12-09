/**
 * @file Controlador de autenticación.
 * Contiene funciones para registro y activación de usuarios.
 * 
 * @module controllers/authController
 * @requires bcrypt
 * @requires dayjs
 * @requires express
 * @requires ../utils/tokenUtils
 * @requires ../utils/emailUtils
 * @requires ../services/authService
 * 
 * @author Ulises Rodriguez García
 */

import bcrypt from 'bcrypt';
import dayjs from 'dayjs';

import { Request, Response } from 'express';
import { generateToken } from '../utils/tokenUtils';
import { sendActivationEmail } from '../utils/emailUtils';
import { createUser, findUserByToken, activateUserAccount } from '../services/authService';

/**
 * Registra un nuevo usuario en el sistema.
 * Genera un token de activación y envía un correo al usuario.
 * 
 * @async
 * @function registerUser
 * @param {Request} req - Objeto de solicitud de Express.
 * @param {Response} res - Objeto de respuesta de Express.
 * @returns {Promise<void>} Respuesta con el estado del registro.
 */
export const registerUser = async (req: Request, res: Response): Promise<void> => {
    const { email, username, password } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 12);

        const activationToken = generateToken(); 
        const tokenExpiration = dayjs().add(24, 'hour').toDate(); 

        const newUser = await createUser({
            email,
            username,
            password: hashedPassword,
            activation: 0,
            token: activationToken,
            token_expiration: tokenExpiration,
        });

        try {
            await sendActivationEmail(email, activationToken);
        } catch (emailError) {
            console.error('Error sending email:', emailError);
            res.status(500).json({ message: 'Failed to send activation email' });
            return;
        }

        res.status(201).json({
            message: 'User registered successfully. Please check your email to activate your account.',
            user: { id: newUser.id, email: newUser.email },
        });
    } catch (error) {
        if (error instanceof Error) {
            console.error('Error in registerUser:', error.message);
            res.status(500).json({ message: 'Server error', error: error.message });
        } else {
            console.error('Unexpected error in registerUser:', error);
            res.status(500).json({ message: 'Server error', error: 'Unexpected error occurred' });
        }
    }
};

/**
 * Activa una cuenta de usuario basada en un token de activación.
 * 
 * @async
 * @function activateUser
 * @param {Request} req - Objeto de solicitud de Express.
 * @param {Response} res - Objeto de respuesta de Express.
 * @returns {Promise<void>} Respuesta con el estado de la activación.
 */
export const activateUser = async (req: Request, res: Response): Promise<void> => {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
        res.status(400).json({ message: 'Invalid or missing token' });
        return;
    }

    try {
        const user = await findUserByToken(token);
        console.log('User found:', user);

        if (!user) {
            res.status(404).json({ message: 'Invalid activation token' });
            return;
        }

        await activateUserAccount(user.id_user);

        res.status(200).json({ message: 'Account activated successfully' });
    } catch (error) {
        if (error instanceof Error) {
            console.error('Error activating user:', error.message);
            res.status(500).json({ message: 'Server error', error: error.message });
        } else {
            console.error('Unexpected error activating user:', error);
            res.status(500).json({ message: 'Server error', error: 'Unexpected error occurred' });
        }
    }
};