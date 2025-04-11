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

async function showRanksForSelection(competitionId: number, targetGolferIds: number[]) {
  let client: PoolClient | null = null;
  console.log(`Fetching rank details for Competition ID: ${competitionId}, Golfer IDs: ${targetGolferIds.join(', ')}`);

  try {
    client = await pool.connect();

    // Query to get relevant info from selections, users, golfers, and selection_ranks
    const query = `
      SELECT
          s."userId",
          u.username,
          g.id as "golferId",
          g.name as "golferName",
          sr."rankAtDeadline",
          s."waiverRank",
          -- Determine if this specific golfer was the waiver replacement for this user/comp
          (u."hasUsedWaiverChip" = TRUE AND u."waiverChipUsedCompetitionId" = s."competitionId" AND u."waiverChipReplacementGolferId" = g.id) as "isWaiverReplacement"
      FROM
          selections s
      JOIN
          users u ON s."userId" = u.id
      -- Join based on any of the three golfer slots containing a target golfer ID
      JOIN
          golfers g ON g.id = ANY(ARRAY[s."golfer1Id", s."golfer2Id", s."golfer3Id"]) AND g.id = ANY($2::int[])
      -- Left join to selection_ranks to get the original deadline rank if it exists
      LEFT JOIN
          selection_ranks sr ON sr."userId" = s."userId" AND sr."competitionId" = s."competitionId" AND sr."golferId" = g.id
      WHERE
          s."competitionId" = $1
      ORDER BY
          u.username, g.name;
    `;

    const result: QueryResult<SelectionRankInfo> = await client.query(query, [competitionId, targetGolferIds]);

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
const targetCompetitionId = 6;
const targetGolferIds = [521, 523];

showRanksForSelection(targetCompetitionId, targetGolferIds).catch(err => {
    console.error("Script execution failed:", err);
    process.exit(1); // Exit with error code if the function rejects
});
