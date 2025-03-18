// Direct selections test script
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Initialize Supabase client with explicit values
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Log Supabase connection details
console.log(`Testing selections with Supabase URL: ${supabaseUrl}`);

async function executeRawQuery() {
  try {
    console.log('Testing direct selection creation...');
    
    // Use direct SQL to create a selection
    const { data, error } = await supabase.rpc('create_selection', {
      user_id: 1,
      competition_id: 1,
      golfer1_id: 1,
      golfer2_id: 2, 
      golfer3_id: 3
    });
    
    if (error) {
      console.error('Error executing RPC:', error);
      
      // As fallback, try a direct SQL insert
      console.log('Attempting a direct SQL insert...');
      
      // Try to list the contents of the selections table
      const { data: sqlData, error: sqlError } = await supabase
        .from('selections')
        .select('id, userId, competitionId')
        .limit(5);
      
      if (sqlError) {
        console.error('Error with SQL query:', sqlError);
      } else {
        console.log('Selection count query result:', sqlData);
      }
    } else {
      console.log('Selection created successfully via RPC:', data);
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

// Perform direct SQL check of the database structure
async function dumpDatabaseInfo() {
  try {
    // Directly test what tables are available
    console.log("Checking available tables...");
    
    // Try users table
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id')
      .limit(1);
      
    console.log("Users table query:", usersError ? "ERROR" : `SUCCESS - ${users?.length} records`);
    
    // Try selections table
    const { data: selections, error: selectionsError } = await supabase
      .from('selections')
      .select('id')
      .limit(1);
      
    console.log("Selections table query:", selectionsError ? "ERROR" : `SUCCESS - ${selections?.length} records`);
    
    // Try competitions table
    const { data: competitions, error: competitionsError } = await supabase
      .from('competitions')
      .select('id')
      .limit(1);
      
    console.log("Competitions table query:", competitionsError ? "ERROR" : `SUCCESS - ${competitions?.length} records`);
    
    // Try golfers table
    const { data: golfers, error: golfersError } = await supabase
      .from('golfers')
      .select('id')
      .limit(1);
      
    console.log("Golfers table query:", golfersError ? "ERROR" : `SUCCESS - ${golfers?.length} records`);
  } catch (err) {
    console.error('Unexpected error during database inspection:', err);
  }
}

// Try to create a selection using the ORM approach
async function createSelectionWithORM() {
  try {
    // Let's try with camelCase column names as defined in our schema
    const { data, error } = await supabase
      .from('selections')
      .insert({
        userId: 1,
        competitionId: 1,
        golfer1Id: 1,
        golfer2Id: 2,
        golfer3Id: 3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      .select('id');
    
    if (error) {
      console.error('Error inserting selection with ORM:', error);
    } else {
      console.log('Selection created with ORM:', data);
    }
  } catch (err) {
    console.error('Unexpected error with ORM approach:', err);
  }
}

// Run tests
async function runTests() {
  await dumpDatabaseInfo();
  await executeRawQuery();
  await createSelectionWithORM();
}

runTests();