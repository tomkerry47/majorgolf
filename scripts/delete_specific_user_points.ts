import 'dotenv/config'; // Load .env file variables
import { db, pool } from '../server/db'; // Import db instance and pool
import { userPoints } from '../shared/schema'; // Import userPoints table schema
import { eq, and } from 'drizzle-orm'; // Import Drizzle operators

async function deleteSpecificUserPointsEntry(userId: number, competitionId: number) {
  console.log(`Attempting to delete user_points entry for userId: ${userId}, competitionId: ${competitionId}`);
  try {
    const deleteResult = await db
      .delete(userPoints)
      .where(and(eq(userPoints.userId, userId), eq(userPoints.competitionId, competitionId)))
      .returning({ id: userPoints.id }); // Return the ID of the deleted row

    if (deleteResult.length > 0) {
      console.log(`Successfully deleted user_points entry with ID: ${deleteResult[0].id} for userId: ${userId}, competitionId: ${competitionId}`);
    } else {
      console.log(`No user_points entry found to delete for userId: ${userId}, competitionId: ${competitionId}`);
    }
  } catch (error) {
    console.error('Error deleting user_points entry:', error);
  } finally {
    await pool.end(); // Close the pool after the query
    console.log('Database pool closed.');
  }
}

// Get userId and competitionId from command line arguments
const userIdArg = process.argv[2];
const competitionIdArg = process.argv[3];

if (!userIdArg || !competitionIdArg) {
  console.error('Usage: tsx scripts/delete_specific_user_points.ts <userId> <competitionId>');
  process.exit(1);
}

const userId = parseInt(userIdArg, 10);
const competitionId = parseInt(competitionIdArg, 10);

if (isNaN(userId) || isNaN(competitionId)) {
  console.error('Invalid userId or competitionId. Both must be numbers.');
  process.exit(1);
}

deleteSpecificUserPointsEntry(userId, competitionId);
