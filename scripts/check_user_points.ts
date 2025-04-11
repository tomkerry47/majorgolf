import 'dotenv/config'; // Load .env file variables
import { db, pool } from '../server/db'; // Import db instance and pool
import { userPoints } from '../shared/schema'; // Import userPoints table schema
import { eq, and } from 'drizzle-orm'; // Import Drizzle operators

async function checkSpecificUserPoints(userId: number, competitionId: number) {
  console.log(`Querying user_points for userId: ${userId}, competitionId: ${competitionId}`);
  try {
    const result = await db
      .select({
        points: userPoints.points,
        details: userPoints.details,
      })
      .from(userPoints)
      .where(and(eq(userPoints.userId, userId), eq(userPoints.competitionId, competitionId)))
      .limit(1); // Expecting only one entry per user/competition

    if (result.length === 0) {
      console.log(`No points entry found for userId: ${userId}, competitionId: ${competitionId}`);
    } else {
      console.log(`Points entry found:`);
      console.log(`Total Points: ${result[0].points}`);
      console.log(`Details JSON:`);
      // Attempt to parse and pretty-print the JSON details
      try {
        const detailsObject = JSON.parse(result[0].details || '{}');
        console.log(JSON.stringify(detailsObject, null, 2));
      } catch (parseError) {
        console.error('Error parsing details JSON:', parseError);
        console.log('Raw Details:', result[0].details); // Log raw details if parsing fails
      }
    }
  } catch (error) {
    console.error('Error querying user_points table:', error);
  } finally {
    await pool.end(); // Close the pool after the query
    console.log('Database pool closed.');
  }
}

// Get userId and competitionId from command line arguments
const userIdArg = process.argv[2];
const competitionIdArg = process.argv[3];

if (!userIdArg || !competitionIdArg) {
  console.error('Usage: tsx scripts/check_user_points.ts <userId> <competitionId>');
  process.exit(1);
}

const userId = parseInt(userIdArg, 10);
const competitionId = parseInt(competitionIdArg, 10);

if (isNaN(userId) || isNaN(competitionId)) {
  console.error('Invalid userId or competitionId. Both must be numbers.');
  process.exit(1);
}

checkSpecificUserPoints(userId, competitionId);
