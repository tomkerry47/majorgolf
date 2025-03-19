// Script to migrate user authentication from Supabase to direct PostgreSQL
import dotenv from 'dotenv';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

dotenv.config();

// Supabase credentials
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// PostgreSQL connection
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Database clients
const db = {
  query: (text, params) => pool.query(text, params)
};

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// JWT Secret for token generation
const JWT_SECRET = process.env.JWT_SECRET || 'your-default-jwt-secret-key';

// Function to hash passwords
async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

// Function to generate JWT token
function generateToken(userId, email, isAdmin = false) {
  return jwt.sign(
    { 
      id: userId.toString(), 
      email, 
      isAdmin,
      database_id: userId // For backward compatibility
    }, 
    JWT_SECRET, 
    { expiresIn: '7d' }
  );
}

// Function to get all users from Supabase auth
async function getSupabaseAuthUsers() {
  try {
    // This requires admin access
    const { data, error } = await supabase.auth.admin.listUsers();
    if (error) throw error;
    return data.users;
  } catch (error) {
    console.error('Error getting Supabase auth users:', error);
    console.log('Falling back to getting users from database table');
    
    // Fallback to getting users from the database table
    const { data, error } = await supabase.from('users').select('*');
    if (error) throw error;
    return data.map(user => ({
      id: user.id.toString(),
      email: user.email,
      user_metadata: {
        username: user.username,
        full_name: user.fullName
      }
    }));
  }
}

// Function to check if a database user exists
async function dbUserExists(email) {
  const result = await db.query('SELECT id FROM users WHERE email = $1', [email]);
  return result.rows.length > 0;
}

// Function to create or update a database user
async function createOrUpdateDbUser(userAuth) {
  const email = userAuth.email;
  const username = userAuth.user_metadata?.username || email.split('@')[0];
  const fullName = userAuth.user_metadata?.full_name || username;
  const isAdmin = userAuth.user_metadata?.is_admin || false;

  // Generate a default password if needed (this is just for testing, users should reset their own passwords)
  const defaultPassword = await hashPassword('password123');
  
  // Check if user exists
  const userExists = await dbUserExists(email);
  
  if (userExists) {
    // Update existing user
    console.log(`Updating existing user: ${email}`);
    await db.query(
      'UPDATE users SET username = $1, "fullName" = $2, "isAdmin" = $3 WHERE email = $4',
      [username, fullName, isAdmin, email]
    );
  } else {
    // Create new user
    console.log(`Creating new user: ${email}`);
    await db.query(
      'INSERT INTO users (email, username, "fullName", password, "isAdmin") VALUES ($1, $2, $3, $4, $5)',
      [email, username, fullName, defaultPassword, isAdmin]
    );
  }
  
  // Return the user record
  const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
  return result.rows[0];
}

// Function to generate the auth token lookup file
async function generateAuthTokenLookup() {
  const usersResult = await db.query('SELECT id, email, "isAdmin" FROM users');
  const users = usersResult.rows;
  
  const tokenLookup = {};
  
  for (const user of users) {
    const token = generateToken(user.id, user.email, user.isAdmin);
    tokenLookup[user.email] = token;
  }
  
  // Output token information
  console.log('\n=== Auth Token Information ===');
  console.log('Tokens have been generated for all users.');
  console.log('Examples for login testing:');
  
  // Show a few examples for testing
  const examples = Object.entries(tokenLookup).slice(0, 3);
  for (const [email, token] of examples) {
    console.log(`\nEmail: ${email}`);
    console.log(`Token: ${token.substring(0, 20)}...`);
  }
  
  return tokenLookup;
}

// Main migration function
async function migrateAuth() {
  try {
    console.log('Starting authentication migration from Supabase to PostgreSQL...');
    
    // Get all Supabase auth users
    const supabaseUsers = await getSupabaseAuthUsers();
    console.log(`Found ${supabaseUsers.length} users in Supabase auth`);
    
    // Process each user
    for (const userAuth of supabaseUsers) {
      try {
        const dbUser = await createOrUpdateDbUser(userAuth);
        console.log(`Processed user: ${dbUser.email} (ID: ${dbUser.id})`);
      } catch (error) {
        console.error(`Error processing user ${userAuth.email}:`, error);
      }
    }
    
    // Generate lookup for auth tokens
    await generateAuthTokenLookup();
    
    console.log('\nAuthentication migration completed successfully!');
  } catch (error) {
    console.error('Authentication migration failed:', error);
  } finally {
    // Close database connection
    await pool.end();
    process.exit(0);
  }
}

// Run the migration
migrateAuth();