import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const { Client } = pg;
dotenv.config();

// Neon database (source)
const sourceClient = new Client({
  connectionString: process.env.DATABASE_URL,
});

// Supabase connection (destination)
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function migrateTable(tableName, columns) {
  console.log(`Migrating table: ${tableName}`);
  
  try {
    // Get all column names from the database with their actual case
    const columnInfoQuery = await sourceClient.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = $1
    `, [tableName]);
    
    if (columnInfoQuery.rows.length === 0) {
      console.error(`Table ${tableName} not found or has no columns`);
      return;
    }
    
    // Map our requested columns to the actual column names with correct case
    const actualColumns = columnInfoQuery.rows.map(row => row.column_name);
    console.log(`Actual columns in ${tableName}:`, actualColumns);
    
    const columnsWithCorrectCase = columns.map(col => {
      // Find the actual column with the same name (case-insensitive)
      const actualCol = actualColumns.find(
        actualCol => actualCol.toLowerCase() === col.toLowerCase()
      );
      if (!actualCol) {
        console.warn(`Column ${col} not found in table ${tableName}`);
      }
      return actualCol || col; // Fallback to original if not found
    });
    
    // Log the mapped columns to debug
    console.log(`Using columns for ${tableName}:`, columnsWithCorrectCase);
    
    // Create a query with quoted column names to preserve case sensitivity
    const quotedColumns = columnsWithCorrectCase.map(col => `"${col}"`);
    console.log(`SQL Query: SELECT ${quotedColumns.join(',')} FROM ${tableName}`);
    
    // Get all data from source with correct column case
    const result = await sourceClient.query(`SELECT ${quotedColumns.join(',')} FROM ${tableName}`);
    let rows = result.rows;
    
    if (rows.length === 0) {
      console.log(`No data to migrate for table: ${tableName}`);
      return;
    }
    
    console.log(`Found ${rows.length} rows to migrate for table: ${tableName}`);
    
    // Transform the data to be compatible with Supabase schema
    rows = await transformDataForSupabase(tableName, rows);
    
    if (rows.length === 0) {
      console.log(`No rows to migrate after transformation for table: ${tableName}`);
      return;
    }
    
    // Insert into Supabase in batches to avoid rate limits
    const BATCH_SIZE = 50;
    let successCount = 0;
    
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      console.log(`Migrating batch ${i/BATCH_SIZE + 1} of ${Math.ceil(rows.length/BATCH_SIZE)} for ${tableName}`);
      
      // Get column names from the first row to ensure we're only inserting valid columns
      if (batch.length > 0) {
        const validColumns = Object.keys(batch[0]);
        console.log(`Using columns for insert: ${validColumns.join(', ')}`);
      }
      
      const { data, error } = await supabaseAdmin
        .from(tableName)
        .insert(batch);
      
      if (error) {
        console.error(`Error migrating batch ${i/BATCH_SIZE + 1} for ${tableName}:`, error);
      } else {
        successCount += batch.length;
        console.log(`Successfully migrated batch ${i/BATCH_SIZE + 1} (${successCount}/${rows.length} rows)`);
      }
      
      // Add a small delay between batches to avoid rate limits
      if (i + BATCH_SIZE < rows.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`Migration complete for ${tableName}: ${successCount}/${rows.length} rows migrated`);
    
  } catch (err) {
    console.error(`Migration error for ${tableName}:`, err);
  }
}

async function transformDataForSupabase(table, rows) {
  // This function will transform row data for compatibility with Supabase
  let transformedRows = [...rows];

  switch (table) {
    case 'users':
      // Remove avatarUrl and password as they're not in the Supabase schema
      transformedRows = rows.map(row => {
        const { avatarUrl, password, ...rest } = row;
        return rest;
      });
      break;
      
    case 'golfers':
      // Remove avatarUrl if it's not in the Supabase schema
      transformedRows = rows.map(row => {
        const { avatarUrl, ...rest } = row;
        return rest;
      });
      break;
      
    case 'selections':
      // Ensure IDs are in the correct format (UUID or integer)
      // For now, we'll skip this table due to UUID issues
      transformedRows = [];
      console.log('Skipping selections table due to ID type mismatch (UUID issue)');
      break;
  }

  return transformedRows;
}

async function clearExistingData(tableName) {
  console.log(`Clearing existing data from ${tableName} table...`);
  const { error } = await supabaseAdmin
    .from(tableName)
    .delete()
    .neq('id', 0); // This will delete all rows
    
  if (error) {
    console.error(`Error clearing data from ${tableName}:`, error);
    return false;
  }
  
  console.log(`Successfully cleared data from ${tableName}`);
  return true;
}

async function runMigration() {
  try {
    console.log('Starting migration to Supabase...');
    await sourceClient.connect();
    
    // Define tables to migrate in the correct order (respecting foreign keys)
    const migrations = [
      { 
        table: 'users', 
        columns: ['id', 'email', 'username', 'fullName', 'isAdmin', 'createdAt'],
        clearFirst: true 
      },
      { 
        table: 'golfers', 
        columns: ['id', 'name', 'rank'],
        clearFirst: true 
      },
      { 
        table: 'competitions', 
        columns: ['id', 'name', 'venue', 'startDate', 'endDate', 'selectionDeadline', 'isActive', 'isComplete', 'description', 'imageUrl'],
        clearFirst: true 
      },
      { 
        table: 'points_system', 
        columns: ['position', 'points'],
        clearFirst: true 
      },
      // We'll handle these tables separately due to ID type issues
      // { table: 'selections', columns: ['id', 'userId', 'competitionId', 'golfer1Id', 'golfer2Id', 'golfer3Id', 'createdAt', 'updatedAt'] },
      // { table: 'results', columns: ['id', 'competitionId', 'golferId', 'position', 'points'] },
    ];
    
    // Migrate each table
    for (const migration of migrations) {
      // Clear existing data if specified
      if (migration.clearFirst) {
        const cleared = await clearExistingData(migration.table);
        if (!cleared) {
          console.log(`Skipping ${migration.table} due to clearing failure`);
          continue;
        }
      }
      
      await migrateTable(migration.table, migration.columns);
    }
    
    console.log('Migration complete!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await sourceClient.end();
  }
}

runMigration();