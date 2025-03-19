// @ts-check
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with the same values from db.ts
const supabaseUrl = 'https://bgdctfdxjdpsecihqsfh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnZGN0ZmR4amRwc2VjaWhxc2ZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIyNDMzNjcsImV4cCI6MjA1NzgxOTM2N30.ZjwklXt1J4waKCE3-fq8duRkeUJnusiBu89k2zZ3Vc0';

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function addPlayersChampionship() {
  try {
    // The Players Championship 2025 (back-dated to March as a completed event)
    const playersTournament = {
      name: "The Players Championship",
      venue: "TPC Sawgrass, Florida",
      startDate: "2025-03-13T00:00:00",
      endDate: "2025-03-16T00:00:00",
      selectionDeadline: "2025-03-12T23:59:59",
      isActive: false,
      isComplete: true,  // This is a completed tournament
      description: "The Players Championship is the PGA Tour's flagship event featuring the strongest field of the year.",
      imageUrl: "https://images.unsplash.com/photo-1600170384874-c11beaeb3bb8?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3"
    };

    console.log("Adding The Players Championship to the database...");
    
    const { data, error } = await supabase
      .from('competitions')
      .insert(playersTournament)
      .select();
      
    if (error) {
      console.error("Error adding tournament:", error);
      return;
    }
    
    console.log("Successfully added The Players Championship:", data);
    
  } catch (err) {
    console.error("Error:", err);
  } finally {
    process.exit(0); // Make sure the script exits
  }
}

// Run the function
addPlayersChampionship();