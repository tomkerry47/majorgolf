// Test script to directly check selections via Supabase client
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'https://bgdctfdxjdpsecihqsfh.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnZGN0ZmR4amRwc2VjaWhxc2ZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIyNDMzNjcsImV4cCI6MjA1NzgxOTM2N30.ZjwklXt1J4waKCE3-fq8duRkeUJnusiBu89k2zZ3Vc0';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSelections() {
  console.log('Testing selections via Supabase client...');
  
  try {
    // First try with the standard select query
    const { data: selections, error } = await supabase
      .from('selections')
      .select('*')
      .eq('competitionId', 1);
      
    console.log('Query error:', error);
    console.log('Selections found:', selections ? selections.length : 0);
    if (selections && selections.length > 0) {
      console.log('Sample selection:', JSON.stringify(selections[0]));
    }
    
    // Try with explicit competitionId as number
    const { data: selections2, error: error2 } = await supabase
      .from('selections')
      .select('*')
      .eq('competitionId', 1);
      
    console.log('\nQuery with explicit number error:', error2);
    console.log('Selections found:', selections2 ? selections2.length : 0);
    
    // Try a raw SQL query as fallback
    const { data: allSelections, error: allError } = await supabase
      .from('selections')
      .select('*');
      
    console.log('\nAll selections error:', allError);
    console.log('Total selections found:', allSelections ? allSelections.length : 0);
    if (allSelections && allSelections.length > 0) {
      console.log('All selections:', JSON.stringify(allSelections));
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

testSelections();