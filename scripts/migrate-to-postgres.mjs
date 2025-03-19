// Migration script to transfer data from Supabase to direct PostgreSQL
import dotenv from 'dotenv';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

dotenv.config();

// Supabase credentials
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// PostgreSQL connection
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Create database clients
const db = {
  query: (text, params) => pool.query(text, params)
};

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Tables to migrate
const TABLES = [
  { name: 'users', primaryKey: 'id' },
  { name: 'competitions', primaryKey: 'id' },
  { name: 'golfers', primaryKey: 'id' },
  { name: 'selections', primaryKey: 'id' },
  { name: 'results', primaryKey: 'id' },
  { name: 'points_system', primaryKey: 'id' },
  { name: 'user_points', primaryKey: 'id' }
];

// Function to hash passwords for users
async function hashUserPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

// Function to migrate a single table
async function migrateTable(tableName, primaryKey) {
  try {
    console.log(`\n=== Migrating table: ${tableName} ===`);
    
    // 1. Get data from Supabase
    const { data: supabaseData, error } = await supabase
      .from(tableName)
      .select('*');
    
    if (error) {
      console.error(`Error fetching data from Supabase for ${tableName}:`, error);
      return false;
    }
    
    console.log(`Found ${supabaseData.length} records in Supabase ${tableName}`);
    
    // 2. Check if data exists in PostgreSQL
    const pgResult = await db.query(`SELECT COUNT(*) FROM ${tableName}`);
    const pgCount = parseInt(pgResult.rows[0].count);
    
    console.log(`Found ${pgCount} records in PostgreSQL ${tableName}`);
    
    // 3. Handle users table specially to hash passwords
    if (tableName === 'users') {
      for (const user of supabaseData) {
        if (user.password) {
          user.password = await hashUserPassword(user.password);
        }
      }
    }
    
    // 4. Clear existing data if any and if we have Supabase data
    if (supabaseData.length > 0 && pgCount > 0) {
      console.log(`Clearing existing data from PostgreSQL ${tableName}...`);
      await db.query(`TRUNCATE ${tableName} RESTART IDENTITY CASCADE`);
    } else if (supabaseData.length === 0) {
      console.log(`No data to migrate for ${tableName}, skipping...`);
      return true;
    }
    
    // 5. Insert data into PostgreSQL
    let successCount = 0;
    for (const record of supabaseData) {
      // Extract fields and values
      const fields = Object.keys(record).filter(key => record[key] !== null);
      const values = fields.map(field => record[field]);
      const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');
      
      const insertQuery = `
        INSERT INTO ${tableName} (${fields.join(', ')})
        VALUES (${placeholders})
        ON CONFLICT (${primaryKey}) DO UPDATE
        SET ${fields.map((field, i) => `${field} = $${i + 1}`).join(', ')}
      `;
      
      try {
        await db.query(insertQuery, values);
        successCount++;
      } catch (insertError) {
        console.error(`Error inserting record into PostgreSQL ${tableName}:`, insertError);
        console.error('Record:', record);
      }
    }
    
    console.log(`Successfully migrated ${successCount}/${supabaseData.length} records for ${tableName}`);
    return true;
    
  } catch (error) {
    console.error(`Error migrating table ${tableName}:`, error);
    return false;
  }
}

// Function to check if database connection is working
async function checkDatabaseConnection() {
  try {
    // Check PostgreSQL connection
    const pgResult = await db.query('SELECT NOW()');
    console.log('PostgreSQL connection successful:', pgResult.rows[0].now);
    
    // Check Supabase connection
    const { data, error } = await supabase.from('users').select('count(*)');
    if (error) throw error;
    console.log('Supabase connection successful');
    
    return true;
  } catch (error) {
    console.error('Database connection check failed:', error);
    return false;
  }
}

// Main migration function
async function runMigration() {
  try {
    console.log('Starting migration from Supabase to PostgreSQL...');
    
    // 1. Check database connections
    const connectionStatus = await checkDatabaseConnection();
    if (!connectionStatus) {
      console.error('Database connection check failed, aborting migration.');
      return;
    }
    
    // 2. Migrate each table
    const results = [];
    for (const table of TABLES) {
      const success = await migrateTable(table.name, table.primaryKey);
      results.push({ table: table.name, success });
    }
    
    // 3. Print summary
    console.log('\n=== Migration Summary ===');
    for (const result of results) {
      console.log(`${result.table}: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    }
    
    console.log('\nMigration completed!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    // Close database connections
    await pool.end();
    process.exit(0);
  }
}

// Run the migration
runMigration();