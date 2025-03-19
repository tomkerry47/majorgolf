import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import * as readline from 'readline';

// Get Supabase credentials from environment
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-supabase-url.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'your-supabase-anon-key';

// Prepare point system data based on the requirements
const POINT_SYSTEM_DATA = [
  { position: 1, points: 25 },    // Winner: 25 points
  { position: 2, points: 15 },    // Positions 2-5: 15 points (entry for position 2)
  { position: 3, points: 15 },    // Position 3
  { position: 4, points: 15 },    // Position 4
  { position: 5, points: 15 },    // Position 5
  { position: 6, points: 10 },    // Positions 6-10: 10 points (entry for position 6)
  { position: 7, points: 10 },    // Position 7
  { position: 8, points: 10 },    // Position 8
  { position: 9, points: 10 },    // Position 9
  { position: 10, points: 10 },   // Position 10
  { position: 11, points: 5 },    // Positions 11-20: 5 points (entry for position 11)
  { position: 12, points: 5 },    // Position 12
  { position: 13, points: 5 },    // Position 13
  { position: 14, points: 5 },    // Position 14
  { position: 15, points: 5 },    // Position 15
  { position: 16, points: 5 },    // Position 16
  { position: 17, points: 5 },    // Position 17
  { position: 18, points: 5 },    // Position 18
  { position: 19, points: 5 },    // Position 19
  { position: 20, points: 5 },    // Position 20
  { position: 21, points: 1 },    // Positions 21-30: 1 point (entry for position 21)
  { position: 22, points: 1 },    // Position 22
  { position: 23, points: 1 },    // Position 23
  { position: 24, points: 1 },    // Position 24
  { position: 25, points: 1 },    // Position 25
  { position: 26, points: 1 },    // Position 26
  { position: 27, points: 1 },    // Position 27
  { position: 28, points: 1 },    // Position 28
  { position: 29, points: 1 },    // Position 29
  { position: 30, points: 1 },    // Position 30
  { position: 0, points: -7 }     // Missed cut: -7 points
];

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Initialize points system
async function initializePointsSystem() {
  console.log('Starting points system initialization...');
  
  try {
    // Check if points_system table exists and has data
    const { data: existingPoints, error: checkError } = await supabase
      .from('points_system')
      .select('*');
      
    if (checkError) {
      console.error('Error checking points_system table:', checkError);
      return;
    }
    
    // Non-interactive mode for automation (no user prompts)
    if (existingPoints && existingPoints.length > 0) {
      console.log(`Points system already has ${existingPoints.length} entries.`);
      
      // Delete existing entries automatically - using position since there's no id column
      const { error: deleteError } = await supabase
        .from('points_system')
        .delete()
        .gte('position', 0); // Delete all entries by position
      
      if (deleteError) {
        console.error('Error deleting existing entries:', deleteError);
        return;
      }
      
      console.log('Existing points system entries deleted.');
    }
    
    // Insert all point system entries
    const { data, error: insertError } = await supabase
      .from('points_system')
      .upsert(POINT_SYSTEM_DATA)
      .select();
    
    if (insertError) {
      console.error('Error initializing points system:', insertError);
      return;
    }
    
    console.log('Points system initialized successfully with entries for all positions!');
    console.log(`Total entries created: ${data.length}`);
    
    // Display summary of point system
    console.log('\nPoints breakdown by position:');
    console.log('Position 1 (Winner): 25 points');
    console.log('Positions 2-5: 15 points each');
    console.log('Positions 6-10: 10 points each');
    console.log('Positions 11-20: 5 points each');
    console.log('Positions 21-30: 1 point each');
    console.log('Missed Cut (position 0): -7 points');
    
  } catch (error) {
    console.error('Unexpected error:', error);
  } finally {
    // End the process explicitly
    process.exit(0);
  }
}

// Run the initialization
initializePointsSystem();