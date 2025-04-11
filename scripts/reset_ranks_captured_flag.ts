import 'dotenv/config';
import { Pool, PoolClient } from 'pg';
import readline from 'readline';

// Assume pool is configured similarly to other scripts
// Adjust the import path based on your project structure
import { pool } from '../server/db'; // Adjust path if needed

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function resetRanksCapturedFlag(competitionIdInput: string) {
  let client: PoolClient | null = null;
  const competitionId = parseInt(competitionIdInput, 10);

  if (isNaN(competitionId)) {
      console.error(`Error: Invalid Competition ID provided: "${competitionIdInput}". Please provide a number.`);
      process.exit(1);
  }

  try {
    client = await pool.connect();
    console.log(`Attempting to reset 'ranks_captured_at' flag for competition ID: ${competitionId}`);

    // 1. Find the competition and its current flag status
    const compRes = await client.query('SELECT name, ranks_captured_at FROM competitions WHERE id = $1', [competitionId]); // Use ID
    if (compRes.rows.length === 0) {
      console.error(`Error: Competition with ID ${competitionId} not found.`);
      return;
    }

    const competitionName = compRes.rows[0].name; // Get name for logging
    const currentFlagValue = compRes.rows[0].ranks_captured_at; // Use snake_case
    console.log(`Found competition: "${competitionName}" (ID: ${competitionId}). Current 'ranks_captured_at' value: ${currentFlagValue || 'NULL'}`); // Use snake_case in log

    if (currentFlagValue === null) {
        console.log(`The 'ranks_captured_at' flag is already NULL for competition ID ${competitionId} ("${competitionName}"). No reset needed.`); // Use snake_case in log
        return;
    }

    // 2. Ask for confirmation
    const answer = await new Promise<string>(resolve => {
        rl.question(`Are you sure you want to set 'ranks_captured_at' to NULL for competition "${competitionName}" (ID: ${competitionId})? This will re-enable the 'Capture Ranks' button. (yes/no): `, resolve);
    });

    if (answer.toLowerCase() !== 'yes') {
      console.log('Operation cancelled by user.');
      return;
    }

    // 3. Update the flag
    console.log(`Setting 'ranks_captured_at' to NULL for competition ID ${competitionId}...`); // Use snake_case in log
    await client.query('BEGIN'); // Start transaction
    const updateRes = await client.query('UPDATE competitions SET ranks_captured_at = NULL WHERE id = $1', [competitionId]); // Use snake_case
    await client.query('COMMIT'); // Commit transaction

    if (updateRes.rowCount === 1) {
        console.log(`Successfully reset 'ranks_captured_at' flag for competition "${competitionName}" (ID: ${competitionId}). The 'Capture Ranks' button should now be enabled.`); // Use snake_case in log
    } else {
        console.warn(`Warning: Update query affected ${updateRes.rowCount} rows. Expected 1.`);
    }

  } catch (error: any) {
    if (client) {
        try {
            await client.query('ROLLBACK'); // Rollback on error
            console.error('Transaction rolled back due to error.');
        } catch (rollbackError) {
            console.error('Error rolling back transaction:', rollbackError);
        }
    }
    console.error('Error resetting ranks captured flag:', error.message || error);
  } finally {
    if (client) {
      client.release();
    }
    rl.close(); // Close the readline interface
    // Ensure the pool is closed gracefully if the script is the only thing running
    // Consider if the main application might still need the pool
    // await pool.end(); 
  }
}

// --- Script Execution ---
const competitionIdArg = process.argv[2];

if (!competitionIdArg) {
  console.error('Error: Please provide the competition ID as an argument.');
  console.log('Usage: npx tsx scripts/reset_ranks_captured_flag.ts <CompetitionID>'); // Updated usage message
  process.exit(1);
}

resetRanksCapturedFlag(competitionIdArg).catch(err => {
    console.error("Script execution failed:", err);
    process.exit(1); // Exit with error code if the function rejects
}).finally(() => {
    // Optional: Ensure pool is closed if necessary, especially if script might hang
    // pool.end().catch(e => console.error("Error closing pool:", e));
});
