// scripts/seed_fake_users_and_selections.ts
import 'dotenv/config';
import { db, pool, hashPassword } from '../server/db.js';
import { users, selections, golfers, competitions, type InsertUser, type InsertSelection, type Golfer } from '../shared/schema.js';
import { eq, sql, ne } from 'drizzle-orm';

const NUM_FAKE_USERS = 10;
const USER_TO_KEEP_EMAIL = 'thomaskerry@me.com';
const PLAYERS_CHAMPIONSHIP_ID = 6; // From user feedback
const MASTERS_ID = 1;             // From user feedback

// Helper to shuffle an array
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Helper to pick N unique items randomly
function pickNRandomUnique<T>(items: T[], n: number): T[] {
  if (n > items.length) {
    throw new Error(`Cannot pick ${n} unique items from an array of length ${items.length}`);
  }
  return shuffleArray(items).slice(0, n);
}

async function seedData() {
  console.log('Starting fake user and selection seeding...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Get ID of the user to keep
    console.log(`Fetching ID for user: ${USER_TO_KEEP_EMAIL}`);
    const [userToKeep] = await db.select({ id: users.id }).from(users).where(eq(users.email, USER_TO_KEEP_EMAIL));
    if (!userToKeep) {
      throw new Error(`User ${USER_TO_KEEP_EMAIL} not found.`);
    }
    const userToKeepId = userToKeep.id;
    console.log(`Found user ID: ${userToKeepId}`);

    // 2. Fetch all available golfers
    console.log('Fetching all golfers...');
    const allGolfers = await db.select({ id: golfers.id }).from(golfers);
    if (allGolfers.length < 6) { // Need at least 6 for unique picks across two tournaments
        throw new Error(`Not enough golfers in the database (${allGolfers.length}) to make unique selections.`);
    }
    const golferIds = allGolfers.map(g => g.id);
    console.log(`Fetched ${golferIds.length} golfers.`);

    // 3. Create Fake Users
    console.log(`Creating ${NUM_FAKE_USERS} fake users...`);
    const fakeUsersToInsert: InsertUser[] = [];
    const fakeUserPassword = await hashPassword('password123'); // Use a common password
    for (let i = 1; i <= NUM_FAKE_USERS; i++) {
      fakeUsersToInsert.push({
        email: `fakeuser${i}@example.com`,
        username: `fakeuser${i}`,
        fullName: `Fake User ${i}`,
        password: fakeUserPassword,
        isAdmin: false,
        hasUsedWaiverChip: false, // Default waiver chip status
      });
    }
    const insertedFakeUsers = await db.insert(users).values(fakeUsersToInsert).returning({ id: users.id, email: users.email });
    console.log(`Inserted ${insertedFakeUsers.length} fake users.`);

    // 4. Create Selections for Fake Users
    console.log('Creating selections for fake users...');
    const selectionsToInsert: InsertSelection[] = [];
    const userIndicesForCaptainChip = pickNRandomUnique([...Array(NUM_FAKE_USERS).keys()], 2); // Pick 2 indices for chips
    const captainChipUserIndexPlayers = userIndicesForCaptainChip[0];
    const captainChipUserIndexMasters = userIndicesForCaptainChip[1];
    console.log(`Assigning Captain's Chip: User index ${captainChipUserIndexPlayers} for Players, User index ${captainChipUserIndexMasters} for Masters.`);

    for (let i = 0; i < insertedFakeUsers.length; i++) {
      const fakeUserId = insertedFakeUsers[i].id;
      const isCaptainUserPlayers = i === captainChipUserIndexPlayers;
      const isCaptainUserMasters = i === captainChipUserIndexMasters;

      // --- Players Championship Selections ---
      const playersPicks = pickNRandomUnique(golferIds, 3);
      const playersCaptainId = isCaptainUserPlayers ? pickNRandomUnique(playersPicks, 1)[0] : undefined;
      selectionsToInsert.push({
        userId: fakeUserId,
        competitionId: PLAYERS_CHAMPIONSHIP_ID,
        golfer1Id: playersPicks[0],
        golfer2Id: playersPicks[1],
        golfer3Id: playersPicks[2],
        useCaptainsChip: isCaptainUserPlayers,
        captainGolferId: playersCaptainId,
      });
      console.log(`  FakeUser ${i+1} (ID: ${fakeUserId}) Players Picks: ${playersPicks.join(', ')}${isCaptainUserPlayers ? ` (Captain: ${playersCaptainId})` : ''}`);

      // --- Masters Selections (ensure different golfers) ---
      const remainingGolferIds = golferIds.filter(id => !playersPicks.includes(id));
      if (remainingGolferIds.length < 3) {
          console.warn(`  WARN: Not enough remaining golfers for FakeUser ${i+1} Masters picks. Re-using some golfers.`);
          // Fallback: just pick 3 random from all golfers again, hoping for minimal overlap
          const mastersPicksFallback = pickNRandomUnique(golferIds, 3);
          const mastersCaptainIdFallback = isCaptainUserMasters ? pickNRandomUnique(mastersPicksFallback, 1)[0] : undefined;
           selectionsToInsert.push({
               userId: fakeUserId,
               competitionId: MASTERS_ID,
               golfer1Id: mastersPicksFallback[0],
               golfer2Id: mastersPicksFallback[1],
               golfer3Id: mastersPicksFallback[2],
               useCaptainsChip: isCaptainUserMasters,
               captainGolferId: mastersCaptainIdFallback,
           });
           console.log(`  FakeUser ${i+1} (ID: ${fakeUserId}) Masters Picks (Fallback): ${mastersPicksFallback.join(', ')}${isCaptainUserMasters ? ` (Captain: ${mastersCaptainIdFallback})` : ''}`);
      } else {
          const mastersPicks = pickNRandomUnique(remainingGolferIds, 3);
          const mastersCaptainId = isCaptainUserMasters ? pickNRandomUnique(mastersPicks, 1)[0] : undefined;
          selectionsToInsert.push({
              userId: fakeUserId,
              competitionId: MASTERS_ID,
              golfer1Id: mastersPicks[0],
              golfer2Id: mastersPicks[1],
              golfer3Id: mastersPicks[2],
              useCaptainsChip: isCaptainUserMasters,
              captainGolferId: mastersCaptainId,
          });
          console.log(`  FakeUser ${i+1} (ID: ${fakeUserId}) Masters Picks: ${mastersPicks.join(', ')}${isCaptainUserMasters ? ` (Captain: ${mastersCaptainId})` : ''}`);
      }
    }

    // 5. Create Selections for UserToKeep (Players Championship only)
    console.log(`Creating Players Championship selection for user ${USER_TO_KEEP_EMAIL} (ID: ${userToKeepId})...`);
    const userToKeepPicks = pickNRandomUnique(golferIds, 3);
    selectionsToInsert.push({
      userId: userToKeepId,
      competitionId: PLAYERS_CHAMPIONSHIP_ID,
      golfer1Id: userToKeepPicks[0],
      golfer2Id: userToKeepPicks[1],
      golfer3Id: userToKeepPicks[2],
      useCaptainsChip: false, // No captain chip for this user
      captainGolferId: undefined,
    });
    console.log(`  User ${USER_TO_KEEP_EMAIL} Players Picks: ${userToKeepPicks.join(', ')}`);

    // 6. Insert All Selections
    if (selectionsToInsert.length > 0) {
      console.log(`Inserting ${selectionsToInsert.length} selections...`);
      await db.insert(selections).values(selectionsToInsert);
      console.log('Selections inserted successfully.');
    }

    await client.query('COMMIT');
    console.log('Seeding completed successfully!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error during seeding:', error);
    process.exit(1); // Exit with error
  } finally {
    client.release();
    await pool.end(); // Close pool
    console.log('Database connection closed.');
  }
}

seedData();
