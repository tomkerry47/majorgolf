import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { sql, count, eq, notInArray } from 'drizzle-orm'; // Import sql, count, eq, and notInArray
import * as schema from '../shared/schema'; // Import schema definitions

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Start the server from the project root or provide the environment variable explicitly.");
}

// Initialize PostgreSQL client using only the connection string
// Ensure DATABASE_URL in .env is correctly formatted: 
// postgresql://user:password@host:port/database_name
const pool = new Pool({
  connectionString: process.env.DATABASE_URL 
});


// Create a simple direct query client
export const pgClient = {
  query: (text: string, params?: any[]) => pool.query(text, params)
};

// Export Drizzle ORM instance, explicitly providing the schema
export const db = drizzle(pool, { schema }); // Pass schema here

// Export the pool itself for connection management in scripts
export { pool };

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

// Function to get the count of selections for each competition
export async function getCompetitionSelectionCounts() {
  return db
    .select({
      competitionId: schema.selections.competitionId,
      count: count(schema.selections.userId),
    })
    .from(schema.selections)
    .groupBy(schema.selections.competitionId);
}

// Function to get the total number of users
export async function getTotalUsersCount() {
  const result = await db.select({ count: count() }).from(schema.users);
  return result[0].count;
}

// Function to get users who haven't made selections for a competition
export async function getUsersWithoutSelections(competitionId: number) {
  const usersWithSelections = db
    .select({ userId: schema.selections.userId })
    .from(schema.selections)
    .where(eq(schema.selections.competitionId, competitionId));

  return db
    .select({ id: schema.users.id, fullName: schema.users.fullName })
    .from(schema.users)
    .where(notInArray(schema.users.id, usersWithSelections));
}

console.log('PostgreSQL direct connection initialized');
