import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const { Pool } = pg;

// Initialize PostgreSQL client
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Create a simple direct query client
export const pgClient = {
  query: (text: string, params?: any[]) => pool.query(text, params)
};

// Export Drizzle ORM instance
export const db = drizzle(pool);

// JWT secret for token generation
const JWT_SECRET = process.env.JWT_SECRET || 'your-default-jwt-secret-key';

// Token generation for authentication
export const generateToken = (userId: number, email: string, isAdmin: boolean) => {
  return jwt.sign(
    { 
      id: userId, 
      email, 
      isAdmin,
      database_id: userId // For backward compatibility
    }, 
    JWT_SECRET, 
    { expiresIn: '7d' }
  );
};

// Token verification
export const verifyToken = (token: string) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

// Password utilities
export const hashPassword = async (password: string) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

export const comparePassword = async (password: string, hashedPassword: string) => {
  return bcrypt.compare(password, hashedPassword);
};

// No need for Supabase compatibility layer anymore - the transition is complete
// All operations now directly use PostgreSQL

console.log('PostgreSQL direct connection initialized');