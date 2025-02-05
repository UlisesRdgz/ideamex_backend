/**
 * @file Configuración de la conexión al servidor Redis.
 * Utiliza variables de entorno para los parámetros de conexión.
 * 
 * @module utils/redisClient
 * @requires redis
 * @requires dotenv
 * 
 * @author Ulises Rodríguez García
 */

import { createClient } from 'redis';
import dotenv from 'dotenv';

// Carga las variables de entorno desde el archivo .env
dotenv.config();

/**
 * Cliente de Redis para gestionar la caché y almacenamiento en memoria.
 * Permite la conexión a un servidor Redis local o remoto.
 */
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

redisClient.on('error', (err) => {
  console.error('Redis Client Error', err);
});

redisClient.connect().then(() => {
  console.log('Connected to Redis');
}).catch(err => {
  console.error('Redis connection error', err);
});

export default redisClient;