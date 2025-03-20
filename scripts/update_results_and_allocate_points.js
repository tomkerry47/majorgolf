import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Get Supabase credentials from environment
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// This function represents what would be called by a scheduled job
// In a production environment, this would be triggered by a cron job or similar
export async function updateResultsAndAllocatePoints() {
  console.log('Starting tournament results update and point allocation...');
  
  try {
    // 1. Get all active competitions
    const { data: activeCompetitions, error: competitionsError } = await supabase
      .from('competitions')
      .select('*')
      .eq('isActive', true);
      
    if (competitionsError) throw competitionsError;
    
    // 2. Get recently completed competitions (within the last month)
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const oneMonthAgoStr = oneMonthAgo.toISOString();
    
    const { data: recentCompetitions, error: recentCompError } = await supabase
      .from('competitions')
      .select('*')
      .eq('isComplete', true)
      .gte('endDate', oneMonthAgoStr)
      .order('endDate', { ascending: false });
      
    if (recentCompError) throw recentCompError;
    
    // Combine active and recent competitions
    let competitionsToProcess = [];
    
    if (activeCompetitions && activeCompetitions.length > 0) {
      console.log(`Found ${activeCompetitions.length} active competitions.`);
      competitionsToProcess = [...activeCompetitions];
    }
    
    if (recentCompetitions && recentCompetitions.length > 0) {
      console.log(`Found ${recentCompetitions.length} recently completed competitions.`);
      competitionsToProcess = [...competitionsToProcess, ...recentCompetitions];
    }
    
    if (competitionsToProcess.length === 0) {
      console.log('No competitions found to process.');
      return;
    }
    
    // 3. Process each competition
    for (const competition of competitionsToProcess) {
      await processCompetition(competition);
    }
    
    console.log('Tournament results update and point allocation completed successfully.');
  } catch (error) {
    console.error('Error in updateResultsAndAllocatePoints:', error);
    throw error; // Re-throw to allow caller to handle
  }
}

// Process a single competition
async function processCompetition(competition) {
  console.log(`Processing competition: ${competition.name} (ID: ${competition.id})`);
  
  try {
    // If competition is already complete, update the results and re-allocate points
    if (competition.isComplete) {
      console.log(`Competition ${competition.name} is already complete. Checking/updating results.`);
      
      // First, check if there are results
      const { data: results, error: resultsError } = await supabase
        .from('results')
        .select('*')
        .eq('competitionId', competition.id);
      
      if (resultsError) throw resultsError;
      
      if (!results || results.length === 0) {
        console.log(`No results found for completed competition ${competition.id}. Generating results...`);
        await completeCompetition(competition.id);
      } else {
        console.log(`Found ${results.length} results for competition ${competition.id}. Re-allocating points...`);
        await allocatePoints(competition.id);
      }
      
      return;
    }
    
    // For active competitions, check if they should be marked as complete
    const currentDate = new Date();
    const endDate = new Date(competition.endDate);
    
    // Check if competition has ended
    if (currentDate >= endDate) {
      console.log(`Competition ${competition.name} has ended. Marking as complete.`);
      await completeCompetition(competition.id);
    } else {
      console.log(`Competition ${competition.name} is still ongoing.`);
      await updateCompetitionResults(competition.id);
    }
  } catch (error) {
    console.error(`Error processing competition ${competition.id}:`, error);
  }
}

// Update results for an ongoing competition
async function updateCompetitionResults(competitionId) {
  console.log(`Updating results for competition ${competitionId}...`);
  
  try {
    // In a real implementation, this would fetch the latest results from an external golf API
    // For demonstration purposes, we'll simulate updating results
    
    // 1. Get existing results to avoid duplicates
    const { data: existingResults, error: resultsError } = await supabase
      .from('results')
      .select('golferId')
      .eq('competitionId', competitionId);
      
    if (resultsError) throw resultsError;
    
    // 2. Get golfers for this competition (in a real scenario, this would come from the API)
    const { data: golfers, error: golfersError } = await supabase
      .from('golfers')
      .select('*')
      .order('rank', { ascending: true })
      .limit(20); // Top 20 golfers
      
    if (golfersError) throw golfersError;
    
    // 3. Create a set of existing golfer IDs to avoid duplicates
    const existingGolferIds = new Set(existingResults.map(r => r.golferId));
    
    // 4. Filter out golfers that already have results
    const newGolfers = golfers.filter(g => !existingGolferIds.has(g.id));
    
    // 5. Simulate new results (in a real scenario, this would be real data from the external API)
    const resultsToInsert = [];
    for (let i = 0; i < newGolfers.length; i++) {
      const golfer = newGolfers[i];
      const position = i + 1;
      const score = Math.floor(Math.random() * 10) - 5; // Random score between -5 and 4
      
      resultsToInsert.push({
        "competitionId": competitionId,
        "golferId": golfer.id,
        "position": position,
        "score": score,
        "created_at": new Date().toISOString(),
        "points": 0 // Add default points value
      });
    }
    
    // 6. Insert new results
    if (resultsToInsert.length > 0) {
      console.log(`Adding ${resultsToInsert.length} new results for competition ${competitionId}`);
      const { error: insertError } = await supabase
        .from('results')
        .insert(resultsToInsert);
        
      if (insertError) throw insertError;
    } else {
      console.log(`No new results to add for competition ${competitionId}`);
    }
    
    // 7. Update existing results to simulate progress in the tournament
    console.log('Updating existing results to reflect tournament progress...');
    
    const { data: allResults, error: allResultsError } = await supabase
      .from('results')
      .select('*')
      .eq('competitionId', competitionId);
      
    if (allResultsError) throw allResultsError;
    
    // Update each result with a slightly modified position or score
    for (const result of allResults) {
      // Randomly determine if we should update this result (50% chance)
      const shouldUpdate = Math.random() > 0.5;
      
      if (shouldUpdate) {
        const updatedPosition = Math.max(1, result.position + (Math.floor(Math.random() * 3) - 1)); // Shift position by -1, 0, or +1
        const updatedScore = result.score + (Math.floor(Math.random() * 3) - 1); // Shift score by -1, 0, or +1
        
        const { error: updateError } = await supabase
          .from('results')
          .update({ position: updatedPosition, score: updatedScore })
          .eq('id', result.id);
          
        if (updateError) throw updateError;
      }
    }
    
    console.log(`Results updated successfully for competition ${competitionId}`);
  } catch (error) {
    console.error(`Error updating results for competition ${competitionId}:`, error);
  }
}

// Complete a competition and finalize scores
async function completeCompetition(competitionId) {
  console.log(`Completing competition ${competitionId}...`);
  
  try {
    // 1. Fetch the tournament results
    const { data: results, error: resultsError } = await supabase
      .from('results')
      .select('*')
      .eq('competitionId', competitionId);
    
    if (resultsError) throw resultsError;
    
    if (!results || results.length === 0) {
      console.log(`No results found for competition ${competitionId}. Generating final results...`);
      
      // If no results yet, get golfers and generate final results
      const { data: golfers, error: golfersError } = await supabase
        .from('golfers')
        .select('*')
        .order('rank', { ascending: true })
        .limit(30); // Top 30 golfers
        
      if (golfersError) throw golfersError;
      
      // Generate final results for top golfers
      const finalResults = golfers.map((golfer, index) => ({
        "competitionId": competitionId,
        "golferId": golfer.id,
        "position": index + 1,
        "score": Math.floor(Math.random() * 20) - 10, // Random score between -10 and 9
        "created_at": new Date().toISOString(),
        "points": 0 // Add default points value
      }));
      
      // Insert final results
      const { error: insertError } = await supabase
        .from('results')
        .insert(finalResults);
        
      if (insertError) throw insertError;
      
      console.log(`Generated and inserted ${finalResults.length} final results for competition ${competitionId}`);
    } else {
      // Finalize existing results if needed
      console.log(`Found ${results.length} existing results for competition ${competitionId}`);
    }
    
    // 2. Mark the competition as complete
    const { error: updateError } = await supabase
      .from('competitions')
      .update({ 
        isComplete: true,
        isActive: false
      })
      .eq('id', competitionId);
    
    if (updateError) throw updateError;
    
    console.log(`Competition ${competitionId} marked as complete`);
    
    // 3. Calculate and allocate points
    await allocatePoints(competitionId);
    
    console.log(`Competition ${competitionId} completed successfully`);
  } catch (error) {
    console.error(`Error completing competition ${competitionId}:`, error);
  }
}

// Calculate and allocate points based on results
async function allocatePoints(competitionId) {
  console.log(`Allocating points for competition ${competitionId}...`);
  
  try {
    // 1. Get the competition's results with position information
    const { data: results, error: resultsError } = await supabase
      .from('results')
      .select('*')
      .eq('competitionId', competitionId)
      .order('position', { ascending: true });
      
    if (resultsError) throw resultsError;
    
    if (!results || results.length === 0) {
      console.log(`No results found for competition ${competitionId}`);
      return;
    }
    
    // 2. Get the point system data
    const { data: pointSystem, error: pointSystemError } = await supabase
      .from('points_system')
      .select('*');
      
    if (pointSystemError) throw pointSystemError;
    
    // Create a lookup for points by position
    const pointsLookup = {};
    if (pointSystem && pointSystem.length > 0) {
      pointSystem.forEach(ps => {
        pointsLookup[ps.position] = ps.points;
      });
    } else {
      // Default points system if none exists
      const defaultPoints = [
        { position: 1, points: 25 },
        { position: 2, points: 15 },
        { position: 3, points: 15 },
        { position: 4, points: 15 },
        { position: 5, points: 15 },
        { position: 6, points: 10 },
        { position: 7, points: 10 },
        { position: 8, points: 10 },
        { position: 9, points: 10 },
        { position: 10, points: 10 },
        { position: 11, points: 5 },
        { position: 12, points: 5 },
        { position: 13, points: 5 },
        { position: 14, points: 5 },
        { position: 15, points: 5 },
        { position: 16, points: 5 },
        { position: 17, points: 5 },
        { position: 18, points: 5 },
        { position: 19, points: 5 },
        { position: 20, points: 5 },
        { position: 21, points: 1 },
        { position: 22, points: 1 },
        { position: 23, points: 1 },
        { position: 24, points: 1 },
        { position: 25, points: 1 },
        { position: 26, points: 1 },
        { position: 27, points: 1 },
        { position: 28, points: 1 },
        { position: 29, points: 1 },
        { position: 30, points: 1 },
        { position: 0, points: -7 }, // Missed cut
      ];
      
      defaultPoints.forEach(dp => {
        pointsLookup[dp.position] = dp.points;
      });
    }
    
    // 3. Get all selections for this competition
    const { data: selections, error: selectionsError } = await supabase
      .from('selections')
      .select('*')
      .eq('competitionId', competitionId);
      
    if (selectionsError) throw selectionsError;
    
    console.log(`Found ${selections.length} user selections for competition ${competitionId}`);
    
    // 4. Process each selection and calculate points
    for (const selection of selections) {
      let totalPoints = 0;
      const pointDetails = [];
      
      // Check results for each golfer in the selection
      const golferIds = [selection.golfer1Id, selection.golfer2Id, selection.golfer3Id].filter(Boolean);
      
      // Check if user has used captain's chip for this competition
      const useCaptainsChip = selection.useCaptainsChip || false;
      console.log(`User ${selection.userId} has ${useCaptainsChip ? 'used' : 'not used'} captain's chip`);
      
      for (const golferId of golferIds) {
        const result = results.find(r => r.golferId === golferId);
        
        if (result) {
          const position = result.position;
          let points = pointsLookup[position] || 0;
          
          // If captain's chip is used, double the points for only their best player
          // We'll determine this later by picking the highest scoring golfer
          pointDetails.push({
            golferId,
            position,
            points,
            // Flag this golfer for potential double points with captain's chip
            possibleCaptain: true
          });
          totalPoints += points;
        }
      }
      
      // If captain's chip is used, find the best performing golfer and double their points
      if (useCaptainsChip && pointDetails.length > 0) {
        // Sort by points in descending order
        pointDetails.sort((a, b) => b.points - a.points);
        
        // Double the points for the highest scoring golfer
        const captainGolfer = pointDetails[0];
        const additionalPoints = captainGolfer.points; // Double points means adding the same amount again
        
        console.log(`Captain's chip used on golfer ${captainGolfer.golferId} with ${captainGolfer.points} points, adding ${additionalPoints} more points`);
        
        // Update the point details to show this golfer as the captain
        captainGolfer.isCaptain = true;
        captainGolfer.captainPoints = additionalPoints;
        
        // Add these additional points to the total
        totalPoints += additionalPoints;
      }
      
      console.log(`User ${selection.userId} earned a total of ${totalPoints} points for competition ${competitionId}`);
      
      // First check if this user already has points for this competition
      const { data: existingPoints, error: existingPointsError } = await supabase
        .from('user_points')
        .select('*')
        .eq('userId', selection.userId)
        .eq('competitionId', competitionId);
        
      if (existingPointsError) {
        console.error(`Error checking for existing points for user ${selection.userId}:`, existingPointsError);
        continue;
      }
      
      // Store points in the user_points table
      if (existingPoints && existingPoints.length > 0) {
        // Update existing record
        const { error: updateError } = await supabase
          .from('user_points')
          .update({
            "points": totalPoints,
            "details": JSON.stringify(pointDetails),
            "updated_at": new Date().toISOString()
          })
          .eq('id', existingPoints[0].id);
          
        if (updateError) {
          console.error(`Error updating points for user ${selection.userId}:`, updateError);
        } else {
          console.log(`Updated points for user ${selection.userId} in competition ${competitionId}`);
        }
      } else {
        // Create new record
        const { error: insertError } = await supabase
          .from('user_points')
          .insert({
            "userId": selection.userId,
            "competitionId": competitionId,
            "points": totalPoints,
            "details": JSON.stringify(pointDetails),
            "created_at": new Date().toISOString()
          });
          
        if (insertError) {
          console.error(`Error inserting points for user ${selection.userId}:`, insertError);
        } else {
          console.log(`Inserted points for user ${selection.userId} in competition ${competitionId}`);
        }
      }
    }
    
    console.log(`Points allocation completed for competition ${competitionId}`);
  } catch (error) {
    console.error(`Error allocating points for competition ${competitionId}:`, error);
  }
}

// Execute the main function if this file is run directly
// Using import.meta.url check for ES modules instead of require.main
const isMainModule = import.meta.url.endsWith(process.argv[1]);
if (isMainModule) {
  updateResultsAndAllocatePoints()
    .then(() => {
      console.log('Script completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('Script failed with error:', error);
      process.exit(1);
    });
}