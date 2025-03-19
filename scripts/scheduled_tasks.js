import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { updateResultsAndAllocatePoints } from './update_results_and_allocate_points.js';

// Get Supabase credentials from environment
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Main function to run scheduled tasks
async function runScheduledTasks() {
  console.log('Starting scheduled tasks execution...');
  console.log('Current time:', new Date().toISOString());
  
  try {
    // 1. Update tournament results and allocate points
    await updateResultsAndAllocatePoints();
    
    // 2. Add more scheduled tasks here as needed
    // For example: cleanupOldData(), sendNotifications(), etc.
    
    console.log('All scheduled tasks completed successfully.');
  } catch (error) {
    console.error('Error running scheduled tasks:', error);
  }
}

// Execute the main function
runScheduledTasks()
  .then(() => {
    console.log('Scheduled tasks script completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Scheduled tasks script failed with error:', error);
    process.exit(1);
  });