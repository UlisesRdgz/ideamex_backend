/**
 * @file Archivo principal de la aplicación.
 * Configura el servidor Express, la conexión a la base de datos y las rutas principales.
 * 
 * @module index
 * @requires express
 * @requires dotenv
 * @requires cors
 * @requires helmet
 * @requires morgan
 * @requires ./routes/auth
 * @requires ./config/db
 * 
 * @author Ulises Rodriguez García
 */

import express, { Application, Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import authRoutes from './routes/auth';
import { pool } from './config/db';

// Carga las variables de entorno
dotenv.config();

const app: Application = express();

// Middlewares
app.use(express.json());
app.use(helmet());
app.use(cors());
if (process.env.NODE_ENV !== 'production') {
    app.use(morgan('dev'));
}

// Verifica la conexión a la base de datos
pool.getConnection()
    .then(conn => {
        console.log('Connected to MariaDB!');
        conn.release();
    })
    .catch(err => {
        console.error('Database connection error:', err);
        process.exit(1);
    });

// Rutas
app.use('/api/auth', authRoutes);

/**
 * Ruta principal.
 * @name GET /
 * @function
 * @returns {Object} Mensaje de bienvenida.
 */
app.get('/', (req: Request, res: Response) => {
    res.json({ message: 'Welcome to the IDEAMEX Backend API!' });
});

/**
 * Middleware para manejar errores no controlados.
 * @function
 * @param {Error} err - Error capturado.
 * @param {Request} req - Objeto de solicitud de Express.
 * @param {Response} res - Objeto de respuesta de Express.
 * @param {NextFunction} next - Función para pasar al siguiente middleware.
 * @returns {void}
 */
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('Unhandled Error:', err);
    res.status(500).json({ message: 'Internal Server Error' });
});

// Inicia el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});