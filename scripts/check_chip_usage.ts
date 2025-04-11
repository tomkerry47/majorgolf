import 'dotenv/config'; // Load .env file variables
import { db } from '../server/db'; // Adjust path as needed
import { users, selections } from '../shared/schema'; // Adjust path as needed
import { eq, count } from 'drizzle-orm'; // Import Drizzle operators

async function checkChipUsage() {
  console.log('Checking database for selections and chip usage...');

  try {
    // 1. Count total selections
    const totalSelectionsResult = await db.select({ value: count() }).from(selections);
    const totalSelections = totalSelectionsResult[0]?.value ?? 0;
    console.log(`- Total selections found: ${totalSelections}`);

    // 2. Count selections using Captains Chip
    const captainChipSelectionsResult = await db.select({ value: count() })
      .from(selections)
      .where(eq(selections.useCaptainsChip, true));
    const captainChipSelections = captainChipSelectionsResult[0]?.value ?? 0;
    console.log(`- Selections using Captains Chip: ${captainChipSelections}`);

    // 3. Count users who have used Waiver Chip
    const waiverChipUsersResult = await db.select({ value: count() })
      .from(users)
      .where(eq(users.hasUsedWaiverChip, true));
    const waiverChipUserCount = waiverChipUsersResult[0]?.value ?? 0;
    console.log(`- Users who have used Waiver Chip: ${waiverChipUserCount}`);

    // 4. List details of users who used Waiver Chip
    if (waiverChipUserCount > 0) {
      console.log('\n--- Waiver Chip Usage Details ---');
      const waiverUsersDetails = await db.select({
          userId: users.id,
          username: users.username,
          isAdmin: users.isAdmin, // Added isAdmin status
          competitionId: users.waiverChipUsedCompetitionId,
          originalGolferId: users.waiverChipOriginalGolferId,
          replacementGolferId: users.waiverChipReplacementGolferId
        })
        .from(users)
        .where(eq(users.hasUsedWaiverChip, true));

      waiverUsersDetails.forEach(user => {
        console.log(`  - User: ${user.username} (ID: ${user.userId}), Is Admin: ${user.isAdmin}`); // Added isAdmin output
        console.log(`    - Competition ID: ${user.competitionId}`);
        console.log(`    - Original Golfer ID: ${user.originalGolferId}`);
        console.log(`    - Replacement Golfer ID: ${user.replacementGolferId}`);
      });
      console.log('-----------------------------');
    }


    if (totalSelections === 0 && captainChipSelections === 0 && waiverChipUserCount === 0) {
      console.log('\nDatabase appears clear of selections and chip usage.');
    } else {
      console.log('\nData found. Review counts before running force_clear_db.ts.');
    }

  } catch (error) {
    console.error('Error during chip usage check:', error);
  } finally {
    // Ensure the script exits
    process.exit(0);
  }
}

checkChipUsage();
