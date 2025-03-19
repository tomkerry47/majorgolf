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
    
    if (!activeCompetitions || activeCompetitions.length === 0) {
      console.log('No active competitions found.');
      return;
    }
    
    console.log(`Found ${activeCompetitions.length} active competitions.`);
    
    // 2. Process each active competition
    for (const competition of activeCompetitions) {
      await processCompetition(competition);
    }
    
    console.log('Tournament results update and point allocation completed successfully.');
  } catch (error) {
    console.error('Error in updateResultsAndAllocatePoints:', error);
  }
}

// Process a single competition
async function processCompetition(competition) {
  console.log(`Processing competition: ${competition.name} (ID: ${competition.id})`);
  
  try {
    // In a real-world scenario, this is where you would fetch results from an external API
    // For this example, we'll check if we should complete the tournament based on end date
    
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
        competitionId,
        golferId: golfer.id,
        position,
        score,
        createdAt: new Date().toISOString()
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
        competitionId,
        golferId: golfer.id,
        position: index + 1,
        score: Math.floor(Math.random() * 20) - 10, // Random score between -10 and 9
        createdAt: new Date().toISOString()
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
      
      // Check results for each golfer in the selection
      const golferIds = [selection.golfer1Id, selection.golfer2Id, selection.golfer3Id].filter(Boolean);
      
      for (const golferId of golferIds) {
        const result = results.find(r => r.golferId === golferId);
        
        if (result) {
          const position = result.position;
          const points = pointsLookup[position] || 0;
          
          console.log(`User ${selection.userId} earns ${points} points for golfer ${golferId} in position ${position}`);
          totalPoints += points;
        }
      }
      
      console.log(`User ${selection.userId} earned a total of ${totalPoints} points for competition ${competitionId}`);
      
      // In a real implementation, you might want to store these points in a separate table
      // For this example, we'll just output the calculated points
    }
    
    console.log(`Points allocation completed for competition ${competitionId}`);
  } catch (error) {
    console.error(`Error allocating points for competition ${competitionId}:`, error);
  }
}

// Execute the main function if this file is run directly
if (require.main === module) {
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