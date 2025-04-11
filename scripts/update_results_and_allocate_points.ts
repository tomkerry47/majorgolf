import 'dotenv/config';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import axios from 'axios';
import * as cheerio from 'cheerio'; // Import cheerio
import fs from 'fs/promises'; // Import fs promises for async file writing
import Fuse from 'fuse.js'; // Import Fuse.js
import { remove as removeDiacritics } from 'diacritics'; // Import diacritics removal function

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
  waiverRank?: number | null; // Add waiverRank from schema
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
  waiverRankUsed?: number | null; // Rank used if waiver applied
  rankSource: 'deadline' | 'waiver' | 'none'; // Source of the rank used for bonus
  doubledPoints: boolean; // Was rank bonus applied?
  finalPoints: number; // Points after rank bonus (before captain)
  possibleCaptain: boolean;
  isCaptain?: boolean;
  captainPoints?: number; // Additional points from captaincy
}

// Define ProcessStatus type and export it
export type ProcessStatus =
  | { status: 'success' }
  | { status: 'mismatch'; dbName: string; fetchedName: string; cleanedFetchedName: string }
  | { status: 'error'; message: string };


// Helper to safely get rows or empty array with type safety
const getRows = <T extends QueryResultRow>(result: QueryResult<T> | undefined | null): T[] => result?.rows || []; // Added constraint

// Helper function to normalize names for fuzzy matching
const normalizeName = (name: string | null | undefined): string => {
  if (!name) return '';
  return removeDiacritics(name) // Remove accents (Åberg -> Aberg)
    .toLowerCase() // Convert to lowercase
    .replace(/[.'"]/g, '') // Remove periods, apostrophes, quotes (Ca. -> Ca)
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim(); // Trim leading/trailing spaces
};

// Modified to accept the connection pool directly with type annotation
// - Add forceUpdate parameter
// - Change return type to Promise<ProcessStatus | void>
export async function updateResultsAndAllocatePoints(pool: Pool, competitionIdToProcess: number | null = null, forceUpdate: boolean = false): Promise<ProcessStatus | void> {
  console.log(`Starting tournament results update and point allocation...${forceUpdate ? ' (Force Update Mode Active)' : ''}`);
  // Use the passed-in pool
  const client: PoolClient = await pool.connect(); // Use pool directly
  let overallStatus: ProcessStatus | void = undefined; // To store status for single competition processing

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
        // Return an error status if the specific competition wasn't found
        return { status: 'error', message: `Competition with ID ${competitionIdToProcess} not found.` };
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
      return; // Return void if no competitions
    }

    // 3. Process each competition
    for (const competition of competitionsToProcess) {
      // Pass client and forceUpdate to helper
      const status = await processCompetition(client, competition, forceUpdate);

      if (competitionIdToProcess !== null) {
        // If processing a single competition, store its status and break the loop
        overallStatus = status;
        break;
      } else {
        // If processing multiple, just log the status for this competition
        if (status.status === 'mismatch') {
          console.warn(`Competition ${competition.id} (${competition.name}) processing resulted in status: ${status.status} (DB: ${status.dbName}, Fetched: ${status.fetchedName})`);
        } else if (status.status === 'error') {
           console.error(`Competition ${competition.id} (${competition.name}) processing failed with error: ${status.message}`);
        } else {
           console.log(`Competition ${competition.id} (${competition.name}) processed with status: ${status.status}`);
        }
        // Continue to the next competition
      }
    }

    await client.query('COMMIT'); // Commit transaction
    console.log('Tournament results update and point allocation completed.');
    // Return the status if a single competition was processed, otherwise return void
    return overallStatus;

  } catch (error: any) { // Add type any
    await client.query('ROLLBACK'); // Rollback transaction on error
    const errorMessage = `Error in updateResultsAndAllocatePoints: ${error?.message || error}`;
    console.error(errorMessage, error);
    // If processing a single competition, return error status, otherwise throw
    if (competitionIdToProcess !== null) {
        return { status: 'error', message: errorMessage };
    } else {
        throw error; // Re-throw for multi-competition processing or general errors
    }
  } finally {
    client.release(); // Release client back to the pool
    // Don't end the pool here if the main app might still be running
    // await pool.end(); // Use pool directly if needed
  }
}

// --- New Function: Fetch and Process PGA Tour Data via Scraping ---
// - Add forceUpdate parameter
// - Change return type to Promise<ProcessStatus>
async function fetchAndProcessPgaData(client: PoolClient, competition: Competition, forceUpdate: boolean = false): Promise<ProcessStatus> {
  console.log(`Scraping PGA Tour data for competition: ${competition.name} (ID: ${competition.id})${forceUpdate ? ' (Forced Update)' : ''}`); // Log forceUpdate

  // Use the specific URL stored for the competition
  const url = competition.externalLeaderboardUrl;
  if (!url) {
    console.error(`External leaderboard URL is missing for competition ${competition.id}. Skipping scrape.`);
    return { status: 'error', message: `External leaderboard URL is missing for competition ${competition.id}` };
  }
  console.log(`Fetching HTML from URL: ${url}`);

  try {
    const { data: html } = await axios.get(url);
    const $ = cheerio.load(html);

    // --- Extract JSON data from script tag ---
    const scriptContent = $('#leaderboard-seo-data').html();
    if (!scriptContent) {
      console.error(`Could not find script tag with id="leaderboard-seo-data" on page: ${url}`);
      return { status: 'error', message: `Could not find script tag with id="leaderboard-seo-data" on page: ${url}` };
    }

    let leaderboardJson: any;
    try {
      leaderboardJson = JSON.parse(scriptContent);
    } catch (parseError) {
      console.error(`Failed to parse JSON from script tag:`, parseError);
      return { status: 'error', message: `Failed to parse JSON from script tag: ${parseError}` };
    }
    // Add error handling for JSON parsing failure
    if (!leaderboardJson) { // Check if leaderboardJson is null/undefined after potential parse error
        return { status: 'error', message: `Failed to parse JSON from script tag for URL: ${url}` };
    }

    // --- Extract Data from JSON ---
    const jsonData = leaderboardJson?.mainEntity?.['csvw:tableSchema']?.['csvw:columns'];
    const jsonTournamentName = leaderboardJson?.name; // Extract tournament name from JSON

    if (!jsonData || !Array.isArray(jsonData) || !jsonTournamentName) {
      console.error(`JSON data structure is not as expected. Could not find columns or tournament name.`);
      return { status: 'error', message: 'JSON data structure not as expected.' }; // Return error status
    }

    // Find columns by name
    const posColumn = jsonData.find((col: any) => col['csvw:name'] === 'POS');
    const playerColumn = jsonData.find((col: any) => col['csvw:name'] === 'PLAYER');
    const scoreColumn = jsonData.find((col: any) => col['csvw:name'] === 'TOT'); // Total score
    // const thruColumn = jsonData.find((col: any) => col['csvw:name'] === 'THRU'); // Keep for reference if needed later

    if (!posColumn || !playerColumn || !scoreColumn) { // Removed thruColumn check as it's not used for completion logic anymore
      console.error(`Could not find required columns (POS, PLAYER, TOT) in JSON data.`);
      return { status: 'error', message: 'Could not find required columns (POS, PLAYER, TOT) in JSON data.' }; // Return error status
    }

    // Check lengths
    const numPlayers = playerColumn['csvw:cells']?.length || 0;
    if (numPlayers === 0 || posColumn['csvw:cells']?.length !== numPlayers || scoreColumn['csvw:cells']?.length !== numPlayers) { // Removed thruColumn check
      console.error(`Column data length mismatch in JSON.`);
      return { status: 'error', message: 'Column data length mismatch in JSON.' }; // Return error status
    }

    // --- Determine Tournament Completion Status (Refined) ---
    let isTournamentComplete = false;
    const columns = leaderboardJson?.mainEntity?.['csvw:tableSchema']?.['csvw:columns'];
    if (Array.isArray(columns)) {
        const round4Column = columns.find((col: any) => col['csvw:name'] === 'R4');
        if (round4Column && Array.isArray(round4Column['csvw:cells'])) {
            // Considered complete if R4 column exists and has at least one score (not "-")
            isTournamentComplete = round4Column['csvw:cells'].some((cell: any) => cell['csvw:value'] !== '-');
        }
    }
    console.log(`Tournament status based on R4 scores: ${isTournamentComplete ? 'Final' : 'In Progress'}`);


    // --- Extract Current Round by checking round columns in CSVW data ---
    let extractedRound: number | null = null; 
    try {
      // const columns = leaderboardJson?.mainEntity?.['csvw:tableSchema']?.['csvw:columns']; // Already defined above
      if (Array.isArray(columns)) {
        let latestRoundWithScore = 0;
        console.log('[Round Check] Starting round column check...'); // Added log
        for (let roundNum = 4; roundNum >= 1; roundNum--) {
          const roundColName = `R${roundNum}`;
          const roundColumn = columns.find((col: any) => col['csvw:name'] === roundColName);
          if (roundColumn && Array.isArray(roundColumn['csvw:cells'])) {
            // Check if any player has a score for this round (value is not "-")
            const hasScore = roundColumn['csvw:cells'].some((cell: any) => cell['csvw:value'] !== '-');
            console.log(`[Round Check] Checked ${roundColName}. Found column: ${!!roundColumn}. Has score: ${hasScore}`); // Added log
            if (hasScore) {
              latestRoundWithScore = roundNum;
              console.log(`[Round Check] Found latest round with score: ${latestRoundWithScore}`); // Added log
              break; // Found the latest round with scores, no need to check earlier rounds
            }
          } else {
             console.log(`[Round Check] Column ${roundColName} not found or cells not an array.`); // Added log
          }
        }

        if (latestRoundWithScore > 0) {
          extractedRound = latestRoundWithScore;
          console.log(`Determined current round based on latest scores in round columns: ${extractedRound}`);
        } else {
          console.log('Could not find any scores in round columns R1-R4.');
          // If no scores found at all, but tournament isn't marked complete, maybe default to 1? Or leave null?
          // Let's leave it null for now, the logic below handles the 'complete' case.
        }
      } else {
        console.log('Could not find columns array in JSON structure.');
      }
    } catch (e) {
       console.warn('Error trying to determine round from round columns:', e);
    }

    // Determine the final round number to store, prioritizing extracted round
    let roundToStore: number | null = null; 
    if (extractedRound !== null) {
        roundToStore = extractedRound; // Use the valid extracted round first
        console.log(`Prioritizing extracted round: ${roundToStore}`);
    } else if (isTournamentComplete) {
        // Only set to 4 if extraction failed AND our refined completion check is true
        roundToStore = 4; 
        console.log(`Tournament is complete (based on R4 scores) and round extraction failed, setting round to 4 (Final Round).`);
    } else {
        console.log(`Could not determine current round from scores and tournament not complete. Leaving round as null/unchanged in DB.`);
        // roundToStore remains null
    }


    // --- Compare Tournament Names ---
    const dbCompetitionNameLower = competition.name.toLowerCase().trim();
    // Clean the JSON tournament name (e.g., remove year, "Golf Leaderboard - PGA TOUR")
    const cleanedJsonTournamentName = jsonTournamentName
        .replace(/\s+\d{4}\s+Golf Leaderboard - PGA TOUR/i, '')
        .replace(/\s+Golf Leaderboard - PGA TOUR/i, '') // Fallback if year isn't present
        .toLowerCase().trim();

    // Consider more robust matching if needed
    if (dbCompetitionNameLower !== cleanedJsonTournamentName) {
        const mismatchMessage = `Mismatch: DB competition name "${competition.name}" does not match JSON tournament name "${jsonTournamentName}" (cleaned: "${cleanedJsonTournamentName}").`;
        if (!forceUpdate) {
            console.warn(`${mismatchMessage} Skipping update for competition ${competition.id}.`);
            // Return mismatch status
            return {
                status: 'mismatch',
                dbName: competition.name,
                fetchedName: jsonTournamentName,
                cleanedFetchedName: cleanedJsonTournamentName
            };
        } else {
            console.warn(`${mismatchMessage} Proceeding with update due to forceUpdate flag.`);
            // Log warning but continue processing
        }
    } else {
        console.log(`Tournament name match confirmed: "${jsonTournamentName}"`);
    }

    // --- Fetch DB Golfers for Matching (Include shortName) ---
    const golfersRes: QueryResult<{ id: number; name: string; shortName: string | null }> = await client.query('SELECT id, name, "shortName" FROM golfers');
    const dbGolfers: { id: number; name: string; shortName: string | null }[] = getRows(golfersRes);

    // --- Prepare for Matching ---
    // 1. Exact Match Maps (using original lowercase/trimmed names)
    const golferFullNameMap = new Map<string, number>();
    const golferShortNameMap = new Map<string, number>();
    dbGolfers.forEach(g => {
        if (g.name) {
            golferFullNameMap.set(g.name.toLowerCase().trim(), g.id);
        }
        if (g.shortName) {
            golferShortNameMap.set(g.shortName.toLowerCase().trim(), g.id);
        }
    });
    console.log(`Created exact match maps for ${golferFullNameMap.size} full names and ${golferShortNameMap.size} short names.`);

    // 2. Fuzzy Match List (using normalized names)
    const normalizedDbGolfers = dbGolfers.map(g => ({
      id: g.id,
      normalizedName: normalizeName(g.name),
      normalizedShortName: normalizeName(g.shortName),
      originalName: g.name, // Keep original for logging
      originalShortName: g.shortName // Keep original for logging
    })).filter(g => g.normalizedName || g.normalizedShortName); // Ensure there's something to match against

    const fuseOptions = {
      includeScore: true,
      threshold: 0.3, // Stricter threshold (lower is stricter)
      keys: ['normalizedName', 'normalizedShortName'] // Fields to search in
    };
    const fuse = new Fuse(normalizedDbGolfers, fuseOptions);
    console.log(`Initialized Fuse.js with ${normalizedDbGolfers.length} normalized golfer entries.`);

    // --- Process JSON Data ---
    const resultsToUpsert: Omit<Result, 'id' | 'points' | 'created_at' | 'updated_at'>[] = [];
    for (let i = 0; i < numPlayers; i++) {
        const positionStrRaw = posColumn['csvw:cells'][i]['csvw:value'];
        const playerNameRaw = playerColumn['csvw:cells'][i]['csvw:value'];
        const scoreStrRaw = scoreColumn['csvw:cells'][i]['csvw:value'];

        // Clean Player Name (for exact match)
        const playerNameExact = playerNameRaw.toLowerCase().trim();
        // Normalize Player Name (for fuzzy match)
        const playerNameNormalized = normalizeName(playerNameRaw);

        // Clean and Parse Position
        let position: number;
        const positionStr = positionStrRaw.replace('T', ''); // Remove 'T' for ties
        if (/^\d+$/.test(positionStr)) {
            position = parseInt(positionStr, 10);
        } else if (positionStrRaw === 'CUT' || positionStrRaw === 'WD' || positionStrRaw === 'DQ') {
            position = 0; // Assign 0 for CUT/WD/DQ
        } else {
            console.warn(`Could not parse position '${positionStrRaw}' for player ${playerNameRaw}. Skipping row.`);
            continue; // Skip this player
        }

        // Clean and Parse Score
        let score: number;
        if (scoreStrRaw === 'E') {
            score = 0;
        } else if (/^[+-]?\d+$/.test(scoreStrRaw)) {
            score = parseInt(scoreStrRaw, 10);
        } else {
             console.warn(`Could not parse score '${scoreStrRaw}' for player ${playerNameRaw}. Assigning 0.`);
             score = 0; // Assign 0 if score is not a number (e.g., WD, CUT might have non-numeric scores)
        }

        // --- Match Player Name ---
        let dbGolferId: number | undefined = undefined;
        // Add 'override' to the possible match methods
        let matchMethod: 'exact-short' | 'exact-full' | 'fuzzy' | 'override' | 'none' = 'none';

        // 1. Try Exact Match (Short Name First)
        dbGolferId = golferShortNameMap.get(playerNameExact);
        if (dbGolferId) {
            matchMethod = 'exact-short';
        } else {
            // 2. Try Exact Match (Full Name)
            dbGolferId = golferFullNameMap.get(playerNameExact);
            if (dbGolferId) {
                matchMethod = 'exact-full';
            }
        }

        // 3. Try Fuzzy Match if no exact match found
        if (!dbGolferId && playerNameNormalized) {
            const fuseResult = fuse.search(playerNameNormalized);

            // Check if we have at least one result within the threshold
            if (fuseResult.length > 0 && fuseResult[0].score != null && fuseResult[0].score <= fuseOptions.threshold) {
                const bestMatch = fuseResult[0];
                const bestScore = bestMatch.score; // Score is guaranteed non-null here by the check above

                // Check for ambiguity: is the second result also good and very close in score?
                const isAmbiguous = fuseResult.length > 1 &&
                                    fuseResult[1].score != null &&
                                    fuseResult[1].score <= fuseOptions.threshold && // Ensure second is also within threshold
                                    (fuseResult[1].score - bestScore! < 0.01); // Check if scores are very close (Added !)

                if (!isAmbiguous) {
                    // Accept the best match if it's not ambiguous
                    dbGolferId = bestMatch.item.id;
                    matchMethod = 'fuzzy';
                    console.log(`Fuzzy match accepted for "${playerNameRaw}" -> "${bestMatch.item.originalName || bestMatch.item.originalShortName}" (ID: ${dbGolferId}, Score: ${bestScore!.toFixed(3)})`); // Added !
                } else {
                    // It's ambiguous (multiple very good matches)
                    // Add null check for second score before logging
                    const secondScoreStr = fuseResult[1]?.score?.toFixed(3) ?? 'N/A';
                    console.warn(`Ambiguous fuzzy match for "${playerNameRaw}" (Normalized: "${playerNameNormalized}"). Best score: ${bestScore!.toFixed(3)}, Second best: ${secondScoreStr}. Skipping.`); // Added !
                    console.log('Top fuzzy results:', fuseResult.slice(0, 3).map(r => ({
                        id: r.item.id,
                        name: r.item.originalName,
                        shortName: r.item.originalShortName,
                        score: r.score?.toFixed(3) ?? 'N/A' // Add null check for score display
                    })));
                }
            } else if (fuseResult.length > 0 && fuseResult[0].score != null) { // Check score is not null before logging
                 // No match met the threshold
                 console.warn(`Poor fuzzy match for "${playerNameRaw}" (Normalized: "${playerNameNormalized}"). Best score: ${fuseResult[0].score.toFixed(3)}. Skipping.`);
            }
            // If fuseResult is empty or best score is null, no warning needed here, handled by final check
        }

        // 4. Apply Manual Overrides if still no match (after exact and fuzzy attempts)
        if (!dbGolferId && playerNameNormalized) {
            const overrides: { [key: string]: number } = {
                "cam young": 627, // Force match for Cam Young -> Cameron Young (ID 627)
                // Add other specific overrides here if needed in the future
                // e.g., "some other tricky name": 123,
            };
            const overrideId = overrides[playerNameNormalized];
            if (overrideId) {
                dbGolferId = overrideId;
                matchMethod = 'override';
                console.log(`Manual override applied for "${playerNameRaw}" (Normalized: "${playerNameNormalized}") -> ID: ${dbGolferId}`);
            }
        }

        // Add to results if a match was found by any method
        if (dbGolferId) {
            resultsToUpsert.push({
                competitionId: competition.id,
                golferId: dbGolferId,
                position: position,
                score: score,
            });
        } else {
            // Log only if no match found after all attempts (exact, fuzzy, override)
            console.warn(`No DB match found for JSON golfer: "${playerNameRaw}" (Normalized: "${playerNameNormalized}") using exact, fuzzy, or override.`);
        }
    } // End of the for loop iterating through players

    console.log(`Extracted ${resultsToUpsert.length} results from JSON data.`); // This line should be outside the loop

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

    // --- Update Competition Status and Round ---
    // Prepare base update query parts
    const updateSetClauses: string[] = [];
    const updateValues: (number | boolean | null)[] = [];
    let valueIndex = 1; // Start index for parameters
    let statusChanged = false; // Flag to track if status needs update

    // Update isComplete and isActive based on the *refined* isTournamentComplete check
    if (isTournamentComplete && !competition.isComplete) {
      updateSetClauses.push(`"isComplete" = $${valueIndex++}`, `"isActive" = $${valueIndex++}`);
      updateValues.push(true, false);
      statusChanged = true; // Mark status as changed
      console.log(`Marking competition ${competition.id} as complete.`);
      competition.isComplete = true; // Update local object state
      competition.isActive = false;
    } else if (!isTournamentComplete && competition.isComplete) {
      // Optional: Handle reactivation
      updateSetClauses.push(`"isComplete" = $${valueIndex++}`, `"isActive" = $${valueIndex++}`);
      updateValues.push(false, true);
      statusChanged = true; // Mark status as changed
      console.log(`Marking competition ${competition.id} as active again.`);
      competition.isComplete = false;
      competition.isActive = true;
    }

    // Update currentRound if roundToStore has a valid value (1-4)
    let roundChanged = false; // Flag to track if round needs update
    if (roundToStore !== null) {
        // Ideally, compare with competition.currentRound if available to avoid unnecessary updates
        // For now, we update if roundToStore is not null.
        updateSetClauses.push(`"current_round" = $${valueIndex++}`);
        updateValues.push(roundToStore);
        console.log(`Setting current round to ${roundToStore} for competition ${competition.id}.`);
        roundChanged = true;
    }
    
    // Add the competition ID as the final parameter for the WHERE clause
    updateValues.push(competition.id);

    // Execute the update query only if status or round changed
    if (statusChanged || roundChanged) { 
      // updateValues already contains the values for SET clauses. 
      // The competition.id for the WHERE clause was added just before this block.
      // DO NOT add competition.id again here.
      const updateQuery = `UPDATE competitions SET ${updateSetClauses.join(', ')} WHERE id = $${valueIndex}`; // valueIndex is correct for the number of placeholders
      await client.query(updateQuery, updateValues); // Pass the correctly assembled updateValues array
      console.log(`Updated competition status/round for ID ${competition.id}.`);
    } else {
       console.log(`No status or round changes to update for competition ${competition.id}.`);
    }


    return { status: 'success' }; // Indicate success

  } catch (error: any) { // Add type any
    let errorMessage = 'Unknown error during scraping or processing.';
    if (axios.isAxiosError(error)) {
      errorMessage = `Error fetching PGA Tour page for competition ${competition.id}: ${error.message}`;
      console.error(errorMessage);
    } else if (error instanceof Error) { // Check if it's a standard Error
        errorMessage = `Error scraping or processing PGA Tour data for competition ${competition.id}: ${error.message}`;
        console.error(errorMessage, error);
    } else {
        // Handle cases where the error might not be an Error object
        errorMessage = `An unexpected error occurred during scraping for competition ${competition.id}`;
        console.error(errorMessage, error);
    }
    return { status: 'error', message: errorMessage }; // Indicate failure with error status
  }
}
// --- End New Function ---


// Process a single competition using Scraping data
// - Add forceUpdate parameter
// - Change return type to Promise<ProcessStatus>
// - Handle return status from fetchAndProcessPgaData
async function processCompetition(client: PoolClient, competition: Competition, forceUpdate: boolean = false): Promise<ProcessStatus> {
  console.log(`Processing competition: ${competition.name} (ID: ${competition.id}) using PGA Tour scraping...`);
  let processStatus: ProcessStatus; // Variable to hold the status

  try {
    // Attempt to fetch and process data via scraping, passing forceUpdate
    const scrapeResult = await fetchAndProcessPgaData(client, competition, forceUpdate);
    processStatus = scrapeResult; // Store the result status

    if (scrapeResult.status === 'success') {
      console.log(`PGA Tour scrape processed successfully for competition ${competition.id}. Proceeding to allocate points.`);
      // Allocate points based on the potentially updated results and competition status
      await allocatePoints(client, competition.id);
      // Keep status as 'success'
    } else if (scrapeResult.status === 'mismatch') {
      // Log already handled in fetchAndProcessPgaData if not forced
      console.warn(`Skipping point allocation for competition ${competition.id} due to name mismatch (confirmation needed).`);
      // Status is already 'mismatch'
    } else { // status === 'error'
      console.error(`Failed to process PGA Tour data for competition ${competition.id} due to error: ${scrapeResult.message}. Skipping point allocation.`);
      // Status is already 'error'
    }

  } catch (error: any) { // Add type any
    const errorMessage = `Error processing competition ${competition.id}: ${error?.message || error}`;
    console.error(errorMessage, error);
    processStatus = { status: 'error', message: errorMessage }; // Set error status
    // Don't rollback here, let the main function handle it
  }

  return processStatus; // Return the final status
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
// Define User interface subset needed for waiver logic
interface UserWaiverInfo {
  id: number;
  hasUsedWaiverChip: boolean;
  waiverChipUsedCompetitionId?: number | null;
  waiverChipReplacementGolferId?: number | null;
}

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


    // 3. Get selections for the competition, including waiverRank
    const selectionsRes: QueryResult<Selection> = await client.query('SELECT *, "waiverRank" FROM selections WHERE "competitionId" = $1', [competitionId]);
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

    // 4.5 Get waiver info for all relevant users
    const userIds = selections.map(s => s.userId);
    const usersWaiverInfoRes: QueryResult<UserWaiverInfo> = await client.query(
      'SELECT id, "hasUsedWaiverChip", "waiverChipUsedCompetitionId", "waiverChipReplacementGolferId" FROM users WHERE id = ANY($1::int[])',
      [userIds]
    );
    const userWaiverMap = new Map<number, UserWaiverInfo>();
    getRows(usersWaiverInfoRes).forEach(u => userWaiverMap.set(u.id, u));
    console.log(`Fetched waiver info for ${userWaiverMap.size} users.`);

    // 5. Process each selection
    for (const selection of selections) {
      let totalPoints = 0;
      const pointDetails: PointDetail[] = [];
      const golferIds = [selection.golfer1Id, selection.golfer2Id, selection.golfer3Id].filter((id): id is number => Boolean(id)); // Type guard
      const useCaptainsChip = selection.useCaptainsChip || false;
      const userWaiverInfo = userWaiverMap.get(selection.userId); // Get waiver info for this user

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

        // Determine which rank to use for bonus calculation
        let rankToUse: number | undefined | null = rankAtDeadline; // Default to deadline rank
        let rankSource: PointDetail['rankSource'] = rankAtDeadline !== undefined ? 'deadline' : 'none';
        let waiverRankUsed: number | null = null;

        if (userWaiverInfo?.hasUsedWaiverChip &&
            userWaiverInfo.waiverChipUsedCompetitionId === competitionId &&
            userWaiverInfo.waiverChipReplacementGolferId === golferId &&
            selection.waiverRank != null) // Check if waiverRank exists in the selection record
        {
          rankToUse = selection.waiverRank;
          rankSource = 'waiver';
          waiverRankUsed = selection.waiverRank;
          console.log(`Using waiver rank ${rankToUse} for golfer ${golferId} (User: ${selection.userId})`);
        }

        // Apply rank bonus (> 50 gets double points) based on rankToUse
        let pointsMultiplier = 1;
        let doubledPoints = false;
        if (rankToUse != null && rankToUse > 50) { // Use rankToUse here
          pointsMultiplier = 2;
          doubledPoints = true;
          console.log(`Applying x2 points for golfer ${golferId} (Rank: ${rankToUse}, Source: ${rankSource})`);
        }

        const finalPoints = basePoints * pointsMultiplier; // Points after rank bonus

        pointDetails.push({
          golferId,
          position,
          basePoints,
          rankAtDeadline: rankAtDeadline ?? null, // Still store deadline rank for info
          waiverRankUsed: waiverRankUsed, // Store the waiver rank if used
          rankSource, // Store the source of the rank used for bonus
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
