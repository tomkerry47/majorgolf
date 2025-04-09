import dotenv from 'dotenv';
import pg from 'pg';
import bcrypt from 'bcryptjs';

dotenv.config(); // Load .env file variables

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

async function seedFakeData() {
  const client = await pool.connect();
  console.log('Connected to database for seeding...');

  try {
    await client.query('BEGIN'); // Start transaction

    // 1. Find The Players Championship ID
    const competitionRes = await client.query(
      'SELECT id FROM competitions WHERE name = $1 LIMIT 1',
      ['The Players Championship']
    );
    if (competitionRes.rows.length === 0) {
      throw new Error('The Players Championship not found in competitions table.');
    }
    const competitionId = competitionRes.rows[0].id;
    console.log(`Found The Players Championship with ID: ${competitionId}`);

    // 2. Find Golfer IDs (Top 15 ranked, or fewer if less exist)
    const golferRes = await client.query(
      'SELECT id FROM golfers ORDER BY rank ASC NULLS LAST LIMIT 15'
    );
    const golferIds = golferRes.rows.map(row => row.id);
    if (golferIds.length < 3) {
        throw new Error(`Need at least 3 golfers in the database to make selections. Found only ${golferIds.length}.`);
    }
    console.log(`Found ${golferIds.length} golfer IDs to use for selections.`);

    // 3. Create Fake Users
    const fakeUsers = [];
    const hashedPassword = await hashPassword('password123'); // Common password for fakes
    for (let i = 1; i <= 5; i++) {
      const email = `fakeuser${i}@example.com`;
      const username = `fakeuser${i}`;
      const fullName = `Fake User ${i}`;
      
      // Check if user already exists
      let userId;
      const existingUserRes = await client.query('SELECT id FROM users WHERE email = $1 OR username = $2', [email, username]);
      if (existingUserRes.rows.length > 0) {
          userId = existingUserRes.rows[0].id;
          console.log(`User ${username} or email ${email} already exists with ID: ${userId}.`);
          // Delete existing selections for this user and competition before adding new ones
          await client.query('DELETE FROM selections WHERE "userId" = $1 AND "competitionId" = $2', [userId, competitionId]);
          console.log(`Deleted existing selections for user ${userId} in competition ${competitionId}.`);
      } else {
          // Create new user if not existing
          const userRes = await client.query(
            'INSERT INTO users (email, username, "fullName", password, "isAdmin") VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [email, username, fullName, hashedPassword, false]
          );
          userId = userRes.rows[0].id;
          console.log(`Created fake user: ${username} (ID: ${userId})`);
      }
      // Add user (existing or new) to the list for selection creation
      fakeUsers.push({ id: userId, username });
    }

    // 4. Create Selections for each fake user
    for (const user of fakeUsers) {
      // Ensure we have enough unique golfers for this user
      if (golferIds.length < 3) {
          console.warn(`Skipping selections for ${user.username}: Not enough unique golfers available.`);
          continue;
      }
      
      // Shuffle golfer IDs to get different selections for each user
      const shuffledGolferIds = [...golferIds].sort(() => 0.5 - Math.random());
      
      // Take the first 3 unique golfers from the shuffled list
      const selectedGolferIds = shuffledGolferIds.slice(0, 3);

      if (selectedGolferIds.length < 3) {
          console.warn(`Could not select 3 distinct golfers for ${user.username} from available IDs. Skipping selections.`);
          continue;
      }
      
      const [golfer1Id, golfer2Id, golfer3Id] = selectedGolferIds;

      await client.query(
        'INSERT INTO selections ("userId", "competitionId", "golfer1Id", "golfer2Id", "golfer3Id", "useCaptainsChip") VALUES ($1, $2, $3, $4, $5, $6)',
        [user.id, competitionId, golfer1Id, golfer2Id, golfer3Id, false] // Not using captain chip for fakes
      );
      console.log(`Created selections for user ${user.username} (ID: ${user.id}) for competition ${competitionId}: Golfers ${golfer1Id}, ${golfer2Id}, ${golfer3Id}`);
    }

    await client.query('COMMIT'); // Commit transaction
    console.log('Successfully seeded fake users and selections.');

  } catch (error) {
    await client.query('ROLLBACK'); // Rollback transaction on error
    console.error('Error seeding fake data:', error);
  } finally {
    client.release();
    await pool.end();
    console.log('Database connection closed.');
  }
}

// Run the seeding function
seedFakeData();
