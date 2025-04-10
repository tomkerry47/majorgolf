import dotenv from 'dotenv'; // Import dotenv first
dotenv.config(); // Load environment variables

import { db, pool } from '../server/db'; // Import pool as well
import { users, selections } from '../shared/schema'; // Use relative path
import { eq, and, ilike } from 'drizzle-orm'; // Import ilike

async function checkChipStatus() {
  const usernameToCheck = 'fakeuser4'; // Corrected username
  const competitionIdToCheck = 6;

  console.log(`Checking Captain's Chip status for user "${usernameToCheck}" in competition ID ${competitionIdToCheck}...`);

  try {
    // 1. Find the user ID (case-insensitive)
    const [user] = await db.select({ id: users.id }).from(users).where(ilike(users.username, usernameToCheck)); // Use ilike

    if (!user) {
      console.error(`User "${usernameToCheck}" (case-insensitive) not found.`);
      process.exit(1);
    }
    const userId = user.id;
    console.log(`User "${usernameToCheck}" found with ID: ${userId}`);

    // 2. Find the selection for the user and competition
    const [selection] = await db.select({
        id: selections.id,
        useCaptainsChip: selections.useCaptainsChip
      })
      .from(selections)
      .where(and(
        eq(selections.userId, userId),
        eq(selections.competitionId, competitionIdToCheck)
      ));

    if (!selection) {
      console.log(`No selection found for user ID ${userId} in competition ID ${competitionIdToCheck}.`);
    } else {
      console.log(`Selection found (ID: ${selection.id}).`);
      console.log(`  useCaptainsChip status: ${selection.useCaptainsChip}`);
    }

  } catch (error) {
    console.error('Error checking chip status:', error);
    process.exit(1);
  } finally {
    // Ensure the script exits cleanly by closing the pool
     await pool.end(); // Close the pool
     console.log("Database connection pool closed.");
     // process.exit(0); // Let the script exit naturally after pool.end() completes
  }
}

checkChipStatus();
