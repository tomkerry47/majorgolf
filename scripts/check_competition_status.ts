import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url'; 
import pg from 'pg'; // Import pg AFTER dotenv

// 1. Derive __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 2. Load .env file (assuming it's in the project root, one level up from scripts/)
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// 3. Check if DATABASE_URL is loaded
if (!process.env.DATABASE_URL) {
  console.error('Error: DATABASE_URL environment variable not found. Make sure .env file exists and is loaded correctly.');
  process.exit(1);
}

// 4. Initialize a NEW Pool instance here
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = { query: (text: string, params?: any[]) => pool.query(text, params) }; 

// 5. Main script logic
async function checkCompetitionStatus() {
  const competitionId = 1; // ID for The Masters
  try {
    console.log(`Connecting to database to check status for competition ID: ${competitionId}...`);
    const result = await client.query(
      'SELECT "startDate", "endDate", "isActive", "isComplete" FROM competitions WHERE id = $1', 
      [competitionId]
    ); 
    
    if (result.rows.length > 0) {
      console.log(`Competition ID ${competitionId} details:`, result.rows[0]);
    } else {
      console.log(`Competition ID ${competitionId} not found in the database.`);
    }

  } catch (error) {
    console.error('Error executing query:', error);
  } finally {
    // 6. Close the pool
    await pool.end(); 
    console.log('Database pool closed.');
  }
}

checkCompetitionStatus();
