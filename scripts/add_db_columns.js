// Script to add missing columns to competitions table
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'https://hvtnnefsbstvsbnfbrlm.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2dG5uZWZzYnN0dnNibmZicmxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTA3OTUwNzYsImV4cCI6MjAyNjM3MTA3Nn0.R5aLCUDxxw3rYXmFDVacZe2Fx11TBpEWHDW4fmQD0y4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function addMissingColumns() {
  console.log('Starting database migration to add missing columns...');
  
  try {
    // Try to directly execute SQL with Supabase's functions API
    // First try to add description column
    const addDescriptionQuery = `
      ALTER TABLE competitions 
      ADD COLUMN IF NOT EXISTS description TEXT;
    `;
    
    const { error: descError } = await supabase.functions.invoke('execute-sql', {
      body: { query: addDescriptionQuery }
    });
    
    if (descError) {
      console.error('Error adding description column:', descError);
    } else {
      console.log('Successfully added description column');
    }
    
    // Now try to add image_url column
    const addImageUrlQuery = `
      ALTER TABLE competitions 
      ADD COLUMN IF NOT EXISTS image_url TEXT;
    `;
    
    const { error: imgError } = await supabase.functions.invoke('execute-sql', {
      body: { query: addImageUrlQuery }
    });
    
    if (imgError) {
      console.error('Error adding image_url column:', imgError);
    } else {
      console.log('Successfully added image_url column');
    }
    
    console.log('Database migration complete.');
  } catch (error) {
    console.error('Error during migration:', error);
  }
}

// Run the script
addMissingColumns()
  .catch(error => {
    console.error('Error in script execution:', error);
  });