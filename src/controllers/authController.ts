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
            res.status(401).json({ message: 'Invalid email or password' });
            return;
        }

        // Verificar si la cuenta está activada
        if (user.activation !== 1) {
            res.status(403).json({ message: 'Account not activated. Please check your email to activate your account.' });
            return;
        }

        // Si el usuario se registró con Google, bloquear el inicio de sesión con contraseña
        if (user.auth_provider === 'google') {
            res.status(403).json({
                message: 'This account is registered with Google. Please use Google login.',
            });
            return;
        }

        // Verificar la contraseña
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            res.status(401).json({ message: 'Invalid email or password' });
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
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
  
        res.status(200).json({
            message: 'Login successful',
            user: {
            id: user.id_user,
            email: user.email,
            username: user.username,
            },
        });
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ message: 'Server error' });
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
  
    res.status(200).json({ message: 'Logout successful' });
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
            res.status(404).json({ message: 'Email not found' });
            return;
        }

        // Verificar si la cuenta está activa
        if (user.activation !== 1) {
            res.status(403).json({ message: 'Account not activated. Please activate your account first.' });
            return;
        }

        // Si el usuario se registró con Google, bloquear el inicio de sesión con contraseña
        if (user.auth_provider === 'google') {
            res.status(403).json({
                message: 'This account is registered with Google. Please use Google login.',
            });
            return;
        }

        const resetToken = generateToken();
        const tokenExpiration = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

        await updateUserResetToken(user.id_user, resetToken, tokenExpiration);
        await sendPasswordResetEmail(email, resetToken);

        res.status(200).json({ message: 'Password reset token sent to email' });
    } catch (error) {
        console.error('Error requesting password reset:', error);
        res.status(500).json({ message: 'Server error' });
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
            res.status(400).json({ message: 'Passwords do not match' });
            return;
        }

        // Validar que la nueva contraseña no esté vacía
        if (!password) {
            res.status(400).json({ message: 'New password is required' });
            return;
        }

        // Buscar al usuario asociado al token
        const user = await findUserByResetToken(token);
        if (!user || new Date(user.token_expiration) < new Date()) {
            res.status(400).json({ message: 'Invalid or expired token' });
            return;
        }

        // Verificar si la cuenta está activa
        if (user.activation !== 1) {
            res.status(403).json({ message: 'Account not activated. Please activate your account first.' });
            return;
        }

        // Cifrar la nueva contraseña
        const hashedPassword = await bcrypt.hash(password, 12);

        // Actualizar la contraseña en la base de datos
        await updateUserPassword(user.id_user, hashedPassword);

        res.status(200).json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('Error resetting password:', error);
        res.status(500).json({ message: 'Server error' });
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
      res.status(401).json({ message: 'Refresh token required' });
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
  
      res.status(200).json({ message: 'Access token refreshed', accessToken: newAccessToken });
      return;
    } catch (error) {
      res.status(403).json({ message: 'Invalid refresh token' });
      return;
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
      res.status(401).json({ message: 'User not found in Google callback' });
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
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
  
      // Enviar la respuesta
      res.status(200).json({
        message: 'Login successful',
        user: {
          id: user.id_user,
          email: user.email,
          username: user.username,
        },
      });
    } catch (error) {
      console.error('Error in Google auth callback:', error);
      res.status(500).json({ message: 'Server error during Google authentication' });
    }
};