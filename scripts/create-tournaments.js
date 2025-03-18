// Script to create tournaments
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'https://hvtnnefsbstvsbnfbrlm.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2dG5uZWZzYnN0dnNibmZicmxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTA3OTUwNzYsImV4cCI6MjAyNjM3MTA3Nn0.R5aLCUDxxw3rYXmFDVacZe2Fx11TBpEWHDW4fmQD0y4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const tournaments = [
  {
    name: "The Masters",
    venue: "Augusta National Golf Club",
    startDate: new Date("2025-04-10"),
    endDate: new Date("2025-04-13"),
    selectionDeadline: new Date("2025-04-09"),
    isActive: false,
    isComplete: false,
    description: "The Masters Tournament is played annually at Augusta National Golf Club in Augusta, Georgia. It is one of the four major championships in professional golf.",
    imageUrl: "https://www.masters.com/images/pics/large/masters_logo_meta.jpg"
  },
  {
    name: "PGA Championship",
    venue: "Quail Hollow Club",
    startDate: new Date("2025-05-15"),
    endDate: new Date("2025-05-18"),
    selectionDeadline: new Date("2025-05-14"),
    isActive: false,
    isComplete: false,
    description: "The PGA Championship is one of golf's four major championships. Since 2019, it has been played in May, making it the second major of the golf season.",
    imageUrl: "https://www.pgachampionship.com/assets/images/pgachampionship-logo.png"
  },
  {
    name: "U.S. Open",
    venue: "Pinehurst Resort",
    startDate: new Date("2025-06-12"),
    endDate: new Date("2025-06-15"),
    selectionDeadline: new Date("2025-06-11"),
    isActive: false,
    isComplete: false,
    description: "The United States Open Championship is the annual open national championship of golf in the United States. It is the third of the four major championships.",
    imageUrl: "https://www.usopen.com/content/dam/usopen/logo/us-open-championship-logo.svg"
  },
  {
    name: "The Open Championship",
    venue: "Royal Liverpool Golf Club",
    startDate: new Date("2025-07-17"),
    endDate: new Date("2025-07-20"),
    selectionDeadline: new Date("2025-07-16"),
    isActive: false,
    isComplete: false,
    description: "The Open Championship, often referred to as The Open or the British Open, is the oldest golf tournament in the world. It is one of the four major championships.",
    imageUrl: "https://www.theopen.com/assets/site/logos/the-open-logo-white.svg"
  },
  {
    name: "The Players Championship",
    venue: "TPC Sawgrass",
    startDate: new Date("2025-03-13"),
    endDate: new Date("2025-03-16"),
    selectionDeadline: new Date("2025-03-12"),
    isActive: true,
    isComplete: false,
    description: "The Players Championship is an annual golf tournament on the PGA Tour. Originally known as the Tournament Players Championship, it is often regarded as golf's fifth major.",
    imageUrl: "https://www.theplayers.com/content/dam/pga/tournaments/tournament-sites/the-players-championship/the-players-logo.svg"
  }
];

async function createTournaments() {
  console.log('Starting tournament creation...');
  
  for (const tournament of tournaments) {
    const { data, error } = await supabase
      .from('competitions')
      .insert([tournament])
      .select();
      
    if (error) {
      console.error(`Error creating tournament "${tournament.name}":`, error);
    } else {
      console.log(`Successfully created tournament: ${tournament.name}`);
    }
  }
  
  console.log('Tournament creation complete.');
}

// Run the function
createTournaments()
  .catch(error => {
    console.error('Error in script execution:', error);
  });