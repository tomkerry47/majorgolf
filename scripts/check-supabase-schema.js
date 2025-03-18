import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Supabase connection
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTable(tableName) {
  console.log(`Checking schema for table: ${tableName}`);
  
  try {
    // Get the table definition from Postgres
    const { data, error } = await supabase.rpc('get_table_definition', { 
      table_name: tableName 
    });
    
    if (error) {
      console.error(`Error getting table definition:`, error);
      
      // Fallback approach - try to query the table
      const { data: tableData, error: tableError } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);
      
      if (tableError) {
        console.error(`Error querying table:`, tableError);
      } else {
        console.log(`Table ${tableName} exists with columns:`, 
          tableData.length > 0 ? Object.keys(tableData[0]) : 'No data to inspect columns'
        );
      }
    } else {
      console.log(`Table definition:`, data);
    }
  } catch (err) {
    console.error(`Error checking table ${tableName}:`, err);
  }
}

async function runSchemaCheck() {
  try {
    const tables = [
      'users',
      'golfers',
      'competitions',
      'selections',
      'results',
      'points_system'
    ];
    
    for (const table of tables) {
      await checkTable(table);
      console.log('------------------------');
    }
  } catch (err) {
    console.error('Schema check failed:', err);
  }
}

runSchemaCheck();