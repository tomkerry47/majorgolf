import dotenv from 'dotenv';
dotenv.config(); // Load environment variables from .env file

// --- Debugging: Print the DATABASE_URL ---
console.log(`DEBUG: DATABASE_URL from process.env = ${process.env.DATABASE_URL}`);
// --- End Debugging ---

import { storage } from '../server/storage'; // Adjust path as needed

const USERNAME_TO_CHECK = 'tomkerry'; // Corrected username
const COMPETITION_ID_TO_CHECK = 6;

async function checkWaiverData() {
  console.log(`Checking waiver data for user: ${USERNAME_TO_CHECK} in competition ID: ${COMPETITION_ID_TO_CHECK}`);

  try {
    // 1. Get the user by username
    const user = await storage.getUserByUsername(USERNAME_TO_CHECK);

    if (!user) {
      console.error(`User with username "${USERNAME_TO_CHECK}" not found.`);
      return;
    }

    console.log(`\n--- User Waiver Details (User ID: ${user.id}) ---`);
    console.log(`Has Used Waiver Chip: ${user.hasUsedWaiverChip}`);
    console.log(`Waiver Chip Used Competition ID: ${user.waiverChipUsedCompetitionId}`);
    console.log(`Waiver Chip Original Golfer ID: ${user.waiverChipOriginalGolferId}`);
    console.log(`Waiver Chip Replacement Golfer ID: ${user.waiverChipReplacementGolferId}`);

    // 2. Check if the waiver was used in the specified competition
    if (user.hasUsedWaiverChip && user.waiverChipUsedCompetitionId === COMPETITION_ID_TO_CHECK) {
      console.log(`\nConfirmation: Waiver chip WAS used by ${USERNAME_TO_CHECK} in competition ${COMPETITION_ID_TO_CHECK}.`);

      // 3. Fetch the user's selection for this competition
      const selection = await storage.getUserSelections(user.id, COMPETITION_ID_TO_CHECK);
      if (selection) {
        console.log(`\n--- Selection Details (Competition ID: ${COMPETITION_ID_TO_CHECK}) ---`);
        console.log(`Golfer 1 ID: ${selection.golfer1Id}`);
        console.log(`Golfer 2 ID: ${selection.golfer2Id}`);
        console.log(`Golfer 3 ID: ${selection.golfer3Id}`);
      } else {
        console.log(`\nWarning: No selection record found for user ${user.id} in competition ${COMPETITION_ID_TO_CHECK}.`);
      }

      // 4. Fetch details of the original golfer (if ID exists)
      if (user.waiverChipOriginalGolferId) {
        const originalGolfer = await storage.getGolferById(user.waiverChipOriginalGolferId);
        if (originalGolfer) {
          console.log(`\n--- Original Waiver Golfer Details (ID: ${user.waiverChipOriginalGolferId}) ---`);
          console.log(`Name: ${originalGolfer.name}`);
          console.log(`Rank: ${originalGolfer.rank}`);
        } else {
          console.log(`\nWarning: Could not find golfer details for original waiver golfer ID: ${user.waiverChipOriginalGolferId}`);
        }
      } else {
         console.log(`\nNote: No Original Golfer ID stored for the waiver chip usage.`);
      }

    } else if (user.hasUsedWaiverChip) {
      console.log(`\nConfirmation: Waiver chip was used by ${USERNAME_TO_CHECK}, but in a DIFFERENT competition (ID: ${user.waiverChipUsedCompetitionId}).`);
    } else {
      console.log(`\nConfirmation: Waiver chip has NOT been used by ${USERNAME_TO_CHECK}.`);
    }

  } catch (error) {
    console.error('Error checking waiver data:', error);
  }
}

checkWaiverData();
