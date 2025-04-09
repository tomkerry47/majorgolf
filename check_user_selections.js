import 'dotenv/config';
import { storage } from './server/storage.ts'; // Assuming storage.ts is correctly set up

async function checkSelections() {
  const usernameToCheck = 'thomaskerry';
  console.log(`Checking selections for user: ${usernameToCheck}`);

  try {
    // 1. Get User ID
    const user = await storage.getUserByUsername(usernameToCheck);
    if (!user) {
      console.error(`User '${usernameToCheck}' not found.`);
      return;
    }
    console.log(`Found user '${usernameToCheck}' with ID: ${user.id}`);

    // 2. Get Selections using the storage function
    const selections = await storage.getUserSelectionsForAllCompetitions(user.id);

    // 3. Analyze and Report
    if (!selections || selections.length === 0) {
      console.log(`No selections found for user '${usernameToCheck}' (ID: ${user.id}) in the database according to storage.getUserSelectionsForAllCompetitions.`);
    } else {
      console.log(`Found ${selections.length} selection(s) for user '${usernameToCheck}' (ID: ${user.id}):`);
      selections.forEach((sel, index) => {
        console.log(`--- Selection ${index + 1} ---`);
        console.log(`  Selection ID: ${sel.id}`);
        console.log(`  Competition ID: ${sel.competitionId}`);
        console.log(`  Competition Name: ${sel.competition?.name || 'N/A'}`); // Access nested competition name
        console.log(`  Golfer 1 ID: ${sel.golfer1Id} (${sel.golfer1?.name || 'N/A'})`);
        console.log(`  Golfer 2 ID: ${sel.golfer2Id} (${sel.golfer2?.name || 'N/A'})`);
        console.log(`  Golfer 3 ID: ${sel.golfer3Id} (${sel.golfer3?.name || 'N/A'})`);
        console.log(`  Use Captain's Chip: ${sel.useCaptainsChip}`);
        console.log(`  Created At: ${sel.createdAt}`);
        console.log(`  Total Points: ${sel.totalPoints}`);
        console.log(`  Competition Active: ${sel.competition?.isActive}`);
        console.log(`  Competition Complete: ${sel.competition?.isComplete}`);
        console.log('--------------------');
      });
    }

  } catch (error) {
    console.error(`Error checking selections for user '${usernameToCheck}':`, error);
  } finally {
    // Storage methods should handle client release.
    console.log('Check selections script finished.');
    // Ensure the script exits properly, especially if there are open handles like DB connections managed internally by storage
    process.exit(0); 
  }
}

checkSelections();
