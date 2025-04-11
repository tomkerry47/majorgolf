import 'dotenv/config'; // Load .env file variables
import { db, pool } from '../server/db'; // Import db instance and pool
import { selections } from '../shared/schema'; // Import selections table schema
import { eq, and } from 'drizzle-orm'; // Import Drizzle operators

async function checkSpecificUserSelection(userId: number, competitionId: number) {
  console.log(`Querying selections table for userId: ${userId}, competitionId: ${competitionId}`);
  try {
    const result = await db
      .select() // Select all columns for the specific selection
      .from(selections)
      .where(and(eq(selections.userId, userId), eq(selections.competitionId, competitionId)))
      .limit(1); // Expecting only one entry per user/competition

    if (result.length === 0) {
      console.log(`No selection entry found for userId: ${userId}, competitionId: ${competitionId}`);
    } else {
      console.log(`Selection entry found:`);
      // Display the single result in a table format
      console.table(result); 
    }
  } catch (error) {
    console.error('Error querying selections table:', error);
  } finally {
    await pool.end(); // Close the pool after the query
    console.log('Database pool closed.');
  }
}

// Get userId and competitionId from command line arguments
const userIdArg = process.argv[2];
const competitionIdArg = process.argv[3];

if (!userIdArg || !competitionIdArg) {
  console.error('Usage: tsx scripts/check_selections.ts <userId> <competitionId>');
  process.exit(1);
}

const userId = parseInt(userIdArg, 10);
const competitionId = parseInt(competitionIdArg, 10);

if (isNaN(userId) || isNaN(competitionId)) {
  console.error('Invalid userId or competitionId. Both must be numbers.');
  process.exit(1);
}

checkSpecificUserSelection(userId, competitionId);
