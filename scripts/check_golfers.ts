import 'dotenv/config'; // Load .env file variables
import { db } from '../server/db'; // Adjust path as needed
import { golfers } from '../shared/schema'; // Adjust path as needed

async function checkGolfersTable() {
  console.log('Querying golfers table...');
  try {
    // Select specific columns to avoid potential issues with missing columns if schema differs slightly
    const allGolfers = await db.select({
        id: golfers.id,
        name: golfers.name,
        shortName: golfers.shortName,
        rank: golfers.rank
    }).from(golfers);

    if (allGolfers.length === 0) {
      console.log('The golfers table is currently empty.');
    } else {
      console.log(`Found ${allGolfers.length} golfers in table:`);
      console.table(allGolfers); // Display results in a table format
    }
  } catch (error) {
    console.error('Error querying golfers table:', error);
  } finally {
    // Ensure the script exits
    process.exit(0); 
  }
}

checkGolfersTable();
