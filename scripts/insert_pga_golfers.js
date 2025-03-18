import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with values directly from .env
const supabaseUrl = 'https://bgdctfdxjdpsecihqsfh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnZGN0ZmR4amRwc2VjaWhxc2ZoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MjI0MzM2NywiZXhwIjoyMDU3ODE5MzY3fQ.cAikaFJS-7sLqIc-y-fg48SytInAJRgQJIQr3WxmTn0';

console.log('Using Supabase URL:', supabaseUrl);
console.log('Using Supabase Service Key (first 10 chars):', supabaseKey.substring(0, 10) + '...');

const supabase = createClient(supabaseUrl, supabaseKey);

// Golfer data with PGA Tour top players (updated 2023/2024 list)
const golfers = [
  { rank: 1, name: 'Scottie Scheffler', avatar: 'https://pga-tour-res.cloudinary.com/image/upload/c_fill,dpr_2.0,f_auto,g_face:center,h_360,q_auto,w_360/v1/pgatour/editorial/2023/08/07/ScottieHeadshot-1694.jpg' },
  { rank: 2, name: 'Rory McIlroy', avatar: 'https://pga-tour-res.cloudinary.com/image/upload/c_fill,dpr_2.0,f_auto,g_face:center,h_360,q_auto,w_360/v1/pgatour/editorial/2023/08/07/RoryHeadshot-1695.jpg' },
  { rank: 3, name: 'Xander Schauffele', avatar: 'https://pga-tour-res.cloudinary.com/image/upload/c_fill,dpr_2.0,f_auto,g_face:center,h_360,q_auto,w_360/v1/pgatour/editorial/2023/08/07/XanderHeadshot-1694.jpg' },
  { rank: 4, name: 'Wyndham Clark', avatar: 'https://pga-tour-res.cloudinary.com/image/upload/c_fill,dpr_2.0,f_auto,g_face:center,h_360,q_auto,w_360/v1/pgatour/editorial/2023/08/07/WyndhamHeadshot-1694.jpg' },
  { rank: 5, name: 'Ludvig Åberg', avatar: 'https://pga-tour-res.cloudinary.com/image/upload/c_fill,dpr_2.0,f_auto,g_face:center,h_360,q_auto,w_360/v1/pgatour/editorial/2023/08/07/LudvigHeadshot-1694.jpg' },
  { rank: 6, name: 'Viktor Hovland', avatar: 'https://pga-tour-res.cloudinary.com/image/upload/c_fill,dpr_2.0,f_auto,g_face:center,h_360,q_auto,w_360/v1/pgatour/editorial/2023/08/07/ViktorHeadshot-1694.jpg' },
  { rank: 7, name: 'Bryson DeChambeau', avatar: 'https://pga-tour-res.cloudinary.com/image/upload/c_fill,dpr_2.0,f_auto,g_face:center,h_360,q_auto,w_360/v1/pgatour/editorial/2023/08/07/BrysonHeadshot-1694.jpg' },
  { rank: 8, name: 'Jon Rahm', avatar: 'https://pga-tour-res.cloudinary.com/image/upload/c_fill,dpr_2.0,f_auto,g_face:center,h_360,q_auto,w_360/v1/pgatour/editorial/2023/08/03/RahmHeadshot-1694.jpg' },
  { rank: 9, name: 'Patrick Cantlay', avatar: 'https://pga-tour-res.cloudinary.com/image/upload/c_fill,dpr_2.0,f_auto,g_face:center,h_360,q_auto,w_360/v1/pgatour/editorial/2023/08/07/CantlayHeadshot-1694.jpg' },
  { rank: 10, name: 'Collin Morikawa', avatar: 'https://pga-tour-res.cloudinary.com/image/upload/c_fill,dpr_2.0,f_auto,g_face:center,h_360,q_auto,w_360/v1/pgatour/editorial/2023/08/07/MorikawaHeadshot-1694.jpg' },
  { rank: 11, name: 'Tommy Fleetwood', avatar: null },
  { rank: 12, name: 'Max Homa', avatar: null },
  { rank: 13, name: 'Matt Fitzpatrick', avatar: null },
  { rank: 14, name: 'Sahith Theegala', avatar: null },
  { rank: 15, name: 'Hideki Matsuyama', avatar: null },
  { rank: 16, name: 'Brian Harman', avatar: null },
  { rank: 17, name: 'Brooks Koepka', avatar: null },
  { rank: 18, name: 'Cameron Smith', avatar: null },
  { rank: 19, name: 'Tony Finau', avatar: null },
  { rank: 20, name: 'Si Woo Kim', avatar: null },
  { rank: 21, name: 'Tom Kim', avatar: null },
  { rank: 22, name: 'Cameron Young', avatar: null },
  { rank: 23, name: 'Joaquin Niemann', avatar: null },
  { rank: 24, name: 'Russell Henley', avatar: null },
  { rank: 25, name: 'Jordan Spieth', avatar: null },
  { rank: 26, name: 'Jason Day', avatar: null },
  { rank: 27, name: 'Sungjae Im', avatar: null },
  { rank: 28, name: 'Shane Lowry', avatar: null },
  { rank: 29, name: 'Keegan Bradley', avatar: null },
  { rank: 30, name: 'Sam Burns', avatar: null },
  { rank: 31, name: 'Justin Thomas', avatar: null },
  { rank: 32, name: 'Will Zalatoris', avatar: null },
  { rank: 33, name: 'Min Woo Lee', avatar: null },
  { rank: 34, name: 'Corey Conners', avatar: null },
  { rank: 35, name: 'Justin Rose', avatar: null },
  { rank: 36, name: 'Denny McCarthy', avatar: null },
  { rank: 37, name: 'Adam Scott', avatar: null },
  { rank: 38, name: 'Sepp Straka', avatar: null },
  { rank: 39, name: 'Rickie Fowler', avatar: null },
  { rank: 40, name: 'Billy Horschel', avatar: null },
  { rank: 41, name: 'Adam Hadwin', avatar: null },
  { rank: 42, name: 'Harris English', avatar: null },
  { rank: 43, name: 'Tyrrell Hatton', avatar: null },
  { rank: 44, name: 'Nicolai Højgaard', avatar: null },
  { rank: 45, name: 'Lucas Glover', avatar: null },
  { rank: 46, name: 'Eric Cole', avatar: null },
  { rank: 47, name: 'Kurt Kitayama', avatar: null },
  { rank: 48, name: 'Andrew Putnam', avatar: null },
  { rank: 49, name: 'Nick Taylor', avatar: null },
  { rank: 50, name: 'Thomas Detry', avatar: null }
];

// Generate more golfers to reach 500 total
for (let i = 51; i <= 500; i++) {
  golfers.push({
    rank: i,
    name: `Golfer ${i}`,
    avatar: null
  });
}

async function insertGolfers() {
  try {
    console.log('Starting to insert PGA golfers...');
    
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
    
    // Insert in batches to avoid request size limits
    const batchSize = 100;
    for (let i = 0; i < golfers.length; i += batchSize) {
      const batch = golfers.slice(i, i + batchSize);
      const { error } = await supabase
        .from('golfers')
        .insert(batch);
      
      if (error) {
        console.error(`Error inserting batch ${i / batchSize + 1}:`, error);
      } else {
        console.log(`Successfully inserted batch ${i / batchSize + 1} of ${Math.ceil(golfers.length / batchSize)}`);
      }
    }
    
    console.log(`Successfully updated golfers database with ${golfers.length} players.`);
  } catch (error) {
    console.error('Error inserting golfers:', error);
  }
}

// Execute the function
insertGolfers();