import 'dotenv/config';
import 'dotenv/config';
import { Pool, PoolClient, QueryResult } from 'pg';

// Assume pool is configured similarly to other scripts
// Adjust the import path based on your project structure
import { pool } from '../server/db'; // Adjust path if needed

interface SelectionRankInfo {
  userId: number;
  username: string;
  golferId: number;
  golferName: string;
  rankAtDeadline: number | null; // Rank from selection_ranks
  waiverRank: number | null;     // Rank from selections table
  isWaiverReplacement: boolean;  // Indicates if this golfer was brought in via waiver for this user/comp
}

async function showRanksForSelection(competitionId: number, targetGolferIds?: number[]) {
  let client: PoolClient | null = null;
  if (targetGolferIds && targetGolferIds.length > 0) {
    console.log(`Fetching rank details for Competition ID: ${competitionId}, Filtered by Golfer IDs: ${targetGolferIds.join(', ')}`);
  } else {
    console.log(`Fetching rank details for Competition ID: ${competitionId} (all selected golfers)`);
  }

  try {
    client = await pool.connect();

    // Query to get relevant info from selections, users, golfers, and selection_ranks
    let baseQuery = `
      SELECT
          s."userId",
          u.username,
          g.id as "golferId",
          g.name as "golferName",
          sr."rankAtDeadline",
          s."waiverRank",
          (u."hasUsedWaiverChip" = TRUE AND u."waiverChipUsedCompetitionId" = s."competitionId" AND u."waiverChipReplacementGolferId" = g.id) as "isWaiverReplacement"
      FROM
          selections s
      JOIN
          users u ON s."userId" = u.id
      JOIN
          golfers g ON g.id = ANY(ARRAY[s."golfer1Id", s."golfer2Id", s."golfer3Id"])
          -- This ensures we get a row for each of the selected golfers (golfer1Id, golfer2Id, golfer3Id)
          -- if they are not null.
      LEFT JOIN
          selection_ranks sr ON sr."userId" = s."userId" AND sr."competitionId" = s."competitionId" AND sr."golferId" = g.id
      WHERE
          s."competitionId" = $1
    `;

    const queryParams: any[] = [competitionId];
    let finalQuery = baseQuery;

    if (targetGolferIds && targetGolferIds.length > 0) {
      // The parameter index will be $2 since $1 is competitionId
      finalQuery += ` AND g.id = ANY($${queryParams.length + 1}::int[])`;
      queryParams.push(targetGolferIds);
    }

    finalQuery += `
      ORDER BY
          u.username, g.name;
    `;

    const result: QueryResult<SelectionRankInfo> = await client.query(finalQuery, queryParams);

    if (result.rows.length === 0) {
      console.log('No selections found containing the specified golfers in this competition.');
    } else {
      console.log(`Found ${result.rows.length} instances of these golfers in selections:`);
      console.log('----------------------------------------------------------------------------------------------------');
      console.log('User ID | Username        | Golfer ID | Golfer Name         | Deadline Rank | Waiver Rank | Rank Used');
      console.log('----------------------------------------------------------------------------------------------------');
      result.rows.forEach(row => {
        const deadlineRankStr = row.rankAtDeadline !== null ? String(row.rankAtDeadline) : 'N/A';
        const waiverRankStr = row.waiverRank !== null ? String(row.waiverRank) : 'N/A';
        // Determine which rank is effectively used based on waiver status
        const rankUsed = row.isWaiverReplacement ? `Waiver (${waiverRankStr})` : `Deadline (${deadlineRankStr})`;

        console.log(
          `${String(row.userId).padEnd(7)} | ${row.username.padEnd(15)} | ${String(row.golferId).padEnd(9)} | ${row.golferName.padEnd(19)} | ${deadlineRankStr.padEnd(13)} | ${waiverRankStr.padEnd(11)} | ${rankUsed}`
        );
      });
      console.log('----------------------------------------------------------------------------------------------------');
    }

  } catch (error: any) {
    console.error('Error fetching captured ranks:', error.message || error);
  } finally {
    if (client) {
      client.release();
    }
    // Close the pool after the script finishes
    pool.end().catch(e => console.error("Error closing pool:", e));
  }
}

// --- Script Execution ---
const targetCompetitionId = 4;
// const targetGolferIds = [521, 523]; // Example: Filter by specific golfers like [521, 523]
// To show all golfers for the competition, call without the second argument or with an empty/undefined array.

showRanksForSelection(targetCompetitionId).catch(err => {
    console.error("Script execution failed:", err);
    process.exit(1); // Exit with error code if the function rejects
});
