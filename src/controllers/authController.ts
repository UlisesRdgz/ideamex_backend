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
 * @author Ulises Rodríguez García
 */

import bcrypt from 'bcrypt';
import dayjs from 'dayjs';
import jwt from 'jsonwebtoken';

import { Request, RequestHandler, Response } from 'express';
import { generateJwtToken, generateRefreshToken, generateToken } from '../utils/tokenUtils';
import { sendActivationEmail, sendPasswordResetEmail } from '../utils/emailUtils';
import { createUser, findUserByToken, activateUserAccount, findUserByEmail, updateUserResetToken, findUserByResetToken, updateUserPassword } from '../services/authService';
import redisClient from '../utils/redisClient';
import { sendErrorResponse, sendSuccessResponse } from '../utils/responseUtils';

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
            sendErrorResponse(res, 'Failed to send activation email', null, 500);
            return;
        }

        sendSuccessResponse(res, 'User registered successfully. Please check your email to activate your account.', {
            id: newUser.id,
            email: newUser.email,
        }, 201);
    } catch (error) {
        if (error instanceof Error) {
            console.error('Error in registerUser:', error.message);
            sendErrorResponse(res, 'Server error', error.message, 500);
        } else {
            console.error('Unexpected error in registerUser:', error);
            sendErrorResponse(res, 'Server error', 'Unexpected error occurred', 500);
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
        sendErrorResponse(res, 'Invalid or missing token', null, 400);
        return;
    }

    try {
        const user = await findUserByToken(token);
        console.log('User found:', user);

        if (!user) {
            sendErrorResponse(res, 'Invalid activation token', null, 404);
            return;
        }

        await activateUserAccount(user.id_user);
        sendSuccessResponse(res, 'Account activated successfully');
    } catch (error) {
        if (error instanceof Error) {
            console.error('Error activating user:', error.message);
            sendErrorResponse(res, 'Server error', error.message, 500);
        } else {
            console.error('Unexpected error activating user:', error);
            sendErrorResponse(res, 'Server error', 'Unexpected error occurred', 500);
        }
    }
};

/**
 * Inicia sesión de un usuario.
 * 
 * @async
 * @function loginUser
 * @param {Request} req - Objeto de solicitud de Express.
 * @param {Response} res - Objeto de respuesta de Express.
 * @returns {Promise<void>} Respuesta con el token JWT si las credenciales son correctas.
 */
export const loginUser = async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body;

    try {
        // Verificar si el usuario existe
        const user = await findUserByEmail(email);
        if (!user) {
            sendErrorResponse(res, 'Invalid email or password', null, 401);
            return;
        }

        // Verificar si la cuenta está activada
        if (user.activation !== 1) {
            sendErrorResponse(res, 'Account not activated. Please check your email to activate your account.', null, 403);
            return;
        }

        // Si el usuario se registró con Google, bloquear el inicio de sesión con contraseña
        if (user.auth_provider === 'google') {
            sendErrorResponse(res, 'This account is registered with Google. Please use Google login.', null, 403);
            return;
        }

        // Verificar la contraseña
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            sendErrorResponse(res, 'Invalid email or password', null, 401);
            return;
        }

        // Genera los tokens
        const accessToken = generateJwtToken(user.id_user, '15m');
        const refreshToken = generateRefreshToken(user.id_user, '1d');

        // Almacena el refresh token en Redis con una expiración de 1 día (24*60*60 segundos)
        await redisClient.set(refreshToken, user.id_user.toString(), {
            EX: 24 * 60 * 60,
        });

        // Configura las cookies HTTP-Only
        res.cookie('accessToken', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 15 * 60 * 1000,
        });
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000,
        });

        sendSuccessResponse(res, 'Login successful', {
            id: user.id_user,
            email: user.email,
            username: user.username,
        });
    } catch (error) {
        console.error('Error during login:', error);
        sendErrorResponse(res, 'Server error', null, 500);
    }
};

/**
 * Cierra la sesión de un usuario eliminando la cookie JWT.
 * 
 * @async
 * @function logoutUser
 * @param {Request} req - Objeto de solicitud de Express.
 * @param {Response} res - Objeto de respuesta de Express.
 * @returns {Promise<void>} Respuesta indicando que la sesión se ha cerrado correctamente.
 */
export const logoutUser = async (req: Request, res: Response): Promise<void> => {
    const refreshToken = req.cookies.refreshToken;
  
    // Elimina el token de Redis si existe
    if (refreshToken) {
        await redisClient.del(refreshToken);
    }
  
    // Limpia las cookies
    res.clearCookie('accessToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
    });
    res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
    });

    sendSuccessResponse(res, 'Logout successful');
};

/**
 * Solicita un restablecimiento de contraseña enviando un token por correo.
 * 
 * @async
 * @function requestPasswordReset
 * @param {Request} req - Objeto de solicitud de Express.
 * @param {Response} res - Objeto de respuesta de Express.
 * @returns {Promise<void>} Respuesta indicando si el token de restablecimiento fue enviado correctamente.
 */
export const requestPasswordReset = async (req: Request, res: Response): Promise<void> => {
    const { email } = req.body;

    try {
        const user = await findUserByEmail(email);
        if (!user) {
            sendErrorResponse(res, 'Email not found', null, 404);
            return;
        }

        // Verificar si la cuenta está activa
        if (user.activation !== 1) {
            sendErrorResponse(res, 'Account not activated. Please activate your account first.', null, 403);
            return;
        }

        // Si el usuario se registró con Google, bloquear el inicio de sesión con contraseña
        if (user.auth_provider === 'google') {
            sendErrorResponse(res, 'This account is registered with Google. Please use Google login.', null, 403);
            return;
        }

        const resetToken = generateToken();
        const tokenExpiration = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

        await updateUserResetToken(user.id_user, resetToken, tokenExpiration);
        await sendPasswordResetEmail(email, resetToken);

        sendSuccessResponse(res, 'Password reset token sent to email');
    } catch (error) {
        console.error('Error requesting password reset:', error);
        sendErrorResponse(res, 'Server error', null, 500);
    }
};

/**
 * Restablece la contraseña usando un token válido.
 * 
 * @async
 * @function resetPassword
 * @param {Request} req - Objeto de solicitud de Express.
 * @param {Response} res - Objeto de respuesta de Express.
 * @returns {Promise<void>} Respuesta indicando si la contraseña fue restablecida correctamente.
 */
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
    const { token, password, confirmPassword } = req.body;

    try {
        // Validar que las contraseñas coincidan
        if (password !== confirmPassword) {
            sendErrorResponse(res, 'Passwords do not match', null, 400);
            return;
        }

        // Validar que la nueva contraseña no esté vacía
        if (!password) {
            sendErrorResponse(res, 'New password is required', null, 400);
            return;
        }

        // Buscar al usuario asociado al token
        const user = await findUserByResetToken(token);
        if (!user || new Date(user.token_expiration) < new Date()) {
            sendErrorResponse(res, 'Invalid or expired token', null, 400);
            return;
        }

        // Verificar si la cuenta está activa
        if (user.activation !== 1) {
            sendErrorResponse(res, 'Account not activated. Please activate your account first.', null, 403);
            return;
        }

        // Cifrar la nueva contraseña
        const hashedPassword = await bcrypt.hash(password, 12);

        // Actualizar la contraseña en la base de datos
        await updateUserPassword(user.id_user, hashedPassword);

        sendSuccessResponse(res, 'Password updated successfully');
    } catch (error) {
        console.error('Error resetting password:', error);
        sendErrorResponse(res, 'Server error', null, 500);
    }
};

/**
 * Controlador para refrescar el token de acceso utilizando un refresh token válido.
 * 
 * @async
 * @function refreshTokenController
 * @param {Request} req - Objeto de solicitud de Express.
 * @param {Response} res - Objeto de respuesta de Express.
 * @returns {Promise<void>} Respuesta con un nuevo token de acceso si el refresh token es válido.
 */
export const refreshTokenController: RequestHandler = async (req: Request, res: Response, next): Promise<void> => {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
        sendErrorResponse(res, 'Refresh token required', null, 401);
        return;
    }

    try {
        const secret = process.env.JWT_REFRESH_SECRET || 'defaultrefreshsecret';
        const decoded = jwt.verify(refreshToken, secret) as { userId: number };

        // Genera un nuevo access token (válido 15 minutos)
        const newAccessToken = generateJwtToken(decoded.userId, '15m');

        // Configura la nueva cookie para el access token
        res.cookie('accessToken', newAccessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 15 * 60 * 1000,
        });

        sendSuccessResponse(res, 'Access token refreshed', { accessToken: newAccessToken });
    } catch (error) {
        sendErrorResponse(res, 'Invalid refresh token', null, 403);
    }
};

/**
 * Callback de autenticación con Google.
 * 
 * @async
 * @function googleAuthCallback
 * @param {Request} req - Objeto de solicitud de Express.
 * @param {Response} res - Objeto de respuesta de Express.
 * @returns {Promise<void>} Respuesta indicando el estado de la autenticación con Google.
 */
export const googleAuthCallback: RequestHandler = async (req: Request, res: Response): Promise<void> => {
    const user = req.user as any;
    if (!user) {
        sendErrorResponse(res, 'User not found in Google callback', null, 401);
        return;
    }

    try {
        // Generar access token (válido 15 minutos) y refresh token (válido 1 día)
        const accessToken = generateJwtToken(user.id_user, '15m');
        const refreshToken = generateRefreshToken(user.id_user, '1d');

        // Almacenar el refresh token en Redis con expiración de 1 día (24*60*60 segundos)
        await redisClient.set(refreshToken, user.id_user.toString(), {
            EX: 24 * 60 * 60,
        });

        // Configurar las cookies HTTP-Only
        res.cookie('accessToken', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 15 * 60 * 1000,
        });
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000,
        });

        // Enviar la respuesta
        sendSuccessResponse(res, 'Login successful', {
            id: user.id_user,
            email: user.email,
            username: user.username,
        });
    } catch (error) {
        console.error('Error in Google auth callback:', error);
        sendErrorResponse(res, 'Server error during Google authentication', null, 500);
    }
};