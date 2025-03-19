import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

async function testDashboardStats() {
  console.time('dashboard-stats');
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  try {
    const [
      activeCompetitionsResponse,
      nextCompetitionResponse
    ] = await Promise.all([
      // Get active competitions
      supabase
        .from('competitions')
        .select('id, name')
        .eq('isActive', true),
        
      // Get next competition deadline - only fetch incomplete competitions
      supabase
        .from('competitions')
        .select('selectionDeadline')
        .eq('isComplete', false)
        .order('selectionDeadline', { ascending: true })
        .limit(1)
        .single()
    ]);
    
    console.log('Active competitions:', activeCompetitionsResponse.data);
    console.log('Next competition deadline:', nextCompetitionResponse.data);
    
    console.timeEnd('dashboard-stats');
  } catch (error) {
    console.error('Error fetching stats:', error);
  }
}

testDashboardStats();
