import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = 'https://bgdctfdxjdpsecihqsfh.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Major golf tournaments for 2025 (projected dates based on historical patterns)
const tournaments = [
  {
    name: "The Masters",
    venue: "Augusta National Golf Club",
    description: "The Masters Tournament is one of the four major championships in professional golf. Scheduled for the first full week of April, it is the first major of the year. The Masters is the only major tournament held at the same location each year, at Augusta National Golf Club, a private course in Augusta, Georgia.",
    imageUrl: "https://golf.com/wp-content/uploads/2021/11/masters-logo.jpeg",
    startDate: "2025-04-10",
    endDate: "2025-04-13",
    selectionDeadline: "2025-04-09T23:59:59Z",
    status: "upcoming",
    maxEntrants: 90,
    entryFee: 10,
    prizeFund: 900
  },
  {
    name: "PGA Championship",
    venue: "Quail Hollow Club",
    description: "The PGA Championship is an annual golf tournament conducted by the Professional Golfers' Association of America. It is one of the four major championships in professional golf. The PGA Championship was established in 1916, and has been played at various prestigious courses across the United States.",
    imageUrl: "https://golf.com/wp-content/uploads/2020/02/PGA-Championship-logo.jpg",
    startDate: "2025-05-15",
    endDate: "2025-05-18",
    selectionDeadline: "2025-05-14T23:59:59Z",
    status: "upcoming",
    maxEntrants: 90,
    entryFee: 10,
    prizeFund: 900
  },
  {
    name: "U.S. Open",
    venue: "Pebble Beach Golf Links",
    description: "The United States Open Championship, commonly known as the U.S. Open, is the annual open national championship of golf in the United States. It is the third of the four major championships in golf, and is on the official schedule of both the PGA Tour and the European Tour.",
    imageUrl: "https://golf.com/wp-content/uploads/2019/12/USGA_USOpen_Primary_FC_Pos.jpg",
    startDate: "2025-06-12",
    endDate: "2025-06-15",
    selectionDeadline: "2025-06-11T23:59:59Z",
    status: "upcoming",
    maxEntrants: 90,
    entryFee: 10,
    prizeFund: 900
  },
  {
    name: "The Open Championship",
    venue: "Royal Portrush Golf Club",
    description: "The Open Championship, often referred to as The Open or the British Open, is the oldest golf tournament in the world, and one of the most prestigious. Founded in 1860, it was originally held annually at Prestwick Golf Club, Scotland, before evolving to being rotated between a select group of coastal links golf courses in the United Kingdom.",
    imageUrl: "https://golf.com/wp-content/uploads/2019/12/The-Open-logo.jpg",
    startDate: "2025-07-17",
    endDate: "2025-07-20",
    selectionDeadline: "2025-07-16T23:59:59Z",
    status: "upcoming",
    maxEntrants: 90,
    entryFee: 10,
    prizeFund: 900
  },
  {
    name: "The Players Championship",
    venue: "TPC Sawgrass",
    description: "The Players Championship is an annual golf tournament on the PGA Tour. Originally known as the Tournament Players Championship, it began in 1974. The Players Championship currently offers the highest prize fund of any tournament in golf, and is often referred to as the 'fifth major' due to its prestige, high-profile field, and iconic venue at TPC Sawgrass.",
    imageUrl: "https://golf.com/wp-content/uploads/2020/02/PLAYERS-Logo-Horizontal-4C.jpg",
    startDate: "2025-03-13",
    endDate: "2025-03-16",
    selectionDeadline: "2025-03-12T23:59:59Z",
    status: "completed", // Since today is March 18, 2025, this tournament would be completed
    maxEntrants: 90,
    entryFee: 10,
    prizeFund: 900
  }
];

async function createTournaments() {
  try {
    console.log('Starting to create tournaments...');
    
    // First check if tournaments already exist
    const { data: existingTournaments, error: checkError } = await supabase
      .from('competitions')
      .select('name');
    
    if (checkError) {
      console.error('Error checking existing tournaments:', checkError);
      return;
    }
    
    const existingNames = existingTournaments.map(t => t.name);
    const newTournaments = tournaments.filter(t => !existingNames.includes(t.name));
    
    if (newTournaments.length === 0) {
      console.log('All tournaments already exist. No new tournaments to create.');
      return;
    }
    
    console.log(`Adding ${newTournaments.length} new tournaments...`);
    
    // Insert new tournaments
    const { error } = await supabase
      .from('competitions')
      .insert(newTournaments);
    
    if (error) {
      console.error('Error creating tournaments:', error);
      return;
    }
    
    console.log('Successfully created tournaments for the 2025 season.');
  } catch (error) {
    console.error('Error in tournament creation process:', error);
  }
}

// Execute the function
createTournaments();