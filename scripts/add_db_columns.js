import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createPool } from 'pg';

// Initialize Supabase client
const supabaseUrl = 'https://bgdctfdxjdpsecihqsfh.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize direct PostgreSQL pool for schema changes
const pool = createPool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function executeSql(sql) {
  const client = await pool.connect();
  try {
    await client.query(sql);
  } catch (error) {
    console.error(`Error executing SQL: ${sql}`, error);
    throw error;
  } finally {
    client.release();
  }
}

async function addMissingColumns() {
  try {
    console.log('Starting to add missing columns...');
    
    // Define the expected columns for each table
    const tableColumns = {
      'competitions': [
        { name: 'description', type: 'TEXT' },
        { name: 'imageUrl', type: 'TEXT' },
        { name: 'status', type: 'TEXT' },
        { name: 'maxEntrants', type: 'INTEGER' },
        { name: 'entryFee', type: 'INTEGER' },
        { name: 'prizeFund', type: 'INTEGER' }
      ],
      'users': [
        { name: 'avatarUrl', type: 'TEXT' },
        { name: 'isAdmin', type: 'BOOLEAN', default: 'FALSE' }
      ],
      'golfers': [
        { name: 'avatarUrl', type: 'TEXT' }
      ],
      'results': [
        { name: 'points', type: 'INTEGER', default: '0' }
      ]
    };
    
    // Process each table
    for (const [tableName, columns] of Object.entries(tableColumns)) {
      console.log(`Processing table: ${tableName}`);
      
      // Check if table exists
      const { data: tableExists, error: tableError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_name', tableName);
        
      if (tableError) {
        console.error(`Error checking if table ${tableName} exists:`, tableError);
        continue;
      }
      
      if (!tableExists || tableExists.length === 0) {
        console.log(`Table ${tableName} does not exist, skipping.`);
        continue;
      }
      
      // Get existing columns
      const { data: existingColumns, error: columnsError } = await supabase
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_schema', 'public')
        .eq('table_name', tableName);
        
      if (columnsError) {
        console.error(`Error fetching columns for table ${tableName}:`, columnsError);
        continue;
      }
      
      const existingColumnNames = existingColumns.map(c => c.column_name);
      
      // Add missing columns
      for (const column of columns) {
        if (!existingColumnNames.includes(column.name)) {
          console.log(`Adding column ${column.name} to table ${tableName}`);
          
          let sql = `ALTER TABLE "${tableName}" ADD COLUMN "${column.name}" ${column.type}`;
          if (column.default) {
            sql += ` DEFAULT ${column.default}`;
          }
          sql += ';';
          
          await executeSql(sql);
        }
      }
    }
    
    console.log('Adding missing columns completed successfully.');
  } catch (error) {
    console.error('Error adding missing columns:', error);
  } finally {
    // Close the pool
    await pool.end();
  }
}

// Execute the function
addMissingColumns();