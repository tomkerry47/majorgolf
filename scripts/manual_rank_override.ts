import 'dotenv/config';
import { Pool, PoolClient, QueryResult } from 'pg';
import readline from 'readline';

// Assume pool is configured similarly to other scripts
import { pool } from '../server/db'; // Adjust path if needed

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

interface SelectionInfoForUpdate {
  selectionId: number;         // ID from selections table
  userId: number;
  golferId: number;
  golferName: string;
  selectionRankId: number | null; // ID from selection_ranks table (if exists)
  currentRankAtDeadline: number | null;
  currentWaiverRank: number | null;
  isWaiverReplacement: boolean;
}

async function manualRankOverride(competitionId: number, rankOverrides: { [golferId: number]: number }) {
  let client: PoolClient | null = null;
  const golferIdsToUpdate = Object.keys(rankOverrides).map(Number);

  console.log(`Starting manual rank override for Competition ID: ${competitionId}`);
  console.log(`Target Golfer Ranks: ${JSON.stringify(rankOverrides)}`);

  const updatesToPerform: { type: 'selection_ranks' | 'selections'; id: number; newRank: number; golferId: number; userId: number }[] = [];

  try {
    client = await pool.connect();

    // 1. Fetch current state for relevant selections
    const query = `
      SELECT
          s.id as "selectionId",
          s."userId",
          g.id as "golferId",
          g.name as "golferName",
          sr.id as "selectionRankId", -- ID from selection_ranks table
          sr."rankAtDeadline" as "currentRankAtDeadline",
          s."waiverRank" as "currentWaiverRank",
          (u."hasUsedWaiverChip" = TRUE AND u."waiverChipUsedCompetitionId" = s."competitionId" AND u."waiverChipReplacementGolferId" = g.id) as "isWaiverReplacement"
      FROM
          selections s
      JOIN
          users u ON s."userId" = u.id
      JOIN
          golfers g ON g.id = ANY(ARRAY[s."golfer1Id", s."golfer2Id", s."golfer3Id"]) AND g.id = ANY($2::int[])
      LEFT JOIN
          selection_ranks sr ON sr."userId" = s."userId" AND sr."competitionId" = s."competitionId" AND sr."golferId" = g.id
      WHERE
          s."competitionId" = $1
      ORDER BY
          s."userId", g.id;
    `;

    const result: QueryResult<SelectionInfoForUpdate> = await client.query(query, [competitionId, golferIdsToUpdate]);

    if (result.rows.length === 0) {
      console.log('No selections found containing the specified golfers in this competition. No updates needed.');
      return;
    }

    console.log('\nAnalyzing selections to determine necessary updates:');

    // 2. Determine which updates are needed
    result.rows.forEach(row => {
      const newRank = rankOverrides[row.golferId];
      if (newRank === undefined) return; // Should not happen based on query, but safety check

      if (row.isWaiverReplacement) {
        // Update waiverRank in selections table
        if (row.currentWaiverRank !== newRank) {
          console.log(` - User ${row.userId}, Golfer ${row.golferId} (${row.golferName}): Uses WAIVER rank. Need to update selections.waiverRank (ID: ${row.selectionId}) from ${row.currentWaiverRank ?? 'NULL'} to ${newRank}.`);
          updatesToPerform.push({ type: 'selections', id: row.selectionId, newRank, golferId: row.golferId, userId: row.userId });
        } else {
          console.log(` - User ${row.userId}, Golfer ${row.golferId} (${row.golferName}): Uses WAIVER rank. selections.waiverRank (ID: ${row.selectionId}) is already ${newRank}. No update needed.`);
        }
      } else {
        // Update rankAtDeadline in selection_ranks table
        if (row.selectionRankId !== null) {
          if (row.currentRankAtDeadline !== newRank) {
            console.log(` - User ${row.userId}, Golfer ${row.golferId} (${row.golferName}): Uses DEADLINE rank. Need to update selection_ranks.rankAtDeadline (ID: ${row.selectionRankId}) from ${row.currentRankAtDeadline ?? 'NULL'} to ${newRank}.`);
            updatesToPerform.push({ type: 'selection_ranks', id: row.selectionRankId, newRank, golferId: row.golferId, userId: row.userId });
          } else {
            console.log(` - User ${row.userId}, Golfer ${row.golferId} (${row.golferName}): Uses DEADLINE rank. selection_ranks.rankAtDeadline (ID: ${row.selectionRankId}) is already ${newRank}. No update needed.`);
          }
        } else {
          // This golfer was selected, but rank wasn't captured (e.g., added after deadline without waiver, or capture failed?)
          // AND waiver wasn't used for them. Their rank wouldn't be used for bonus anyway.
          console.warn(` - User ${row.userId}, Golfer ${row.golferId} (${row.golferName}): Uses DEADLINE rank, but no entry found in selection_ranks. Cannot update deadline rank. This might indicate an issue with the initial rank capture.`);
        }
      }
    });

    if (updatesToPerform.length === 0) {
      console.log('\nNo rank updates are required based on the current data.');
      return;
    }

    // 3. Ask for confirmation
    console.log(`\nSummary: ${updatesToPerform.length} update(s) planned.`);
    const answer = await new Promise<string>(resolve => {
        rl.question(`Proceed with these updates? (yes/no): `, resolve);
    });

    if (answer.toLowerCase() !== 'yes') {
      console.log('Operation cancelled by user.');
      return;
    }

    // 4. Execute updates within a transaction
    await client.query('BEGIN');
    console.log('\nExecuting updates...');
    let updatesMade = 0;
    for (const update of updatesToPerform) {
      let updateResult: QueryResult;
      if (update.type === 'selections') {
        updateResult = await client.query('UPDATE selections SET "waiverRank" = $1 WHERE id = $2', [update.newRank, update.id]);
      } else { // type === 'selection_ranks'
        updateResult = await client.query('UPDATE selection_ranks SET "rankAtDeadline" = $1 WHERE id = $2', [update.newRank, update.id]);
      }
      if (updateResult.rowCount === 1) {
        console.log(` - Successfully updated ${update.type} ID ${update.id} (User: ${update.userId}, Golfer: ${update.golferId}) to rank ${update.newRank}.`);
        updatesMade++;
      } else {
         console.error(` - FAILED to update ${update.type} ID ${update.id}. Row count was ${updateResult.rowCount}.`);
         // Rollback immediately on failure
         await client.query('ROLLBACK');
         console.error('Transaction rolled back due to update failure.');
         return;
      }
    }
    await client.query('COMMIT');
    console.log(`\nTransaction committed. ${updatesMade} rank(s) updated successfully.`);

  } catch (error: any) {
    if (client) {
        try { await client.query('ROLLBACK'); console.error('Transaction rolled back due to error.'); }
        catch (rollbackError) { console.error('Error rolling back transaction:', rollbackError); }
    }
    console.error('Error performing manual rank override:', error.message || error);
  } finally {
    if (client) {
      client.release();
    }
    rl.close();
    pool.end().catch(e => console.error("Error closing pool:", e));
  }
}

// --- Script Execution ---
const targetCompetitionId = 6;
const targetRankOverrides = {
  523: 56, // Golfer ID 523 -> Rank 56
  521: 57  // Golfer ID 521 -> Rank 57
};

manualRankOverride(targetCompetitionId, targetRankOverrides).catch(err => {
    console.error("Script execution failed:", err);
    process.exit(1);
});
