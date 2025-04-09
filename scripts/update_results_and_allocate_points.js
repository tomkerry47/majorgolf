import 'dotenv/config';
// Remove Supabase client import
// import { createClient } from '@supabase/supabase-js'; 
// pgClient will be passed as an argument

// Remove Supabase client initialization
// const supabaseUrl = process.env.SUPABASE_URL;
// const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
// if (!supabaseUrl || !supabaseAnonKey) {
//   throw new Error("Supabase URL and Anon Key are required in environment variables.");
// }
// const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper to safely get rows or empty array
const getRows = (result) => result?.rows || [];

// Modified to accept the connection pool directly
export async function updateResultsAndAllocatePoints(pool, competitionIdToProcess = null) { // Changed pgClient to pool
  console.log('Starting tournament results update and point allocation...');
  // Use the passed-in pool
  const client = await pool.connect(); // Use pool directly

  try {
    await client.query('BEGIN'); // Start transaction

    let competitionsToProcess = [];

    if (competitionIdToProcess) {
      // Process only the specified competition
      console.log(`Processing specified competition ID: ${competitionIdToProcess}`);
      const compRes = await client.query('SELECT * FROM competitions WHERE id = $1', [competitionIdToProcess]);
      competitionsToProcess = getRows(compRes);
      if (competitionsToProcess.length === 0) {
        console.log(`Competition with ID ${competitionIdToProcess} not found.`);
        await client.query('ROLLBACK');
        return;
      }
    } else {
      // Process active and recently completed competitions
      // 1. Get all active competitions
      const activeCompRes = await client.query('SELECT * FROM competitions WHERE "isActive" = true');
      const activeCompetitions = getRows(activeCompRes);

      // 2. Get recently completed competitions (within the last month)
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      const recentCompRes = await client.query(
        'SELECT * FROM competitions WHERE "isComplete" = true AND "endDate" >= $1 ORDER BY "endDate" DESC',
        [oneMonthAgo]
      );
      const recentCompetitions = getRows(recentCompRes);

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

// Process a single competition
async function processCompetition(client, competition) { // Accept client as argument
  console.log(`Processing competition: ${competition.name} (ID: ${competition.id})`);

  try {
    // If competition is already complete, update the results and re-allocate points
    if (competition.isComplete) {
      console.log(`Competition ${competition.name} is already complete. Checking/updating results.`);
      const resultsRes = await client.query('SELECT * FROM results WHERE "competitionId" = $1', [competition.id]);
      const results = getRows(resultsRes);

      if (results.length === 0) {
        console.log(`No results found for completed competition ${competition.id}. Generating results...`);
        await completeCompetition(client, competition.id); // Pass client
      } else {
        console.log(`Found ${results.length} results for competition ${competition.id}. Re-allocating points...`);
        await allocatePoints(client, competition.id); // Pass client
      }
      return;
    }

    // For active competitions, check if they should be marked as complete
    const currentDate = new Date();
    const endDate = new Date(competition.endDate);

    if (currentDate >= endDate) {
      console.log(`Competition ${competition.name} has ended. Marking as complete.`);
      await completeCompetition(client, competition.id); // Pass client
    } else {
      console.log(`Competition ${competition.name} is still ongoing.`);
      // Optionally update ongoing results if needed (logic removed for simplicity as it was simulation)
      // await updateCompetitionResults(client, competition.id); // Pass client
    }
  } catch (error) {
    console.error(`Error processing competition ${competition.id}:`, error);
    // Don't rollback here, let the main function handle it
  }
}

// Complete a competition and finalize scores
async function completeCompetition(client, competitionId) { // Accept client as argument
  console.log(`Completing competition ${competitionId}...`);

  try {
    // 1. Check if results exist
    const resultsRes = await client.query('SELECT id FROM results WHERE "competitionId" = $1 LIMIT 1', [competitionId]);
    
    if (resultsRes.rows.length === 0) {
      console.log(`No results found for competition ${competitionId}. Generating final results...`);
      const golfersRes = await client.query('SELECT id FROM golfers ORDER BY rank ASC NULLS LAST LIMIT 30');
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

// Calculate and allocate points based on results
async function allocatePoints(client, competitionId) { // Accept client as argument
  console.log(`Allocating points for competition ${competitionId}...`);

  try {
    // 1. Get results
    const resultsRes = await client.query('SELECT * FROM results WHERE "competitionId" = $1 ORDER BY position ASC', [competitionId]);
    const results = getRows(resultsRes);
    if (results.length === 0) {
      console.log(`No results found for competition ${competitionId} to allocate points.`);
      return;
    }

    // 2. Get point system
    const pointSystemRes = await client.query('SELECT position, points FROM points_system');
    const pointSystem = getRows(pointSystemRes);
    const pointsLookup = pointSystem.reduce((acc, ps) => {
      acc[ps.position] = ps.points;
      return acc;
    }, {});
    // Add default for position 0 (missed cut) if not present
    if (pointsLookup[0] === undefined) pointsLookup[0] = -7; 

    // 3. Get selections
    const selectionsRes = await client.query('SELECT * FROM selections WHERE "competitionId" = $1', [competitionId]);
    const selections = getRows(selectionsRes);
    console.log(`Found ${selections.length} user selections for competition ${competitionId}`);

    // 4. Process each selection
    for (const selection of selections) {
      let totalPoints = 0;
      const pointDetails = [];
      const golferIds = [selection.golfer1Id, selection.golfer2Id, selection.golfer3Id].filter(Boolean);
      const useCaptainsChip = selection.useCaptainsChip || false;

      for (const golferId of golferIds) {
        const result = results.find(r => r.golferId === golferId);
        if (result) {
          const position = result.position;
          let points = pointsLookup[position] || 0; // Default to 0 if position not in system
          pointDetails.push({ golferId, position, points, possibleCaptain: true });
          totalPoints += points;
        } else {
           // Handle case where selected golfer has no result (e.g., WD, missed cut without explicit position 0)
           // Assign missed cut points (position 0)
           let points = pointsLookup[0] || -7; 
           pointDetails.push({ golferId, position: 'MC/WD', points, possibleCaptain: true });
           totalPoints += points;
        }
      }

      // Apply captain's chip bonus
      if (useCaptainsChip && pointDetails.length > 0) {
        pointDetails.sort((a, b) => b.points - a.points); // Sort by points desc
        const captainGolfer = pointDetails[0];
        if (captainGolfer.points > 0) { // Only double positive points
            const additionalPoints = captainGolfer.points;
            console.log(`Captain's chip used on golfer ${captainGolfer.golferId} with ${captainGolfer.points} points, adding ${additionalPoints} more points`);
            captainGolfer.isCaptain = true;
            captainGolfer.captainPoints = additionalPoints;
            totalPoints += additionalPoints;
        } else {
             console.log(`Captain's chip not applied as highest scoring golfer (${captainGolfer.golferId}) had ${captainGolfer.points} points.`);
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

// Removed standalone execution block to simplify imports for now
// If needed later, it would require importing pgClient specifically for standalone use.
