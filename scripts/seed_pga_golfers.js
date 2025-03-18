import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

dotenv.config();

// Supabase connection
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Function to provide up-to-date list of top golfers
async function fetchTopGolfers() {
  console.log('Using current top 100 golfers data...');
  
  // Using current top golfers
  return [
    { rank: 1, name: 'Scottie Scheffler' },
    { rank: 2, name: 'Rory McIlroy' },
    { rank: 3, name: 'Xander Schauffele' },
    { rank: 4, name: 'Wyndham Clark' },
    { rank: 5, name: 'Ludvig Åberg' },
    { rank: 6, name: 'Viktor Hovland' },
    { rank: 7, name: 'Bryson DeChambeau' },
    { rank: 8, name: 'Jon Rahm' },
    { rank: 9, name: 'Patrick Cantlay' },
    { rank: 10, name: 'Collin Morikawa' },
    { rank: 11, name: 'Tommy Fleetwood' },
    { rank: 12, name: 'Max Homa' },
    { rank: 13, name: 'Matt Fitzpatrick' },
    { rank: 14, name: 'Sahith Theegala' },
    { rank: 15, name: 'Hideki Matsuyama' },
    { rank: 16, name: 'Brian Harman' },
    { rank: 17, name: 'Brooks Koepka' },
    { rank: 18, name: 'Cameron Smith' },
    { rank: 19, name: 'Tony Finau' },
    { rank: 20, name: 'Si Woo Kim' },
    { rank: 21, name: 'Tom Kim' },
    { rank: 22, name: 'Cameron Young' },
    { rank: 23, name: 'Joaquin Niemann' },
    { rank: 24, name: 'Russell Henley' },
    { rank: 25, name: 'Jordan Spieth' },
    { rank: 26, name: 'Jason Day' },
    { rank: 27, name: 'Sungjae Im' },
    { rank: 28, name: 'Shane Lowry' },
    { rank: 29, name: 'Keegan Bradley' },
    { rank: 30, name: 'Sam Burns' },
    { rank: 31, name: 'Justin Thomas' },
    { rank: 32, name: 'Will Zalatoris' },
    { rank: 33, name: 'Min Woo Lee' },
    { rank: 34, name: 'Adam Scott' },
    { rank: 35, name: 'Sepp Straka' },
    { rank: 36, name: 'Corey Conners' },
    { rank: 37, name: 'Tyrrell Hatton' },
    { rank: 38, name: 'Tom Hoge' },
    { rank: 39, name: 'Harris English' },
    { rank: 40, name: 'Justin Rose' },
    { rank: 41, name: 'Denny McCarthy' },
    { rank: 42, name: 'Emiliano Grillo' },
    { rank: 43, name: 'Kurt Kitayama' },
    { rank: 44, name: 'Adam Hadwin' },
    { rank: 45, name: 'Patrick Reed' },
    { rank: 46, name: 'Nicolai Højgaard' },
    { rank: 47, name: 'Lucas Glover' },
    { rank: 48, name: 'Christiaan Bezuidenhout' },
    { rank: 49, name: 'Robert MacIntyre' },
    { rank: 50, name: 'Chris Kirk' },
    { rank: 51, name: 'Rickie Fowler' },
    { rank: 52, name: 'Byeong Hun An' },
    { rank: 53, name: 'Thomas Detry' },
    { rank: 54, name: 'Billy Horschel' },
    { rank: 55, name: 'Nick Taylor' },
    { rank: 56, name: 'Victor Perez' },
    { rank: 57, name: 'Taylor Pendrith' },
    { rank: 58, name: 'Matthieu Pavon' },
    { rank: 59, name: 'Aaron Rai' },
    { rank: 60, name: 'Adam Svensson' },
    { rank: 61, name: 'Alex Noren' },
    { rank: 62, name: 'Mackenzie Hughes' },
    { rank: 63, name: 'J.T. Poston' },
    { rank: 64, name: 'Adrian Meronk' },
    { rank: 65, name: 'Keith Mitchell' },
    { rank: 66, name: 'Andrew Putnam' },
    { rank: 67, name: 'Abraham Ancer' },
    { rank: 68, name: 'Stephan Jaeger' },
    { rank: 69, name: 'Seamus Power' },
    { rank: 70, name: 'Maverick McNealy' },
    { rank: 71, name: 'Gary Woodland' },
    { rank: 72, name: 'Davis Riley' },
    { rank: 73, name: 'Matt Kuchar' },
    { rank: 74, name: 'Thorbjørn Olesen' },
    { rank: 75, name: 'Taylor Moore' },
    { rank: 76, name: 'Kevin Yu' },
    { rank: 77, name: 'Eric Cole' },
    { rank: 78, name: 'Ryan Fox' },
    { rank: 79, name: 'Nick Dunlap' },
    { rank: 80, name: 'Rasmus Højgaard' },
    { rank: 81, name: 'Cam Davis' },
    { rank: 82, name: 'Luke List' },
    { rank: 83, name: 'Lucas Herbert' },
    { rank: 84, name: 'Francesco Molinari' },
    { rank: 85, name: 'Brendon Todd' },
    { rank: 86, name: 'Erik van Rooyen' },
    { rank: 87, name: 'Lee Hodges' },
    { rank: 88, name: 'Austin Eckroat' },
    { rank: 89, name: 'Matteo Manassero' },
    { rank: 90, name: 'Ben Griffin' },
    { rank: 91, name: 'Vincent Norrman' },
    { rank: 92, name: 'Akshay Bhatia' },
    { rank: 93, name: 'Sebastian Söderberg' },
    { rank: 94, name: 'Phil Mickelson' },
    { rank: 95, name: 'Alexander Björk' },
    { rank: 96, name: 'Ryo Hisatsune' },
    { rank: 97, name: 'Jake Knapp' },
    { rank: 98, name: 'Thriston Lawrence' },
    { rank: 99, name: 'Daniel Berger' },
    { rank: 100, name: 'Webb Simpson' }
  ];
}

async function seedGolfers() {
  try {
    console.log('Starting golfer seeding process...');
    
    // Fetch golfers
    const golfers = await fetchTopGolfers();
    
    // Clear existing golfers
    console.log('Clearing existing golfers...');
    const { error: deleteError } = await supabase
      .from('golfers')
      .delete()
      .not('id', 'is', null);
      
    if (deleteError) {
      console.error('Error clearing golfers:', deleteError);
    }
    
    // Insert new golfers
    console.log(`Inserting ${golfers.length} golfers...`);
    
    // Insert in batches of 50 to avoid rate limits
    const BATCH_SIZE = 50;
    let successCount = 0;
    
    for (let i = 0; i < golfers.length; i += BATCH_SIZE) {
      const batch = golfers.slice(i, i + BATCH_SIZE);
      console.log(`Inserting batch ${i/BATCH_SIZE + 1} of ${Math.ceil(golfers.length/BATCH_SIZE)}`);
      
      const { error } = await supabase
        .from('golfers')
        .insert(batch.map(golfer => ({
          name: golfer.name,
          rank: golfer.rank
        })));
      
      if (error) {
        console.error(`Error inserting batch ${i/BATCH_SIZE + 1}:`, error);
      } else {
        successCount += batch.length;
        console.log(`Successfully inserted batch ${i/BATCH_SIZE + 1} (${successCount}/${golfers.length} golfers)`);
      }
      
      // Add a small delay between batches
      if (i + BATCH_SIZE < golfers.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`Golfer seeding complete: ${successCount}/${golfers.length} golfers inserted`);
  } catch (err) {
    console.error('Golfer seeding failed:', err);
  }
}

seedGolfers();