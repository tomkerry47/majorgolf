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

async function updateColumnsToCamelCase() {
  try {
    console.log('Starting column name conversion to camelCase...');
    
    // Get all tables in the public schema
    const { data: tables, error: tablesError } = await supabase
      .from('pg_tables')
      .select('tablename')
      .eq('schemaname', 'public');
      
    if (tablesError) {
      console.error('Error fetching tables:', tablesError);
      throw tablesError;
    }
    
    for (const table of tables) {
      const tableName = table.tablename;
      console.log(`Processing table: ${tableName}`);
      
      // Skip system tables
      if (tableName.startsWith('pg_') || tableName.startsWith('sql_')) {
        console.log(`Skipping system table: ${tableName}`);
        continue;
      }
      
      // Get all columns for this table
      const { data: columns, error: columnsError } = await supabase
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_schema', 'public')
        .eq('table_name', tableName);
        
      if (columnsError) {
        console.error(`Error fetching columns for table ${tableName}:`, columnsError);
        continue;
      }
      
      for (const column of columns) {
        const columnName = column.column_name;
        
        // Skip columns that are already camelCase or are system columns
        if (columnName === columnName.toLowerCase() || 
            columnName.includes('_') === false || 
            columnName.startsWith('_')) {
          continue;
        }
        
        // Convert snake_case to camelCase
        const camelCaseName = columnName.toLowerCase().replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        
        if (columnName !== camelCaseName) {
          console.log(`Renaming column ${tableName}.${columnName} to ${camelCaseName}`);
          
          // Rename the column
          await executeSql(`
            ALTER TABLE "${tableName}" 
            RENAME COLUMN "${columnName}" TO "${camelCaseName}";
          `);
        }
      }
    }
    
    console.log('Column name conversion completed successfully.');
  } catch (error) {
    console.error('Error during column name conversion:', error);
  } finally {
    // Close the pool
    await pool.end();
  }
}

// Execute the function
updateColumnsToCamelCase();