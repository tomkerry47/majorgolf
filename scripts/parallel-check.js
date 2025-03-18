// Script to compare direct SQL with Supabase results
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

// Initialize Supabase client
const supabaseUrl = 'https://bgdctfdxjdpsecihqsfh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnZGN0ZmR4amRwc2VjaWhxc2ZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIyNDMzNjcsImV4cCI6MjA1NzgxOTM2N30.ZjwklXt1J4waKCE3-fq8duRkeUJnusiBu89k2zZ3Vc0';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Direct PostgreSQL connection from environment variables
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
});

async function runCheck() {
  console.log('Comparing direct SQL with Supabase results...');
  
  try {
    // Connect to PostgreSQL
    await client.connect();
    console.log('Connected to PostgreSQL directly');
    
    // Direct SQL query
    const directResult = await client.query('SELECT * FROM selections WHERE "competitionId" = $1', [1]);
    console.log('\nDirect SQL result:');
    console.log('Rows found:', directResult.rows.length);
    if (directResult.rows.length > 0) {
      console.log('Sample row:', JSON.stringify(directResult.rows[0]));
    }
    
    // Supabase query
    const { data: supabaseSelections, error } = await supabase
      .from('selections')
      .select('*')
      .eq('competitionId', 1);
    
    console.log('\nSupabase result:');
    console.log('Query error:', error);
    console.log('Rows found:', supabaseSelections ? supabaseSelections.length : 0);
    if (supabaseSelections && supabaseSelections.length > 0) {
      console.log('Sample row:', JSON.stringify(supabaseSelections[0]));
    }
    
    // Check all tables
    const tablesResult = await client.query('SELECT tablename FROM pg_tables WHERE schemaname = $1', ['public']);
    console.log('\nAll tables in public schema:');
    console.log(tablesResult.rows.map(row => row.tablename).join(', '));
    
    // Check RLS policies
    console.log('\nChecking Row Level Security policies...');
    const rlsResult = await client.query('SELECT tablename, policyname, cmd, qual FROM pg_policies WHERE schemaname = $1', ['public']);
    console.log('RLS policies found:', rlsResult.rows.length);
    rlsResult.rows.forEach(row => {
      console.log(`- Table: ${row.tablename}, Policy: ${row.policyname}, Command: ${row.cmd}, Qualifier: ${row.qual}`);
    });
    
  } catch (err) {
    console.error('Error during comparison:', err);
  } finally {
    // Close the direct connection
    await client.end();
  }
}

runCheck();