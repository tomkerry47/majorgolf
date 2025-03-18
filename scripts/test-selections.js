import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Supabase connection
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testSelections() {
  try {
    console.log('Testing selections functionality...');
    
    // Use a fixed user ID since we know what's in our database
    // Our database has integer ID of 1 for the admin user
    const userId = 1;
    console.log(`Using hardcoded user ID: ${userId}`);
    
    // Get competition ID to use for selections
    console.log('Fetching competitions...');
    const { data: competitions, error: compError } = await supabase
      .from('competitions')
      .select('id')
      .limit(1);
      
    if (compError || !competitions || competitions.length === 0) {
      console.error('Error fetching competitions:', compError);
      return;
    }
    
    const competitionId = competitions[0].id;
    console.log(`Using competition ID: ${competitionId}`);
    
    // Get golfer IDs to use for selections
    console.log('Fetching golfers...');
    const { data: golfers, error: golferError } = await supabase
      .from('golfers')
      .select('id')
      .order('rank', { ascending: true })
      .limit(3);
      
    if (golferError || !golfers || golfers.length < 3) {
      console.error('Error fetching golfers:', golferError);
      return;
    }
    
    const golfer1Id = golfers[0].id;
    const golfer2Id = golfers[1].id;
    const golfer3Id = golfers[2].id;
    
    console.log(`Using golfer IDs: ${golfer1Id}, ${golfer2Id}, ${golfer3Id}`);
    
    // Check if a selection already exists for this user and competition
    console.log('Checking existing selections...');
    const { data: existingSelections, error: selectionError } = await supabase
      .from('selections')
      .select('id')
      .eq('userId', userId.toString())
      .eq('competitionId', competitionId.toString());
      
    if (selectionError) {
      console.error('Error checking existing selections:', selectionError);
      return;
    }
    
    // Create or update selections
    if (existingSelections && existingSelections.length > 0) {
      console.log(`Updating existing selection ID: ${existingSelections[0].id}`);
      
      const { error: updateError } = await supabase
        .from('selections')
        .update({
          golfer1Id,
          golfer2Id,
          golfer3Id,
          updatedAt: new Date().toISOString()
        })
        .eq('id', existingSelections[0].id);
        
      if (updateError) {
        console.error('Error updating selection:', updateError);
      } else {
        console.log('Selection updated successfully!');
      }
    } else {
      console.log('Creating new selection...');
      
      const newSelection = {
        userId: userId.toString(),
        competitionId: competitionId.toString(),
        golfer1Id: golfer1Id.toString(),
        golfer2Id: golfer2Id.toString(),
        golfer3Id: golfer3Id.toString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      const { data, error: insertError } = await supabase
        .from('selections')
        .insert(newSelection)
        .select();
        
      if (insertError) {
        console.error('Error creating selection:', insertError);
      } else {
        console.log(`New selection created with ID: ${data[0].id}`);
      }
    }
    
    console.log('Selection test complete!');
  } catch (err) {
    console.error('Error testing selections:', err);
  }
}

testSelections();