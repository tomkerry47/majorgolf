import 'dotenv/config';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import axios from 'axios';
import * as cheerio from 'cheerio'; // Import cheerio

// --- PGA Tour Scraping ---
const PGA_LEADERBOARD_URL = 'https://www.pgatour.com/leaderboard.html'; // Or the specific current leaderboard URL if needed
// ---

// Define interfaces for database objects (adjust based on actual schema if needed)
interface Competition {
  id: number;
  name: string;
  startDate: string; // Assuming string representation, adjust if Date object
  endDate: string;   // Assuming string representation, adjust if Date object
  selectionDeadline: string; // Assuming string representation, adjust if Date object
  isActive: boolean;
  isComplete: boolean;
  externalLeaderboardUrl?: string | null; // Add field here as well
  // Add other fields as necessary
}

// Add Golfer interface
interface Golfer {
  id: number;
  name: string;
  // Add other relevant fields like rank, avatarUrl if needed
}

interface Result {
  id: number;
  competitionId: number;
  golferId: number;
  position: number;
  score: number;
  points: number;
  // Add other fields as necessary
}

interface Selection {
  id: number;
  userId: number;
  competitionId: number;
  golfer1Id: number;
  golfer2Id: number;
  golfer3Id: number;
  useCaptainsChip?: boolean; // Optional based on schema
  captainGolferId?: number; // Optional based on schema
  // Add other fields as necessary
}

interface PointSystemEntry {
  position: number;
  points: number;
}

// Interface for selection ranks fetched from DB
interface SelectionRankEntry {
  userId: number;
  golferId: number;
  rankAtDeadline: number;
}

interface PointDetail {
  golferId: number;
  position: number | string; // Can be number or 'MC/WD'
  basePoints: number; // Points based on position only
  rankAtDeadline?: number | null; // Rank at deadline
  doubledPoints: boolean; // Was rank bonus applied?
  finalPoints: number; // Points after rank bonus (before captain)
  possibleCaptain: boolean;
  isCaptain?: boolean;
  captainPoints?: number; // Additional points from captaincy
}

// Helper to safely get rows or empty array with type safety
const getRows = <T extends QueryResultRow>(result: QueryResult<T> | undefined | null): T[] => result?.rows || []; // Added constraint

// Modified to accept the connection pool directly with type annotation
export async function updateResultsAndAllocatePoints(pool: Pool, competitionIdToProcess: number | null = null): Promise<void> {
  console.log('Starting tournament results update and point allocation...');
  // Use the passed-in pool
  const client: PoolClient = await pool.connect(); // Use pool directly

  try {
    await client.query('BEGIN'); // Start transaction

    let competitionsToProcess: Competition[] = [];

    if (competitionIdToProcess !== null) {
      // Process only the specified competition
      console.log(`Processing specified competition ID: ${competitionIdToProcess}`);
      const compRes: QueryResult<Competition> = await client.query('SELECT * FROM competitions WHERE id = $1', [competitionIdToProcess]);
      competitionsToProcess = getRows(compRes);
      if (competitionsToProcess.length === 0) {
        console.log(`Competition with ID ${competitionIdToProcess} not found.`);
        await client.query('ROLLBACK');
        return;
      }
    } else {
      // Process active and recently completed competitions
      // 1. Get all active competitions
      const activeCompRes: QueryResult<Competition> = await client.query('SELECT * FROM competitions WHERE "isActive" = true');
      const activeCompetitions: Competition[] = getRows(activeCompRes);

      // 2. Get recently completed competitions (within the last month)
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      const recentCompRes: QueryResult<Competition> = await client.query(
        'SELECT * FROM competitions WHERE "isComplete" = true AND "endDate" >= $1 ORDER BY "endDate" DESC',
        [oneMonthAgo]
      );
      const recentCompetitions: Competition[] = getRows(recentCompRes);

      // Combine active and recent competitions
      if (activeCompetitions.length > 0) {
        console.log(`Found ${activeCompetitions.length} active competitions.`);
        competitionsToProcess = [...activeCompetitions];
      }
      if (recentCompetitions.length > 0) {
        console.log(`Found ${recentCompetitions.length} recently completed competitions.`);
        // Avoid duplicates if a competition was both active and recent (unlikely but possible)
        const activeIds = new Set(activeCompetitions.map(c => c.id));
        competitionsToProcess = [...competitionsToProcess, ...recentCompetitions.filter(c => !activeIds.has(c.id))];
      }
    }

    if (competitionsToProcess.length === 0) {
      console.log('No competitions found to process.');
      await client.query('COMMIT'); // Commit even if nothing to process
      return;
    }

    // 3. Process each competition
    for (const competition of competitionsToProcess) {
      await processCompetition(client, competition); // Pass client to helper
    }

    await client.query('COMMIT'); // Commit transaction
    console.log('Tournament results update and point allocation completed successfully.');
  } catch (error) {
    await client.query('ROLLBACK'); // Rollback transaction on error
    console.error('Error in updateResultsAndAllocatePoints:', error);
    throw error; // Re-throw to allow caller to handle
  } finally {
    client.release(); // Release client back to the pool
    // Don't end the pool here if the main app might still be running
    // await pool.end(); // Use pool directly if needed
  }
}

// --- New Function: Fetch and Process PGA Tour Data via Scraping ---
async function fetchAndProcessPgaData(client: PoolClient, competition: Competition): Promise<boolean> {
  console.log(`Scraping PGA Tour data for competition: ${competition.name} (ID: ${competition.id})`);

  // Use the specific URL stored for the competition
  const url = competition.externalLeaderboardUrl;
  if (!url) {
    console.error(`External leaderboard URL is missing for competition ${competition.id}. Skipping scrape.`);
    return false;
  }
  console.log(`Fetching HTML from URL: ${url}`);

  try {
    const { data: html } = await axios.get(url);
    const $ = cheerio.load(html);

    // --- Extract JSON data from script tag ---
    const scriptContent = $('#leaderboard-seo-data').html();
    if (!scriptContent) {
      console.error(`Could not find script tag with id="leaderboard-seo-data" on page: ${url}`);
      return false;
    }

    let leaderboardJson: any;
    try {
      leaderboardJson = JSON.parse(scriptContent);
    } catch (parseError) {
      console.error(`Failed to parse JSON from script tag:`, parseError);
      return false;
    }

    // --- Extract Data from JSON ---
    const jsonData = leaderboardJson?.mainEntity?.['csvw:tableSchema']?.['csvw:columns'];
    const jsonTournamentName = leaderboardJson?.name; // Extract tournament name from JSON

    if (!jsonData || !Array.isArray(jsonData) || !jsonTournamentName) {
      console.error(`JSON data structure is not as expected. Could not find columns or tournament name.`);
      return false;
    }

    // Find columns by name
    const posColumn = jsonData.find((col: any) => col['csvw:name'] === 'POS');
    const playerColumn = jsonData.find((col: any) => col['csvw:name'] === 'PLAYER');
    const scoreColumn = jsonData.find((col: any) => col['csvw:name'] === 'TOT'); // Total score
    const thruColumn = jsonData.find((col: any) => col['csvw:name'] === 'THRU'); // To check for completion

    if (!posColumn || !playerColumn || !scoreColumn || !thruColumn) {
      console.error(`Could not find required columns (POS, PLAYER, TOT, THRU) in JSON data.`);
      return false;
    }

    // Check lengths
    const numPlayers = playerColumn['csvw:cells']?.length || 0;
    if (numPlayers === 0 || posColumn['csvw:cells']?.length !== numPlayers || scoreColumn['csvw:cells']?.length !== numPlayers || thruColumn['csvw:cells']?.length !== numPlayers) {
      console.error(`Column data length mismatch in JSON.`);
      return false;
    }

    // Determine if tournament is complete (all players have 'F' in THRU column, or '-' for CUT)
    const isTournamentComplete = thruColumn['csvw:cells'].every((cell: any) => cell['csvw:value'] === 'F' || cell['csvw:value'] === '-');
    console.log(`Tournament status based on THRU column: ${isTournamentComplete ? 'Final' : 'In Progress'}`);

    // --- Compare Tournament Names ---
    const dbCompetitionNameLower = competition.name.toLowerCase().trim();
    // Clean the JSON tournament name (e.g., remove year, "Golf Leaderboard - PGA TOUR")
    const cleanedJsonTournamentName = jsonTournamentName
        .replace(/\s+\d{4}\s+Golf Leaderboard - PGA TOUR/i, '')
        .replace(/\s+Golf Leaderboard - PGA TOUR/i, '') // Fallback if year isn't present
        .toLowerCase().trim();

    // Consider more robust matching if needed
    if (dbCompetitionNameLower !== cleanedJsonTournamentName) {
        console.warn(`Mismatch: DB competition name "${competition.name}" does not match JSON tournament name "${jsonTournamentName}" (cleaned: "${cleanedJsonTournamentName}"). Skipping update for competition ${competition.id}.`);
        return false; // Prevent applying results to the wrong competition
    }
    console.log(`Tournament name match confirmed: "${jsonTournamentName}"`);

    // --- Fetch DB Golfers for Matching ---
    const golfersRes: QueryResult<Golfer> = await client.query('SELECT id, name FROM golfers');
    const dbGolfers: Golfer[] = getRows(golfersRes);
    const golferNameMap = new Map(dbGolfers.map(g => [g.name.toLowerCase().trim(), g.id])); // Map lowercase name to ID

    // --- Process JSON Data ---
    const resultsToUpsert: Omit<Result, 'id' | 'points' | 'created_at' | 'updated_at'>[] = [];
    for (let i = 0; i < numPlayers; i++) {
        const positionStrRaw = posColumn['csvw:cells'][i]['csvw:value'];
        const playerNameRaw = playerColumn['csvw:cells'][i]['csvw:value'];
        const scoreStrRaw = scoreColumn['csvw:cells'][i]['csvw:value'];

        // Clean Player Name
        const playerName = playerNameRaw.toLowerCase().trim();

        // Clean and Parse Position
        let position: number;
        const positionStr = positionStrRaw.replace('T', ''); // Remove 'T' for ties
        if (/^\d+$/.test(positionStr)) {
            position = parseInt(positionStr, 10);
        } else if (positionStrRaw === 'CUT' || positionStrRaw === 'WD' || positionStrRaw === 'DQ') {
            position = 0; // Assign 0 for CUT/WD/DQ
        } else {
            console.warn(`Could not parse position '${positionStrRaw}' for player ${playerName}. Skipping row.`);
            continue; // Skip this player
        }

        // Clean and Parse Score
        let score: number;
        if (scoreStrRaw === 'E') {
            score = 0;
        } else if (/^[+-]?\d+$/.test(scoreStrRaw)) {
            score = parseInt(scoreStrRaw, 10);
        } else {
             console.warn(`Could not parse score '${scoreStrRaw}' for player ${playerName}. Assigning 0.`);
             score = 0; // Assign 0 if score is not a number (e.g., WD, CUT might have non-numeric scores)
        }

        // Match Player Name
        const dbGolferId = golferNameMap.get(playerName);

        if (dbGolferId) {
            resultsToUpsert.push({
                competitionId: competition.id,
                golferId: dbGolferId,
                position: position,
                score: score,
            });
        } else {
            console.warn(`Could not find DB match for JSON golfer: ${playerNameRaw}`);
            // TODO: Consider adding logic to handle unmatched golfers
        }
    }

    console.log(`Extracted ${resultsToUpsert.length} results from JSON data.`);

    // --- Upsert Results into DB ---
    if (resultsToUpsert.length > 0) {
      console.log(`Upserting ${resultsToUpsert.length} results for competition ${competition.id}...`);
      await client.query('DELETE FROM results WHERE "competitionId" = $1', [competition.id]);
      console.log(`Deleted existing results for competition ${competition.id}.`);

      const insertQuery = `
        INSERT INTO results ("competitionId", "golferId", "position", score, points, created_at)
        VALUES ($1, $2, $3, $4, 0, NOW()) -- Insert with 0 points initially
      `;
      for (const result of resultsToUpsert) {
         await client.query(insertQuery, [result.competitionId, result.golferId, result.position, result.score]);
      }
      console.log(`Inserted ${resultsToUpsert.length} new results from scraped data.`);
    } else {
       console.log(`No results to upsert from scraped data for competition ${competition.id}.`);
    }

    // --- Update Competition Status ---
    if (isTournamentComplete && !competition.isComplete) {
      await client.query('UPDATE competitions SET "isComplete" = true, "isActive" = false WHERE id = $1', [competition.id]);
      console.log(`Marked competition ${competition.id} as complete based on scraped status.`);
      competition.isComplete = true; // Update local object state
      competition.isActive = false;
    } else if (!isTournamentComplete && competition.isComplete) {
       // Optional: Handle reactivation
       await client.query('UPDATE competitions SET "isComplete" = false, "isActive" = true WHERE id = $1', [competition.id]);
       console.log(`Marked competition ${competition.id} as active again based on scraped status.`);
       competition.isComplete = false;
       competition.isActive = true;
    }

    return true; // Indicate success

  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`Error fetching PGA Tour page for competition ${competition.id}: ${error.message}`);
    } else {
      console.error(`Error scraping or processing PGA Tour data for competition ${competition.id}:`, error);
    }
    return false; // Indicate failure
  }
}
// --- End New Function ---


// Process a single competition using Scraping data
async function processCompetition(client: PoolClient, competition: Competition): Promise<void> {
  console.log(`Processing competition: ${competition.name} (ID: ${competition.id}) using PGA Tour scraping...`);

  try {
    // Attempt to fetch and process data via scraping
    const scrapeUpdateSuccess = await fetchAndProcessPgaData(client, competition);

    if (scrapeUpdateSuccess) {
      console.log(`PGA Tour scrape processed successfully for competition ${competition.id}. Proceeding to allocate points.`);
      // Allocate points based on the potentially updated results and competition status
      await allocatePoints(client, competition.id);
    } else {
      console.error(`Failed to process ESPN data for competition ${competition.id}. Skipping point allocation.`);
      // Optionally, add fallback logic here if needed, but for now, we just skip.
    }

  } catch (error) {
    console.error(`Error processing competition ${competition.id}:`, error);
    // Don't rollback here, let the main function handle it
  }
}

// Complete a competition and finalize scores
async function completeCompetition(client: PoolClient, competitionId: number): Promise<void> {
  console.log(`Completing competition ${competitionId}...`);

  try {
    // 1. Check if results exist
    const resultsRes: QueryResult<{ id: number }> = await client.query('SELECT id FROM results WHERE "competitionId" = $1 LIMIT 1', [competitionId]);

    if (resultsRes.rows.length === 0) {
      console.log(`No results found for competition ${competitionId}. Generating final results...`);
      // Assuming golfers table has at least 'id' and 'rank' columns
      const golfersRes: QueryResult<{ id: number }> = await client.query('SELECT id FROM golfers ORDER BY rank ASC NULLS LAST LIMIT 30');
      const golfers = getRows(golfersRes);

      if (golfers.length > 0) {
        const finalResults = golfers.map((golfer, index) => ({
          competitionId: competitionId,
          golferId: golfer.id,
          position: index + 1,
          score: Math.floor(Math.random() * 20) - 10, // Random score
          points: 0 // Points calculated later
        }));

        // Use pg format for bulk insert
        const insertQuery = `
          INSERT INTO results ("competitionId", "golferId", "position", score, points, created_at)
          SELECT * FROM UNNEST ($1::int[], $2::int[], $3::int[], $4::int[], $5::int[], $6::timestamptz[])
        `;
        const values = [
          finalResults.map(r => r.competitionId),
          finalResults.map(r => r.golferId),
          finalResults.map(r => r.position),
          finalResults.map(r => r.score),
          finalResults.map(r => r.points),
          finalResults.map(() => new Date()) // Add created_at timestamp
        ];
        await client.query(insertQuery, values);
        console.log(`Generated and inserted ${finalResults.length} final results for competition ${competitionId}`);
      } else {
         console.log(`No golfers found to generate results for competition ${competitionId}`);
      }
    } else {
      console.log(`Results already exist for competition ${competitionId}. Proceeding to point allocation.`);
    }

    // 2. Mark the competition as complete
    await client.query('UPDATE competitions SET "isComplete" = true, "isActive" = false WHERE id = $1', [competitionId]);
    console.log(`Competition ${competitionId} marked as complete`);

    // 3. Calculate and allocate points
    await allocatePoints(client, competitionId); // Pass client

    console.log(`Competition ${competitionId} completed successfully`);
  } catch (error) {
    console.error(`Error completing competition ${competitionId}:`, error);
    throw error; // Re-throw to trigger rollback in main function
  }
}

// Calculate and allocate points based on results and captured ranks
async function allocatePoints(client: PoolClient, competitionId: number): Promise<void> {
  console.log(`Allocating points for competition ${competitionId}...`);

  try {
    // 1. Get results (ensure points column is selected)
    const resultsRes: QueryResult<Result> = await client.query('SELECT id, "competitionId", "golferId", position, score, points FROM results WHERE "competitionId" = $1 ORDER BY position ASC', [competitionId]);
    let results: Result[] = getRows(resultsRes); // Use let as we might update it
    if (results.length === 0) {
      console.log(`No results found for competition ${competitionId} to allocate points.`);
      return;
    }

    // 2. Get point system
    const pointSystemRes: QueryResult<PointSystemEntry> = await client.query('SELECT position, points FROM points_system');
    const pointSystem: PointSystemEntry[] = getRows(pointSystemRes);
    const pointsLookup: { [key: number]: number } = pointSystem.reduce((acc, ps) => {
      acc[ps.position] = ps.points;
      return acc;
    }, {} as { [key: number]: number });
    // Add default for position 0 (missed cut) if not present
    if (pointsLookup[0] === undefined) pointsLookup[0] = -7; 

    // --- Step 2.5: Update points in the results table ---
    console.log(`Updating points for ${results.length} golfer results...`);
    const updatedResults: Result[] = [];
    for (const result of results) {
      const calculatedPoints = pointsLookup[result.position] ?? 0; // Calculate points based on position
      // Update if points are null OR if they differ from calculated points
      if (result.points === null || result.points !== calculatedPoints) { 
        try {
          await client.query('UPDATE results SET points = $1 WHERE id = $2', [calculatedPoints, result.id]);
          console.log(`Updated points for result ID ${result.id} (Golfer ${result.golferId}) from ${result.points ?? 'NULL'} to ${calculatedPoints}`); // Log null if needed
          updatedResults.push({ ...result, points: calculatedPoints }); // Keep track of updated results
        } catch (updateError) {
           console.error(`Failed to update points for result ID ${result.id}:`, updateError);
           updatedResults.push(result); // Keep original result if update fails
        }
      } else {
        updatedResults.push(result); // Keep original result if points are already correct
      }
    }
    results = updatedResults; // Use the potentially updated results for user point calculation
    console.log('Finished updating golfer result points.');
    // --- End Step 2.5 ---


    // 3. Get selections for the competition
    const selectionsRes: QueryResult<Selection> = await client.query('SELECT * FROM selections WHERE "competitionId" = $1', [competitionId]);
    const selections: Selection[] = getRows(selectionsRes);
    console.log(`Found ${selections.length} user selections for competition ${competitionId}`);

    // 4. Get captured selection ranks for this competition
    const ranksRes: QueryResult<SelectionRankEntry> = await client.query(
      'SELECT "userId", "golferId", "rankAtDeadline" FROM selection_ranks WHERE "competitionId" = $1', 
      [competitionId]
    );
    const selectionRanksData: SelectionRankEntry[] = getRows(ranksRes);
    const rankMap = new Map<string, number>(); // Key: "userId-golferId", Value: rank
    selectionRanksData.forEach(r => rankMap.set(`${r.userId}-${r.golferId}`, r.rankAtDeadline));
    console.log(`Found ${rankMap.size} captured rank entries for competition ${competitionId}`);

    // 5. Process each selection
    for (const selection of selections) {
      let totalPoints = 0;
      const pointDetails: PointDetail[] = [];
      const golferIds = [selection.golfer1Id, selection.golfer2Id, selection.golfer3Id].filter((id): id is number => Boolean(id)); // Type guard
      const useCaptainsChip = selection.useCaptainsChip || false;

      for (const golferId of golferIds) {
        const result = results.find(r => r.golferId === golferId); // Find the updated result
        const rankAtDeadline = rankMap.get(`${selection.userId}-${golferId}`); // Get rank for this user/golfer
        let basePoints = 0;
        let position: number | string = 'N/A'; // Default position if no result

        if (result) {
          basePoints = result.points ?? 0; // Use points from result based on position
          position = result.position; 
        } else {
           // Handle case where selected golfer has no result (e.g., WD, missed cut without explicit position 0)
           basePoints = pointsLookup[0] || -7; // Assign missed cut points
           position = 'MC/WD';
        }

        // Apply rank bonus (> 50 gets double points)
        let pointsMultiplier = 1;
        let doubledPoints = false;
        if (rankAtDeadline !== undefined && rankAtDeadline > 50) {
          pointsMultiplier = 2;
          doubledPoints = true;
          console.log(`Applying x2 points for golfer ${golferId} (Rank: ${rankAtDeadline})`);
        }

        const finalPoints = basePoints * pointsMultiplier; // Points after rank bonus
        
        pointDetails.push({ 
          golferId, 
          position, 
          basePoints, 
          rankAtDeadline: rankAtDeadline ?? null, // Store rank or null
          doubledPoints, 
          finalPoints, 
          possibleCaptain: true 
        });
        totalPoints += finalPoints; // Add points after rank bonus
      }

      // Apply captain's chip bonus (based on finalPoints after rank bonus)
      if (useCaptainsChip && pointDetails.length > 0) {
        pointDetails.sort((a, b) => b.finalPoints - a.finalPoints); // Sort by finalPoints desc
        const captainGolferDetail = pointDetails[0];
        // Only double positive points (after potential rank bonus)
        if (captainGolferDetail.finalPoints > 0) { 
            const additionalPoints = captainGolferDetail.finalPoints; // Captain bonus is based on points *after* rank bonus
            console.log(`Captain's chip used on golfer ${captainGolferDetail.golferId} with ${captainGolferDetail.finalPoints} points (after rank bonus), adding ${additionalPoints} more points`);
            captainGolferDetail.isCaptain = true;
            captainGolferDetail.captainPoints = additionalPoints;
            totalPoints += additionalPoints; // Add captain bonus to total
        } else {
             console.log(`Captain's chip not applied as highest scoring golfer (${captainGolferDetail.golferId}) had ${captainGolferDetail.finalPoints} points.`); // Use captainGolferDetail
        }
      }

      console.log(`User ${selection.userId} earned a total of ${totalPoints} points for competition ${competitionId}`);

      // Upsert user points
      const upsertQuery = `
        INSERT INTO user_points ("userId", "competitionId", points, details, created_at, updated_at)
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        ON CONFLICT ("userId", "competitionId")
        DO UPDATE SET
          points = EXCLUDED.points,
          details = EXCLUDED.details,
          updated_at = NOW()
      `;
      await client.query(upsertQuery, [selection.userId, competitionId, totalPoints, JSON.stringify(pointDetails)]);
      console.log(`Upserted points for user ${selection.userId} in competition ${competitionId}`);
    }

    console.log(`Points allocation completed for competition ${competitionId}`);
  } catch (error) {
    console.error(`Error allocating points for competition ${competitionId}:`, error);
    throw error; // Re-throw to trigger rollback in main function
  }
}

// Standalone execution block can be added here if needed, ensuring 'pool' is imported/created
// Example:
/*
import { pool } from '../server/db'; // Assuming db.ts exports the pool

if (require.main === module) {
  const competitionIdArg = process.argv[2] ? parseInt(process.argv[2], 10) : null;
  if (process.argv[2] && isNaN(competitionIdArg)) {
    console.error('Invalid Competition ID provided.');
    process.exit(1);
  }

  updateResultsAndAllocatePoints(pool, competitionIdArg)
    .then(() => {
      console.log('Script finished successfully.');
      pool.end(); // End the pool when script finishes
    })
    .catch(error => {
      console.error('Script failed:', error);
      pool.end(); // Ensure pool is closed on error
      process.exit(1);
    });
}
*/
