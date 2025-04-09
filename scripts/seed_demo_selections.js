import 'dotenv/config'; // Load .env variables first
import { storage } from '../server/storage.ts'; // Import .ts file
// import { pgClient } from '../server/db.ts'; // No longer need direct client import for .end()

async function seedDemoSelections() {
  console.log('Starting to seed demo selections...');

  try {
    // 1. Find "The Players Championship"
    const competitions = await storage.getCompetitions();
    const playersChampionship = competitions.find(c => c.name.includes('Players Championship'));

    if (!playersChampionship) {
      console.error('Error: "The Players Championship" not found.');
      return;
    }
    const competitionId = playersChampionship.id;
    console.log(`Found "The Players Championship" with ID: ${competitionId}`);

    // 2. Find Demo Users, 'thomaskerry', and Fake Users
    const allUsers = await storage.getAllUsers();
    const demoUsers = allUsers.filter(u => u.username.startsWith('demoplayer')).slice(0, 5); // Take first 5 demo users
    const thomasUser = allUsers.find(u => u.username === 'thomaskerry');
    const fakeUsers = allUsers.filter(u => u.username.startsWith('fakeuser')); // Find all fake users

    const usersToProcess = [];

    if (demoUsers.length > 0) {
        usersToProcess.push(...demoUsers);
        console.log(`Found ${demoUsers.length} demo users.`);
    } else {
        console.warn("Warning: No demo users found.");
    }

    if (thomasUser) {
      usersToProcess.push(thomasUser);
      console.log(`Found user 'thomaskerry' with ID: ${thomasUser.id}`);
    } else {
      console.warn("Warning: User 'thomaskerry' not found.");
    }

    if (fakeUsers.length > 0) {
        usersToProcess.push(...fakeUsers);
        console.log(`Found ${fakeUsers.length} fake users.`);
    } else {
        console.warn("Warning: No fake users found.");
    }

    if (usersToProcess.length === 0) {
        console.error('Error: No users found to process.');
        return;
    }
    console.log(`Total users to process: ${usersToProcess.length}`, usersToProcess.map(u => ({ id: u.id, username: u.username })));

    // 3. Get Available Golfers
    const golfers = await storage.getGolfers();
    if (golfers.length < 3) {
      console.error('Error: Not enough golfers available to make selections.');
      return;
    }
    const golferIds = golfers.map(g => g.id);
    console.log(`Found ${golfers.length} golfers.`);

    // 4. Generate and Insert Selections
    const createdSelections = [];
    const usedGolferSets = new Set(); // To ensure unique combinations across users

    // Randomly choose one user from the combined list for the captain's chip
    let captainChipUserIndex = -1;
    if (usersToProcess.length > 0) {
        captainChipUserIndex = Math.floor(Math.random() * usersToProcess.length);
        console.log(`User ${usersToProcess[captainChipUserIndex].username} (Index: ${captainChipUserIndex}) will get the captain's chip.`);
    }


    for (let i = 0; i < usersToProcess.length; i++) {
      const user = usersToProcess[i];
      const useCaptainsChip = (i === captainChipUserIndex);

      // Delete existing selections for this user and competition first
      try {
        const deletedCount = await storage.deleteUserSelectionsForCompetition(user.id, competitionId);
        if (deletedCount > 0) {
            console.log(`Deleted ${deletedCount} existing selection(s) for user ${user.username} (ID: ${user.id}) in competition ${competitionId}.`);
        }
      } catch (deleteError) {
          console.error(`Error deleting existing selections for user ${user.username}:`, deleteError);
          // Decide if you want to continue or stop if deletion fails
          // continue; // Optional: skip user if deletion fails
      }

      let selectedGolferIds;
      let selectionKey;
      let attempts = 0;
      const maxAttempts = 50; // Prevent infinite loop

      // Ensure unique golfer combination for this user
      do {
        selectedGolferIds = [];
        const availableIds = [...golferIds];
        while (selectedGolferIds.length < 3 && availableIds.length > 0) {
          const randomIndex = Math.floor(Math.random() * availableIds.length);
          selectedGolferIds.push(availableIds.splice(randomIndex, 1)[0]);
        }
        // Create a sorted key to check for uniqueness regardless of order
        selectionKey = selectedGolferIds.sort((a, b) => a - b).join(',');
        attempts++;
      } while (usedGolferSets.has(selectionKey) && attempts < maxAttempts);

      if (attempts >= maxAttempts) {
        console.error(`Could not find a unique golfer combination for user ${user.username} after ${maxAttempts} attempts. Skipping.`);
        continue;
      }

      usedGolferSets.add(selectionKey); // Mark this combination as used

      const selectionData = {
        userId: user.id,
        competitionId: competitionId,
        golfer1Id: selectedGolferIds[0],
        golfer2Id: selectedGolferIds[1],
        golfer3Id: selectedGolferIds[2],
        useCaptainsChip: useCaptainsChip,
        // createdAt and updatedAt will be set by the database or storage function
      };

      try {
        const newSelection = await storage.createSelection(selectionData);
        createdSelections.push(newSelection);
        console.log(`Created selection for ${user.username}: Golfers ${selectedGolferIds.join(', ')} ${useCaptainsChip ? '(Captain Chip)' : ''}`);

        // If captain's chip was used, ensure the user's overall chip status is updated
        // Note: storage.createSelection might already handle this, but double-checking or direct update might be needed
        // depending on implementation. For now, assume createSelection handles it or it's handled elsewhere.
        // If direct update needed: await storage.updateUser(user.id, { hasUsedCaptainsChip: true });

      } catch (error) {
        console.error(`Error creating selection for user ${user.username}:`, error);
      }
    }

    console.log(`Successfully created ${createdSelections.length} new selections.`);

  } catch (error) {
    console.error('Error seeding demo selections:', error);
  } finally {
    // Storage methods should handle client release from the pool.
    // No need to call pgClient.end() on the pool itself.
    console.log('Script finished.');
  }
}

seedDemoSelections();
