import dotenv from 'dotenv';
dotenv.config(); // Load environment variables from .env file

import { pgClient, pool } from '../server/db'; // Adjust path as needed

    async function checkCompetition6Leaderboard() {
      console.log('Checking database for Competition ID 6...');
      try {
        // Query 1: Get competition details
        const compResult = await pgClient.query(
          'SELECT id, name, "isActive", "isComplete", "lastResultsUpdateAt" FROM competitions WHERE id = $1',
          [6]
        );
        console.log('Competition Details (ID=6):');
        if (compResult.rows.length > 0) {
          console.log(JSON.stringify(compResult.rows[0], null, 2));
        } else {
          console.log('Competition with ID 6 not found.');
        }

        console.log('\n---\n');

        // Query 2: Count user points for the competition
        const pointsResult = await pgClient.query(
          'SELECT COUNT(*) FROM user_points WHERE "competitionId" = $1',
          [6]
        );
        console.log('User Points Count (CompetitionID=6):');
        console.log(JSON.stringify(pointsResult.rows[0], null, 2));

      } catch (error) {
        console.error('Error querying database:', error);
      } finally {
        // Ensure the pool closes connections
        await pool.end();
        console.log('Database connection closed.');
      }
    }

    checkCompetition6Leaderboard();
