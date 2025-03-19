import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with direct values from client configuration
const supabaseUrl = 'https://bgdctfdxjdpsecihqsfh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnZGN0ZmR4amRwc2VjaWhxc2ZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIyNDMzNjcsImV4cCI6MjA1NzgxOTM2N30.ZjwklXt1J4waKCE3-fq8duRkeUJnusiBu89k2zZ3Vc0';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function syncCompetitions() {
  console.log('Starting competitions synchronization...');

  const competitions = [
    {
      id: 1,
      name: "The Masters",
      venue: "Augusta National Golf Club",
      startDate: new Date("2025-04-10"),
      endDate: new Date("2025-04-13"),
      selectionDeadline: new Date("2025-04-09T23:59:59"),
      isActive: false,
      isComplete: false,
      description: "The Masters Tournament is one of the four major championships in professional golf.",
      imageUrl: "https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3"
    },
    {
      id: 2,
      name: "PGA Championship",
      venue: "TPC Harding Park",
      startDate: new Date("2025-05-15"),
      endDate: new Date("2025-05-18"),
      selectionDeadline: new Date("2025-05-14T23:59:59"),
      isActive: false,
      isComplete: false,
      description: "The PGA Championship is an annual golf tournament conducted by the Professional Golfers Association of America.",
      imageUrl: "https://images.unsplash.com/photo-1535131749006-b7d58e945025?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3"
    },
    {
      id: 3,
      name: "US Open",
      venue: "Oakmont Country Club, Pennsylvania",
      startDate: new Date("2025-06-12"),
      endDate: new Date("2025-06-15"),
      selectionDeadline: new Date("2025-06-11T23:59:59"),
      isActive: false,
      isComplete: false,
      description: "The 125th U.S. Open Championship",
      imageUrl: "https://images.unsplash.com/photo-1535131749006-b7d58e945025?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3"
    },
    {
      id: 4,
      name: "The Open Championship",
      venue: "Royal Portrush, Northern Ireland",
      startDate: new Date("2025-07-17"),
      endDate: new Date("2025-07-20"),
      selectionDeadline: new Date("2025-07-16T23:59:59"),
      isActive: false,
      isComplete: false,
      description: "The 153rd Open Championship",
      imageUrl: "https://images.unsplash.com/photo-1535131749006-b7d58e945025?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3"
    }
  ];

  // First, get current competitions
  const { data: currentComps, error: fetchError } = await supabase
    .from('competitions')
    .select('id');

  if (fetchError) {
    console.error('Error fetching competitions:', fetchError);
    return;
  }

  console.log(`Found ${currentComps.length} existing competitions`);

  // Upsert competitions (update if exists, insert if not)
  for (const competition of competitions) {
    const { data, error } = await supabase
      .from('competitions')
      .upsert(competition, { onConflict: 'id' });

    if (error) {
      console.error(`Error upserting competition ${competition.name}:`, error);
    } else {
      console.log(`Successfully updated/inserted competition: ${competition.name}`);
    }
  }

  console.log('Competitions synchronization completed');
}

syncCompetitions()
  .catch(err => {
    console.error('Error in synchronization:', err);
    process.exit(1);
  });