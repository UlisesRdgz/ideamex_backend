/**
 * @file Configuración de la estrategia de Passport con Google OAuth 2.0.
 * 
 * @module config/passportConfig
 * @requires passport
 * @requires passport-google-oauth20
 * @requires ../services/authService
 * 
 * @author Ulises Rodríguez García
 */

import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { findOrCreateUser, findUserById } from '../services/authService';

/**
 * Configura y utiliza la estrategia de autenticación de Google OAuth 2.0 en Passport.
 * 
 * @async
 * @function GoogleStrategy
 * @param {string} clientID - ID del cliente proporcionado por Google.
 * @param {string} clientSecret - Secreto del cliente proporcionado por Google.
 * @param {string} callbackURL - URL de redirección tras la autenticación exitosa.
 * @param {Function} done - Callback para continuar el flujo de autenticación.
 */
passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID || '',
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
            callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback',
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                // Busca o crea al usuario en la base de datos
                const user = await findOrCreateUser({
                    email: profile.emails?.[0]?.value || '',
                    username: profile.displayName,
                    googleId: profile.id,
                });

                return done(null, user);
            } catch (error) {
                return done(error, undefined);
            }
        }
    )
);

/**
 * Serializa la información del usuario para almacenarla en la sesión.
 * 
 * @function serializeUser
 * @param {Object} user - Objeto del usuario autenticado.
 * @param {Function} done - Callback para continuar el flujo de serialización.
 */
passport.serializeUser((user: any, done) => {
    done(null, user.id_user);
});


/**
 * Deserializa el ID del usuario almacenado en la sesión para obtener el objeto completo del usuario.
 * 
 * @async
 * @function deserializeUser
 * @param {number} id - ID del usuario almacenado en la sesión.
 * @param {Function} done - Callback para continuar el flujo de deserialización.
 */
passport.deserializeUser(async (id: number, done) => {
    try {
        const user = await findUserById(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

export default passport;