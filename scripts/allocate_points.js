// Script to allocate points to users based on their selections and tournament results
require('dotenv').config();
const { db } = require('../server/db.js');

async function allocatePointsForCompetition(competitionId) {
  try {
    console.log(`Allocating points for competition ID: ${competitionId}`);
    
    // 1. Get all selections for this competition
    const selections = await db.query(
      `SELECT * FROM selections WHERE "competitionId" = $1`,
      [competitionId]
    );
    
    if (selections.rows.length === 0) {
      console.log(`No selections found for competition ID ${competitionId}`);
      return;
    }
    
    console.log(`Found ${selections.rows.length} selections for competition ID ${competitionId}`);
    
    // 2. Get all results for this competition
    const results = await db.query(
      `SELECT * FROM results WHERE "competitionId" = $1 ORDER BY position`,
      [competitionId]
    );
    
    if (results.rows.length === 0) {
      console.log(`No results found for competition ID ${competitionId}`);
      return;
    }
    
    console.log(`Found ${results.rows.length} results for competition ID ${competitionId}`);
    
    // 3. Process each user's selections and calculate points
    for (const selection of selections.rows) {
      let totalPoints = 0;
      const pointDetails = [];
      
      // Get points for each selected golfer
      const golfer1Result = results.rows.find(r => r.golferId === selection.golfer1Id);
      const golfer2Result = results.rows.find(r => r.golferId === selection.golfer2Id);
      const golfer3Result = results.rows.find(r => r.golferId === selection.golfer3Id);
      
      // Get golfer names for details
      const golfer1 = await db.query('SELECT name FROM golfers WHERE id = $1', [selection.golfer1Id]);
      const golfer2 = await db.query('SELECT name FROM golfers WHERE id = $1', [selection.golfer2Id]);
      const golfer3 = await db.query('SELECT name FROM golfers WHERE id = $1', [selection.golfer3Id]);
      
      if (golfer1Result) {
        totalPoints += golfer1Result.points || 0;
        pointDetails.push({
          golferId: selection.golfer1Id,
          golferName: golfer1.rows[0]?.name || 'Unknown',
          position: golfer1Result.position,
          points: golfer1Result.points || 0
        });
      }
      
      if (golfer2Result) {
        totalPoints += golfer2Result.points || 0;
        pointDetails.push({
          golferId: selection.golfer2Id,
          golferName: golfer2.rows[0]?.name || 'Unknown',
          position: golfer2Result.position,
          points: golfer2Result.points || 0
        });
      }
      
      if (golfer3Result) {
        totalPoints += golfer3Result.points || 0;
        pointDetails.push({
          golferId: selection.golfer3Id,
          golferName: golfer3.rows[0]?.name || 'Unknown',
          position: golfer3Result.position,
          points: golfer3Result.points || 0
        });
      }
      
      // Check if user already has points for this competition
      const existingPoints = await db.query(
        `SELECT * FROM user_points WHERE "userId" = $1 AND "competitionId" = $2`,
        [selection.userId, competitionId]
      );
      
      if (existingPoints.rows.length > 0) {
        // Update existing record
        await db.query(
          `UPDATE user_points SET points = $1, details = $2, updated_at = NOW() 
           WHERE "userId" = $3 AND "competitionId" = $4`,
          [totalPoints, JSON.stringify(pointDetails), selection.userId, competitionId]
        );
        console.log(`Updated points for user ID ${selection.userId}: ${totalPoints}`);
      } else {
        // Create new record
        await db.query(
          `INSERT INTO user_points ("userId", "competitionId", points, details, created_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW(), NOW())`,
          [selection.userId, competitionId, totalPoints, JSON.stringify(pointDetails)]
        );
        console.log(`Created points for user ID ${selection.userId}: ${totalPoints}`);
      }
    }
    
    console.log(`Point allocation completed for competition ID ${competitionId}`);
    
    // 4. Mark competition as complete
    await db.query(
      `UPDATE competitions SET "isComplete" = true WHERE id = $1`,
      [competitionId]
    );
    console.log(`Marked competition ID ${competitionId} as complete`);
    
  } catch (error) {
    console.error('Error allocating points:', error);
  }
}

async function main() {
  try {
    // The Players Championship ID = 6
    await allocatePointsForCompetition(6);
    console.log('Point allocation process completed');
  } catch (error) {
    console.error('Error in main function:', error);
  } finally {
    // Close database connection
    process.exit(0);
  }
}

main();