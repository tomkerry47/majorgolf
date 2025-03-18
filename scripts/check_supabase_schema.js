import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with values directly from .env
const supabaseUrl = 'https://bgdctfdxjdpsecihqsfh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnZGN0ZmR4amRwc2VjaWhxc2ZoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MjI0MzM2NywiZXhwIjoyMDU3ODE5MzY3fQ.cAikaFJS-7sLqIc-y-fg48SytInAJRgQJIQr3WxmTn0';

console.log('Using Supabase URL:', supabaseUrl);
console.log('Using Supabase Service Key (first 10 chars):', supabaseKey.substring(0, 10) + '...');

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTable(tableName) {
  try {
    console.log(`Checking table structure for '${tableName}'...`);
    
    // Get table information using RPC call to see internal structure
    const { data, error } = await supabase.rpc('get_schema_info', { table_name: tableName });
    
    if (error) {
      console.error('Error getting schema info:', error);
      
      // Fallback approach: try a simple query to see what data we get back
      console.log('Trying fallback approach to check table structure...');
      const { data: sampleData, error: sampleError } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);
      
      if (sampleError) {
        console.error('Error fetching sample data:', sampleError);
      } else {
        console.log('Sample data from table:', sampleData);
        if (sampleData && sampleData.length > 0) {
          console.log('Column names:', Object.keys(sampleData[0]));
        } else {
          console.log('No data in table to inspect columns');
        }
      }
      
      return;
    }
    
    console.log('Table structure:', data);
  } catch (error) {
    console.error(`Error checking table '${tableName}':`, error);
  }
}

async function listTables() {
  try {
    console.log('Listing all tables in the database...');
    
    // Using direct SQL query to list tables since Supabase JS client doesn't have a direct method
    const { data, error } = await supabase.rpc('list_tables');
    
    if (error) {
      console.error('Error listing tables:', error);
      
      // Try a different approach
      console.log('Trying alternative method to list tables...');
      const { data: tablesData, error: tablesError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public');
        
      if (tablesError) {
        console.error('Error with alternative method:', tablesError);
      } else {
        console.log('Tables in database:', tablesData);
      }
      
      return;
    }
    
    console.log('Tables in database:', data);
  } catch (error) {
    console.error('Error listing tables:', error);
  }
}

// Try a direct insert without using .from() to see if it works
async function tryDirectInsert() {
  try {
    console.log('Trying direct insert to golfers table...');
    
    // Using SQL query to insert data
    const { data, error } = await supabase.rpc('insert_test_golfer', { 
      p_rank: 999, 
      p_name: 'Test Golfer', 
      p_avatar_url: null 
    });
    
    if (error) {
      console.error('Error with direct insert:', error);
      
      // Try raw SQL insert
      console.log('Trying raw SQL insert...');
      const { data: sqlData, error: sqlError } = await supabase.rpc('execute_sql', {
        sql_query: "INSERT INTO golfers (rank, name, avatar_url) VALUES (999, 'Test Golfer SQL', NULL)"
      });
      
      if (sqlError) {
        console.error('Error with raw SQL insert:', sqlError);
      } else {
        console.log('Raw SQL insert result:', sqlData);
      }
    } else {
      console.log('Direct insert result:', data);
    }
  } catch (error) {
    console.error('Error with direct insert tests:', error);
  }
}

// Try querying system tables to see column names
async function checkColumnNames() {
  try {
    console.log('Checking column names in golfers table...');
    
    // Using SQL query through RPC to view column names
    const { data, error } = await supabase.rpc('execute_sql', {
      sql_query: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'golfers' AND table_schema = 'public'"
    });
    
    if (error) {
      console.error('Error checking column names:', error);
      return;
    }
    
    console.log('Column names in golfers table:', data);
  } catch (error) {
    console.error('Error checking column names:', error);
  }
}

// Check if we can query the golfers table with known columns
async function testGolfersQuery() {
  try {
    console.log('Testing golfers table query with specific columns...');
    
    // Try different casing options
    const columns = ['id', 'rank', 'name'];
    const casingOptions = ['avatarUrl', 'avatar_url', 'avatarurl', 'AVATARURL'];
    
    for (const column of casingOptions) {
      console.log(`Testing with column name: ${column}`);
      const { data, error } = await supabase
        .from('golfers')
        .select([...columns, column].join(','))
        .limit(1);
      
      if (error) {
        console.error(`Error querying with ${column}:`, error);
      } else {
        console.log(`Query with ${column} succeeded:`, data);
      }
    }
  } catch (error) {
    console.error('Error testing golfers queries:', error);
  }
}

// Execute the functions
async function runSchemaCheck() {
  await listTables();
  await checkTable('golfers');
  await checkColumnNames();
  await testGolfersQuery();
  await tryDirectInsert();
}

runSchemaCheck();