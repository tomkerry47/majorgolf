import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url'; // Import fileURLToPath

// Derive __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file at the project root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Import pg Pool AFTER loading env vars
import pg from 'pg';
const { Pool } = pg;

async function getUserIdByUsername(username: string) {
  // Check if DATABASE_URL is loaded
  if (!process.env.DATABASE_URL) {
    console.error('Error: DATABASE_URL environment variable not found. Make sure .env file is loaded correctly.');
    process.exit(1);
  }

  // Initialize a new pool within the script using the loaded DATABASE_URL
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = { query: (text: string, params?: any[]) => pool.query(text, params) }; // Simple client wrapper
  
  try {
    console.log(`Querying database for user ID with username: ${username}`);
    const result = await client.query('SELECT id FROM users WHERE username = $1', [username]);
    
    if (result.rows.length > 0) {
      console.log(`User ID found: ${result.rows[0].id}`);
    } else {
      console.log(`User not found with username: ${username}`);
    }
  } catch (error) {
    console.error('Error querying database:', error);
  } finally {
    // Ensure the pool closes connections after the query
    await pool.end(); 
    console.log('Database pool closed.');
  }
}

// Get username from command line arguments
const usernameArg = process.argv[2];

if (!usernameArg) {
  console.error('Please provide a username as a command line argument.');
  process.exit(1);
}

getUserIdByUsername(usernameArg);
