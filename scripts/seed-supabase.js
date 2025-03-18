import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Supabase connection
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Sample data for seeding
const users = [
  {
    // No id for Supabase as it will be auto-generated as UUID
    email: 'thomaskerry@me.com',
    username: 'thomaskerry',
    fullName: 'Thomas Kerry',
    isAdmin: true,
    createdAt: new Date().toISOString()
  },
  {
    email: 'demo@example.com',
    username: 'demoplayer',
    fullName: 'Demo Player',
    isAdmin: false,
    createdAt: new Date().toISOString()
  }
];

const golfers = [
  { id: 1, name: 'Scottie Scheffler', rank: 1 },
  { id: 2, name: 'Rory McIlroy', rank: 2 },
  { id: 3, name: 'Xander Schauffele', rank: 3 },
  { id: 4, name: 'Wyndham Clark', rank: 4 },
  { id: 5, name: 'Ludvig Åberg', rank: 5 },
  { id: 6, name: 'Viktor Hovland', rank: 6 },
  { id: 7, name: 'Bryson DeChambeau', rank: 7 },
  { id: 8, name: 'Jon Rahm', rank: 8 },
  { id: 9, name: 'Patrick Cantlay', rank: 9 },
  { id: 10, name: 'Collin Morikawa', rank: 10 }
];

const competitions = [
  {
    id: 1,
    name: 'The Masters',
    venue: 'Augusta National Golf Club',
    startDate: '2025-04-10T00:00:00.000Z',
    endDate: '2025-04-13T00:00:00.000Z',
    selectionDeadline: '2025-04-09T23:59:59.000Z',
    isActive: false,
    isComplete: false,
    description: 'The Masters Tournament is one of the four major championships in professional golf.',
    imageUrl: 'https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3'
  },
  {
    id: 2,
    name: 'PGA Championship',
    venue: 'TPC Harding Park',
    startDate: '2025-05-15T00:00:00.000Z',
    endDate: '2025-05-18T00:00:00.000Z',
    selectionDeadline: '2025-05-14T23:59:59.000Z',
    isActive: false,
    isComplete: false,
    description: 'The PGA Championship is an annual golf tournament conducted by the Professional Golfers Association of America.',
    imageUrl: 'https://images.unsplash.com/photo-1535131749006-b7d58e945025?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3'
  }
];

const pointsSystem = [
  { position: 1, points: 100 },
  { position: 2, points: 80 },
  { position: 3, points: 70 },
  { position: 4, points: 60 },
  { position: 5, points: 50 },
  { position: 6, points: 45 },
  { position: 7, points: 40 },
  { position: 8, points: 35 },
  { position: 9, points: 30 },
  { position: 10, points: 25 },
  { position: 11, points: 20 },
  { position: 12, points: 18 },
  { position: 13, points: 16 },
  { position: 14, points: 14 },
  { position: 15, points: 12 },
  { position: 16, points: 10 },
  { position: 17, points: 9 },
  { position: 18, points: 8 },
  { position: 19, points: 7 },
  { position: 20, points: 6 },
  { position: 21, points: 5 },
  { position: 22, points: 4 },
  { position: 23, points: 3 },
  { position: 24, points: 2 },
  { position: 25, points: 1 }
];

// Clear and insert data for a table
async function seedTable(tableName, data) {
  console.log(`Seeding table: ${tableName}`);
  
  try {
    // Clear existing data based on table type
    console.log(`Clearing existing data from ${tableName}`);
    let deleteError = null;
    
    if (tableName === 'points_system') {
      // Points system has position as primary key
      const { error } = await supabase
        .from(tableName)
        .delete()
        .gte('position', 0);
      deleteError = error;
    } else if (tableName === 'users') {
      // Skip deletion of users table since we shouldn't delete existing users
      console.log('Skipping deletion of users table to preserve existing accounts');
    } else {
      // For tables with regular id column
      const { error } = await supabase
        .from(tableName)
        .delete()
        .not('id', 'is', null);
      deleteError = error;
    }
    
    if (deleteError) {
      console.error(`Error clearing data from ${tableName}:`, deleteError);
    }
    
    // Insert new data
    console.log(`Inserting ${data.length} rows into ${tableName}`);
    
    // Insert in batches of 50 to avoid rate limits
    const BATCH_SIZE = 50;
    let successCount = 0;
    
    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      const batch = data.slice(i, i + BATCH_SIZE);
      
      // Use upsert for points_system to handle existing entries
      let error = null;
      
      if (tableName === 'points_system') {
        const { error: upsertError } = await supabase
          .from(tableName)
          .upsert(batch, { onConflict: 'position' });
        error = upsertError;
      } else {
        const { error: insertError } = await supabase
          .from(tableName)
          .insert(batch);
        error = insertError;
      }
      
      if (error) {
        console.error(`Error inserting batch ${i/BATCH_SIZE + 1} into ${tableName}:`, error);
      } else {
        successCount += batch.length;
        console.log(`Successfully inserted batch ${i/BATCH_SIZE + 1} (${successCount}/${data.length} rows)`);
      }
      
      // Add a small delay between batches
      if (i + BATCH_SIZE < data.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`Seeding complete for ${tableName}: ${successCount}/${data.length} rows inserted`);
  } catch (err) {
    console.error(`Error seeding ${tableName}:`, err);
  }
}

async function runSeeding() {
  try {
    console.log('Starting seeding process...');
    
    // Seed tables in order (respecting foreign keys)
    await seedTable('users', users);
    await seedTable('golfers', golfers);
    await seedTable('competitions', competitions);
    await seedTable('points_system', pointsSystem);
    
    console.log('Seeding complete!');
  } catch (err) {
    console.error('Seeding failed:', err);
  }
}

runSeeding();