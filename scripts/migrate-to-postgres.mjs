// Script to migrate data from Supabase to direct PostgreSQL
import dotenv from 'dotenv';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

// Supabase credentials
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// PostgreSQL connection
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Check if the database connection is successful
async function testConnection() {
  try {
    // Test PostgreSQL connection
    const pgResult = await pool.query('SELECT NOW()');
    console.log('PostgreSQL connection successful:', pgResult.rows[0].now);
    
    // Test Supabase connection
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await supabase.from('users').select('count');
    
    if (error) {
      console.error('Database connection check failed:', error);
      return false;
    }
    
    console.log('Supabase connection successful:', data);
    return true;
  } catch (err) {
    console.error('Database connection check failed:', err);
    return false;
  }
}

// Migrate data from Supabase to PostgreSQL
async function migrateTable(tableName) {
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Fetch all data from Supabase
    const { data, error } = await supabase.from(tableName).select('*');
    
    if (error) {
      console.error(`Error fetching data from ${tableName}:`, error);
      return false;
    }
    
    console.log(`Found ${data.length} records in ${tableName}`);
    
    if (data.length === 0) {
      console.log(`Skipping empty table: ${tableName}`);
      return true;
    }
    
    // Skip clearing existing data to preserve relationships
    // await pool.query(`DELETE FROM ${tableName}`);
    
    // Get column names from the first record
    const columns = Object.keys(data[0]);
    const columnNames = columns.map(col => `"${col}"`).join(', ');
    
    // Prepare values for insertion
    for (const record of data) {
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
      const values = columns.map(col => record[col]);
      
      // Insert into PostgreSQL
      await pool.query(
        `INSERT INTO ${tableName} (${columnNames}) VALUES (${placeholders})`,
        values
      );
    }
    
    console.log(`Successfully migrated ${data.length} records to ${tableName}`);
    return true;
  } catch (err) {
    console.error(`Error migrating table ${tableName}:`, err);
    return false;
  }
}

// Disable foreign key constraints
async function disableForeignKeys() {
  try {
    await pool.query('SET session_replication_role = replica;');
    console.log('Foreign key constraints disabled');
    return true;
  } catch (err) {
    console.error('Failed to disable foreign key constraints:', err);
    return false;
  }
}

// Enable foreign key constraints
async function enableForeignKeys() {
  try {
    await pool.query('SET session_replication_role = DEFAULT;');
    console.log('Foreign key constraints enabled');
    return true;
  } catch (err) {
    console.error('Failed to enable foreign key constraints:', err);
    return false;
  }
}

// Alternative approach: Upsert data
async function upsertTable(tableName) {
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Fetch all data from Supabase
    const { data, error } = await supabase.from(tableName).select('*');
    
    if (error) {
      console.error(`Error fetching data from ${tableName}:`, error);
      return false;
    }
    
    console.log(`Found ${data.length} records in ${tableName}`);
    
    if (data.length === 0) {
      console.log(`Skipping empty table: ${tableName}`);
      return true;
    }
    
    // Get column names from the first record
    const columns = Object.keys(data[0]);
    const columnNames = columns.map(col => `"${col}"`).join(', ');
    
    // Process records in batches to avoid overwhelming the database
    const batchSize = 100;
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      
      for (const record of batch) {
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const values = columns.map(col => record[col]);
        
        const updateSet = columns
          .map((col, i) => `"${col}" = $${i + 1}`)
          .join(', ');
        
        // Upsert query
        try {
          await pool.query(
            `INSERT INTO ${tableName} (${columnNames}) 
             VALUES (${placeholders})
             ON CONFLICT (id) 
             DO UPDATE SET ${updateSet}`,
            values
          );
        } catch (err) {
          if (err.code !== '42P10') { // Not uniqueness violation
            throw err;
          }
          // Alternative approach for tables without UNIQUE constraint on id
          try {
            await pool.query(
              `INSERT INTO ${tableName} (${columnNames}) VALUES (${placeholders})`,
              values
            );
          } catch (innerErr) {
            if (innerErr.code === '23505') { // UNIQUE violation
              // Try updating instead
              const idValue = record.id;
              await pool.query(
                `UPDATE ${tableName} SET ${updateSet} WHERE id = $${columns.length + 1}`,
                [...values, idValue]
              );
            } else {
              throw innerErr;
            }
          }
        }
      }
      
      console.log(`Processed batch ${i / batchSize + 1} for ${tableName}`);
    }
    
    console.log(`Successfully migrated ${data.length} records to ${tableName}`);
    return true;
  } catch (err) {
    console.error(`Error migrating table ${tableName}:`, err);
    return false;
  }
}

// Main migration function
async function migrateData() {
  try {
    console.log('Starting migration from Supabase to PostgreSQL...');
    
    // Test connection
    const connectionOk = await testConnection();
    if (!connectionOk) {
      console.error('Database connection check failed, aborting migration.');
      return;
    }
    
    // Disable foreign key constraints
    await disableForeignKeys();
    
    // Tables to migrate in an order that respects dependencies
    const tables = [
      'points_system',  // No dependencies
      'users',          // No dependencies
      'competitions',   // No dependencies
      'golfers',        // No dependencies
      'selections',     // Depends on users, competitions, golfers
      'results',        // Depends on competitions, golfers
      'user_points'     // Depends on users, competitions
    ];
    
    // Migrate each table
    for (const table of tables) {
      console.log(`Migrating table: ${table}`);
      const success = await upsertTable(table);
      
      if (!success) {
        console.error(`Failed to migrate table: ${table}`);
      }
    }
    
    // Re-enable foreign key constraints
    await enableForeignKeys();
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    // Re-enable foreign key constraints if needed
    try {
      await enableForeignKeys();
    } catch (err) {
      console.error('Error re-enabling foreign keys:', err);
    }
    
    // Close database connection
    await pool.end();
  }
}

// Run the migration
migrateData();