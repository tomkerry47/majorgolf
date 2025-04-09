// dotenv import and config removed - will be handled by node -r flag

import { db } from '../server/db.ts';
import { selections, users, competitions, golfers } from '../shared/schema.ts';
import { eq, and } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

const COMPETITION_NAME = "The Players Championship"; // Corrected name

async function showSelections() {
  console.log(`Fetching selections for competition: "${COMPETITION_NAME}"...`);

  try {
    // 1. Find the competition ID
    const [competition] = await db
      .select({ id: competitions.id })
      .from(competitions)
      .where(eq(competitions.name, COMPETITION_NAME))
      .limit(1);

    if (!competition) {
      console.error(`Error: Competition "${COMPETITION_NAME}" not found.`);
      return;
    }
    const competitionId = competition.id;
    console.log(`Found competition ID: ${competitionId}`);

    // 2. Define aliases for golfer table joins
    const golfer1 = alias(golfers, "golfer1");
    const golfer2 = alias(golfers, "golfer2");
    const golfer3 = alias(golfers, "golfer3");
    const captainGolfer = alias(golfers, "captainGolfer");

    // 3. Fetch selections with user and golfer details
    const selectionDetails = await db
      .select({
        username: users.username,
        golfer1Name: golfer1.name,
        golfer2Name: golfer2.name,
        golfer3Name: golfer3.name,
        useCaptainsChip: selections.useCaptainsChip,
        captainGolferId: selections.captainGolferId,
        captainGolferName: captainGolfer.name // Select captain's name
      })
      .from(selections)
      .innerJoin(users, eq(selections.userId, users.id))
      .innerJoin(competitions, eq(selections.competitionId, competitions.id))
      .leftJoin(golfer1, eq(selections.golfer1Id, golfer1.id))
      .leftJoin(golfer2, eq(selections.golfer2Id, golfer2.id))
      .leftJoin(golfer3, eq(selections.golfer3Id, golfer3.id))
      .leftJoin(captainGolfer, eq(selections.captainGolferId, captainGolfer.id)) // Join to get captain name
      .where(eq(selections.competitionId, competitionId))
      .orderBy(users.username);

    if (selectionDetails.length === 0) {
      console.log(`No selections found for "${COMPETITION_NAME}".`);
      return;
    }

    // 4. Print the results
    console.log(`\n--- Selections for ${COMPETITION_NAME} ---`);
    selectionDetails.forEach(sel => {
      let captainInfo = "";
      if (sel.useCaptainsChip) {
        captainInfo = ` (Captain: ${sel.captainGolferName || 'ID ' + sel.captainGolferId || 'Unknown'})`; // Show name or ID
      }
      console.log(
        `${sel.username}: ${sel.golfer1Name || 'N/A'}, ${sel.golfer2Name || 'N/A'}, ${sel.golfer3Name || 'N/A'}${captainInfo}`
      );
    });
    console.log(`-----------------------------------------\n`);

  } catch (error) {
    console.error("Error fetching selections:", error);
  } finally {
    // Ensure the database connection pool is ended correctly if db object exposes it
    // This depends on how your db connection is managed in server/db.js
    // Example: if db has an 'end' method:
    if (db && typeof db.end === 'function') {
       await db.end();
       console.log("Database connection closed.");
    } else if (db && db.pool && typeof db.pool.end === 'function') {
       await db.pool.end(); // If connection pool is accessible via db.pool
       console.log("Database connection pool closed.");
    }
  }
}

showSelections();
