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

async function checkSelectionRank(userId: number, competitionId: number, golferId: number) {
  // Check if DATABASE_URL is loaded
  if (!process.env.DATABASE_URL) {
    console.error('Error: DATABASE_URL environment variable not found. Make sure .env file is loaded correctly.');
    process.exit(1);
  }

  // Initialize a new pool within the script using the loaded DATABASE_URL
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = { query: (text: string, params?: any[]) => pool.query(text, params) }; // Simple client wrapper
  
  try {
    console.log(`Querying database for selection rank: UserID=${userId}, CompetitionID=${competitionId}, GolferID=${golferId}`);
    const result = await client.query(
      'SELECT "rankAtDeadline" FROM selection_ranks WHERE "userId" = $1 AND "competitionId" = $2 AND "golferId" = $3', 
      [userId, competitionId, golferId]
    );
    
    if (result.rows.length > 0) {
      console.log(`Rank at deadline found: ${result.rows[0].rankAtDeadline}`);
    } else {
      console.log(`Selection rank not found for UserID=${userId}, CompetitionID=${competitionId}, GolferID=${golferId}`);
    }
  } catch (error) {
    console.error('Error querying database:', error);
  } finally {
    // Ensure the pool closes connections after the query
    await pool.end(); 
    console.log('Database pool closed.');
  }
}

// Get arguments from command line
const userIdArg = parseInt(process.argv[2], 10);
const competitionIdArg = parseInt(process.argv[3], 10);
const golferIdArg = parseInt(process.argv[4], 10);

if (isNaN(userIdArg) || isNaN(competitionIdArg) || isNaN(golferIdArg)) {
  console.error('Please provide numeric UserID, CompetitionID, and GolferID as command line arguments.');
  process.exit(1);
}

checkSelectionRank(userIdArg, competitionIdArg, golferIdArg);
