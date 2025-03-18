import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with direct values
const supabaseUrl = 'https://bgdctfdxjdpsecihqsfh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnZGN0ZmR4amRwc2VjaWhxc2ZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIyNDMzNjcsImV4cCI6MjA1NzgxOTM2N30.ZjwklXt1J4waKCE3-fq8duRkeUJnusiBu89k2zZ3Vc0';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Function to rename columns with snake_case to camelCase
async function updateColumnsToCamelCase() {
  console.log('Starting column renaming process...');

  try {
    // Users table column renames
    console.log('Renaming users table columns...');
    // Check if columns exist before attempting to rename
    const { data: usersInfo, error: usersInfoError } = await supabase.from('users').select('*').limit(1);
    
    if (usersInfoError) {
      console.error('Error accessing users table:', usersInfoError);
    } else {
      const userColumns = Object.keys(usersInfo[0] || {});
      
      if (userColumns.includes('full_name')) {
        await executeSql('ALTER TABLE users RENAME COLUMN full_name TO "fullName";');
        console.log('Renamed full_name to fullName');
      }

      if (userColumns.includes('is_admin')) {
        await executeSql('ALTER TABLE users RENAME COLUMN is_admin TO "isAdmin";');
        console.log('Renamed is_admin to isAdmin');
      }

      if (userColumns.includes('created_at')) {
        await executeSql('ALTER TABLE users RENAME COLUMN created_at TO "createdAt";');
        console.log('Renamed created_at to createdAt');
      }

      if (userColumns.includes('avatar')) {
        await executeSql('ALTER TABLE users RENAME COLUMN avatar TO "avatarUrl";');
        console.log('Renamed avatar to avatarUrl');
      }
    }

    // Competitions table column renames
    console.log('Renaming competitions table columns...');
    const { data: compsInfo, error: compsInfoError } = await supabase.from('competitions').select('*').limit(1);
    
    if (compsInfoError) {
      console.error('Error accessing competitions table:', compsInfoError);
    } else {
      const compColumns = Object.keys(compsInfo[0] || {});
      
      if (compColumns.includes('start_date')) {
        await executeSql('ALTER TABLE competitions RENAME COLUMN start_date TO "startDate";');
        console.log('Renamed start_date to startDate');
      }

      if (compColumns.includes('end_date')) {
        await executeSql('ALTER TABLE competitions RENAME COLUMN end_date TO "endDate";');
        console.log('Renamed end_date to endDate');
      }

      if (compColumns.includes('selection_deadline')) {
        await executeSql('ALTER TABLE competitions RENAME COLUMN selection_deadline TO "selectionDeadline";');
        console.log('Renamed selection_deadline to selectionDeadline');
      }

      if (compColumns.includes('is_active')) {
        await executeSql('ALTER TABLE competitions RENAME COLUMN is_active TO "isActive";');
        console.log('Renamed is_active to isActive');
      }

      if (compColumns.includes('is_complete')) {
        await executeSql('ALTER TABLE competitions RENAME COLUMN is_complete TO "isComplete";');
        console.log('Renamed is_complete to isComplete');
      }

      if (compColumns.includes('image_url')) {
        await executeSql('ALTER TABLE competitions RENAME COLUMN image_url TO "imageUrl";');
        console.log('Renamed image_url to imageUrl');
      }
    }

    // Golfers table column renames
    console.log('Renaming golfers table columns...');
    const { data: golfersInfo, error: golfersInfoError } = await supabase.from('golfers').select('*').limit(1);
    
    if (golfersInfoError) {
      console.error('Error accessing golfers table:', golfersInfoError);
    } else {
      const golferColumns = Object.keys(golfersInfo[0] || {});
      
      if (golferColumns.includes('avatar')) {
        await executeSql('ALTER TABLE golfers RENAME COLUMN avatar TO "avatarUrl";');
        console.log('Renamed avatar to avatarUrl');
      }
    }

    // Selections table column renames
    console.log('Renaming selections table columns...');
    const { data: selectionsInfo, error: selectionsInfoError } = await supabase.from('selections').select('*').limit(1);
    
    if (selectionsInfoError) {
      console.error('Error accessing selections table:', selectionsInfoError);
    } else {
      const selectionColumns = Object.keys(selectionsInfo[0] || {});
      
      if (selectionColumns.includes('user_id')) {
        await executeSql('ALTER TABLE selections RENAME COLUMN user_id TO "userId";');
        console.log('Renamed user_id to userId');
      }

      if (selectionColumns.includes('competition_id')) {
        await executeSql('ALTER TABLE selections RENAME COLUMN competition_id TO "competitionId";');
        console.log('Renamed competition_id to competitionId');
      }

      if (selectionColumns.includes('golfer1_id')) {
        await executeSql('ALTER TABLE selections RENAME COLUMN golfer1_id TO "golfer1Id";');
        console.log('Renamed golfer1_id to golfer1Id');
      }

      if (selectionColumns.includes('golfer2_id')) {
        await executeSql('ALTER TABLE selections RENAME COLUMN golfer2_id TO "golfer2Id";');
        console.log('Renamed golfer2_id to golfer2Id');
      }

      if (selectionColumns.includes('golfer3_id')) {
        await executeSql('ALTER TABLE selections RENAME COLUMN golfer3_id TO "golfer3Id";');
        console.log('Renamed golfer3_id to golfer3Id');
      }

      if (selectionColumns.includes('created_at')) {
        await executeSql('ALTER TABLE selections RENAME COLUMN created_at TO "createdAt";');
        console.log('Renamed created_at to createdAt');
      }

      if (selectionColumns.includes('updated_at')) {
        await executeSql('ALTER TABLE selections RENAME COLUMN updated_at TO "updatedAt";');
        console.log('Renamed updated_at to updatedAt');
      }
    }

    // Results table column renames
    console.log('Renaming results table columns...');
    const { data: resultsInfo, error: resultsInfoError } = await supabase.from('results').select('*').limit(1);
    
    if (resultsInfoError) {
      console.error('Error accessing results table:', resultsInfoError);
    } else {
      const resultColumns = Object.keys(resultsInfo[0] || {});
      
      if (resultColumns.includes('competition_id')) {
        await executeSql('ALTER TABLE results RENAME COLUMN competition_id TO "competitionId";');
        console.log('Renamed competition_id to competitionId');
      }

      if (resultColumns.includes('golfer_id')) {
        await executeSql('ALTER TABLE results RENAME COLUMN golfer_id TO "golferId";');
        console.log('Renamed golfer_id to golferId');
      }
    }

    console.log('Column renaming process completed successfully!');
  } catch (error) {
    console.error('Error during column renaming process:', error);
  }
}

// Helper function to execute SQL statements through Supabase
async function executeSql(sql) {
  try {
    const { data, error } = await supabase.rpc('execute_sql', { query: sql });
    
    if (error) {
      console.error(`Error executing SQL: ${sql}`, error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error(`Exception executing SQL: ${sql}`, error);
    return false;
  }
}

// Run the update function
updateColumnsToCamelCase()
  .then(() => console.log('Script completed.'))
  .catch(err => console.error('Script failed:', err));