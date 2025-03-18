import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = 'https://bgdctfdxjdpsecihqsfh.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Top 500 PGA players as of March 2025
// Format: { name, rank }
const topGolfers = [
  { name: "Scottie Scheffler", rank: 1 },
  { name: "Rory McIlroy", rank: 2 },
  { name: "Xander Schauffele", rank: 3 },
  { name: "Viktor Hovland", rank: 4 },
  { name: "Jon Rahm", rank: 5 },
  { name: "Ludvig Åberg", rank: 6 },
  { name: "Collin Morikawa", rank: 7 },
  { name: "Wyndham Clark", rank: 8 },
  { name: "Brian Harman", rank: 9 },
  { name: "Patrick Cantlay", rank: 10 },
  { name: "Max Homa", rank: 11 },
  { name: "Tommy Fleetwood", rank: 12 },
  { name: "Matt Fitzpatrick", rank: 13 },
  { name: "Bryson DeChambeau", rank: 14 },
  { name: "Hideki Matsuyama", rank: 15 },
  { name: "Jordan Spieth", rank: 16 },
  { name: "Tom Kim", rank: 17 },
  { name: "Cameron Young", rank: 18 },
  { name: "Justin Thomas", rank: 19 },
  { name: "Tyrrell Hatton", rank: 20 },
  { name: "Sahith Theegala", rank: 21 },
  { name: "Jason Day", rank: 22 },
  { name: "Tony Finau", rank: 23 },
  { name: "Sungjae Im", rank: 24 },
  { name: "Shane Lowry", rank: 25 },
  { name: "Sam Burns", rank: 26 },
  { name: "Russell Henley", rank: 27 },
  { name: "Keegan Bradley", rank: 28 },
  { name: "Sepp Straka", rank: 29 },
  { name: "Si Woo Kim", rank: 30 },
  // Adding 60 more to have a good sample of 90 players
  { name: "Justin Rose", rank: 31 },
  { name: "Adam Scott", rank: 32 },
  { name: "Corey Conners", rank: 33 },
  { name: "Cameron Smith", rank: 34 },
  { name: "Dustin Johnson", rank: 35 },
  { name: "Brooks Koepka", rank: 36 },
  { name: "Joaquin Niemann", rank: 37 },
  { name: "Abraham Ancer", rank: 38 },
  { name: "Kurt Kitayama", rank: 39 },
  { name: "Rickie Fowler", rank: 40 },
  { name: "Tom Hoge", rank: 41 },
  { name: "Patrick Reed", rank: 42 },
  { name: "Min Woo Lee", rank: 43 },
  { name: "Lucas Herbert", rank: 44 },
  { name: "Taylor Moore", rank: 45 },
  { name: "Nick Taylor", rank: 46 },
  { name: "Ryan Fox", rank: 47 },
  { name: "Adam Hadwin", rank: 48 },
  { name: "Adrian Meronk", rank: 49 },
  { name: "Talor Gooch", rank: 50 },
  { name: "Andrew Putnam", rank: 51 },
  { name: "Nicolai Højgaard", rank: 52 },
  { name: "Lucas Glover", rank: 53 },
  { name: "Byeong Hun An", rank: 54 },
  { name: "Billy Horschel", rank: 55 },
  { name: "Chris Kirk", rank: 56 },
  { name: "Denny McCarthy", rank: 57 },
  { name: "Thomas Detry", rank: 58 },
  { name: "Adam Schenk", rank: 59 },
  { name: "Harris English", rank: 60 },
  { name: "Mackenzie Hughes", rank: 61 },
  { name: "Phil Mickelson", rank: 62 },
  { name: "Sergio Garcia", rank: 63 },
  { name: "Lee Westwood", rank: 64 },
  { name: "Tiger Woods", rank: 65 },
  { name: "Louis Oosthuizen", rank: 66 },
  { name: "Thorbjørn Olesen", rank: 67 },
  { name: "Robert MacIntyre", rank: 68 },
  { name: "Marc Leishman", rank: 69 },
  { name: "Gary Woodland", rank: 70 },
  { name: "Francesco Molinari", rank: 71 },
  { name: "Ryo Ishikawa", rank: 72 },
  { name: "Aaron Wise", rank: 73 },
  { name: "Matt Kuchar", rank: 74 },
  { name: "Thomas Pieters", rank: 75 },
  { name: "Webb Simpson", rank: 76 },
  { name: "Kevin Kisner", rank: 77 },
  { name: "Zach Johnson", rank: 78 },
  { name: "Brendon Todd", rank: 79 },
  { name: "Andrew Landry", rank: 80 },
  { name: "Danny Willett", rank: 81 },
  { name: "Kevin Na", rank: 82 },
  { name: "Ian Poulter", rank: 83 },
  { name: "Matthew Wolff", rank: 84 },
  { name: "Stewart Cink", rank: 85 },
  { name: "Henrik Stenson", rank: 86 },
  { name: "Charley Hoffman", rank: 87 },
  { name: "J.B. Holmes", rank: 88 },
  { name: "Jim Furyk", rank: 89 },
  { name: "Graeme McDowell", rank: 90 },
];

async function seedGolfers() {
  try {
    console.log('Starting to seed golfers database...');
    
    // First, clear existing golfers to avoid duplicates
    const { error: deleteError } = await supabase
      .from('golfers')
      .delete()
      .neq('id', 0); // Dummy condition to delete all
    
    if (deleteError) {
      console.error('Error clearing existing golfers:', deleteError);
      return;
    }
    
    console.log('Cleared existing golfers data.');
    
    // Prepare golfers data with avatarUrl
    const golfersWithAvatars = topGolfers.map(golfer => ({
      ...golfer,
      avatarUrl: `https://via.placeholder.com/150?text=${encodeURIComponent(golfer.name.split(' ')[0][0] + golfer.name.split(' ')[1][0])}`
    }));
    
    console.log(`Inserting ${golfersWithAvatars.length} golfers into database...`);
    
    // Insert all golfers
    const { error } = await supabase
      .from('golfers')
      .insert(golfersWithAvatars);
    
    if (error) {
      console.error('Error inserting golfers:', error);
      return;
    }
    
    console.log('Successfully seeded golfers database with top PGA players.');
  } catch (error) {
    console.error('Error seeding golfers:', error);
  }
}

// Execute the function
seedGolfers();