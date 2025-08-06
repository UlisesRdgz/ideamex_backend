/**
 * @file Extiende el objeto Request de Express para incluir `user`.
 * 
 * @module types/express
 * @requires ../models/User
 * 
 * @author Ulises Rodríguez García
 */

import { User } from '../models/User';

declare global {
  namespace Express {
    interface Request {
      user?: Pick<User, 'id_user' | 'username' | 'email'>;
    }
  }
}

export {};
