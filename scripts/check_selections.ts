import 'dotenv/config'; // Load .env file variables
import { db } from '../server/db'; // Adjust path as needed
import { selections } from '../shared/schema'; // Adjust path as needed

async function checkSelectionsTable() {
  console.log('Querying selections table...');
  try {
    const allSelections = await db.select().from(selections);

    if (allSelections.length === 0) {
      console.log('The selections table is currently empty.');
    } else {
      console.log(`Found ${allSelections.length} selections in table:`);
      // Select specific columns for better readability in console.table
      const formattedSelections = allSelections.map(s => ({
        id: s.id,
        userId: s.userId,
        competitionId: s.competitionId,
        golfer1Id: s.golfer1Id,
        golfer2Id: s.golfer2Id,
        golfer3Id: s.golfer3Id,
        useCaptainsChip: s.useCaptainsChip,
        captainGolferId: s.captainGolferId,
        waiverRank: s.waiverRank,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt
      }));
      console.table(formattedSelections); 
    }
  } catch (error) {
    console.error('Error querying selections table:', error);
  } finally {
    // Ensure the script exits
    process.exit(0); 
  }
}

checkSelectionsTable();
