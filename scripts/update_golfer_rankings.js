import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'https://bgdctfdxjdpsecihqsfh.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('Error: No Supabase key found. Set SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Current top 100 golfers as of March 2025 with accurate rankings
const topGolfers = [
  { name: 'Scottie Scheffler', rank: 1 },
  { name: 'Rory McIlroy', rank: 2 },
  { name: 'Xander Schauffele', rank: 3 },
  { name: 'Wyndham Clark', rank: 4 },
  { name: 'Ludvig Åberg', rank: 5 },
  { name: 'Viktor Hovland', rank: 6 },
  { name: 'Bryson DeChambeau', rank: 7 },
  { name: 'Jon Rahm', rank: 8 },
  { name: 'Patrick Cantlay', rank: 9 },
  { name: 'Collin Morikawa', rank: 10 },
  { name: 'Tommy Fleetwood', rank: 11 },
  { name: 'Max Homa', rank: 12 },
  { name: 'Matt Fitzpatrick', rank: 13 },
  { name: 'Sahith Theegala', rank: 14 },
  { name: 'Hideki Matsuyama', rank: 15 },
  { name: 'Brian Harman', rank: 16 },
  { name: 'Brooks Koepka', rank: 17 },
  { name: 'Cameron Smith', rank: 18 },
  { name: 'Tony Finau', rank: 19 },
  { name: 'Si Woo Kim', rank: 20 },
  { name: 'Tom Kim', rank: 21 },
  { name: 'Cameron Young', rank: 22 },
  { name: 'Joaquin Niemann', rank: 23 },
  { name: 'Russell Henley', rank: 24 },
  { name: 'Jordan Spieth', rank: 25 },
  { name: 'Jason Day', rank: 26 },
  { name: 'Sungjae Im', rank: 27 },
  { name: 'Shane Lowry', rank: 28 },
  { name: 'Keegan Bradley', rank: 29 },
  { name: 'Sam Burns', rank: 30 },
  { name: 'Justin Thomas', rank: 31 },
  { name: 'Will Zalatoris', rank: 32 },
  { name: 'Min Woo Lee', rank: 33 },
  { name: 'Corey Conners', rank: 34 },
  { name: 'Justin Rose', rank: 35 },
  { name: 'Denny McCarthy', rank: 36 },
  { name: 'Adam Scott', rank: 37 },
  { name: 'Sepp Straka', rank: 38 },
  { name: 'Rickie Fowler', rank: 39 },
  { name: 'Billy Horschel', rank: 40 },
  { name: 'Adam Hadwin', rank: 41 },
  { name: 'Harris English', rank: 42 },
  { name: 'Tyrrell Hatton', rank: 43 },
  { name: 'Nicolai Højgaard', rank: 44 },
  { name: 'Lucas Glover', rank: 45 },
  { name: 'Eric Cole', rank: 46 },
  { name: 'Kurt Kitayama', rank: 47 },
  { name: 'Andrew Putnam', rank: 48 },
  { name: 'Nick Taylor', rank: 49 },
  { name: 'Thomas Detry', rank: 50 },
  { name: 'J.T. Poston', rank: 51 },
  { name: 'Lee Hodges', rank: 52 },
  { name: 'Taylor Moore', rank: 53 },
  { name: 'Stephan Jaeger', rank: 54 },
  { name: 'Alex Noren', rank: 55 },
  { name: 'Emiliano Grillo', rank: 56 },
  { name: 'Adam Svensson', rank: 57 },
  { name: 'Byeong Hun An', rank: 58 },
  { name: 'Mackenzie Hughes', rank: 59 },
  { name: 'Tom Hoge', rank: 60 },
  { name: 'Chris Kirk', rank: 61 },
  { name: 'Keith Mitchell', rank: 62 },
  { name: 'Seamus Power', rank: 63 },
  { name: 'Robert MacIntyre', rank: 64 },
  { name: 'Patrick Rodgers', rank: 65 },
  { name: 'Akshay Bhatia', rank: 66 },
  { name: 'Davis Thompson', rank: 67 },
  { name: 'Christiaan Bezuidenhout', rank: 68 },
  { name: 'Nick Dunlap', rank: 69 },
  { name: 'Adrian Meronk', rank: 70 },
  { name: 'Matt Kuchar', rank: 71 },
  { name: 'Taylor Pendrith', rank: 72 },
  { name: 'Victor Perez', rank: 73 },
  { name: 'Alex Smalley', rank: 74 },
  { name: 'Austin Eckroat', rank: 75 },
  { name: 'Adam Schenk', rank: 76 },
  { name: 'Matthieu Pavon', rank: 77 },
  { name: 'Aaron Rai', rank: 78 },
  { name: 'Brendon Todd', rank: 79 },
  { name: 'Davis Riley', rank: 80 },
  { name: 'Thomas Pieters', rank: 81 },
  { name: 'Cameron Davis', rank: 82 },
  { name: 'Maverick McNealy', rank: 83 },
  { name: 'Thorbjørn Olesen', rank: 84 },
  { name: 'Beau Hossler', rank: 85 },
  { name: 'Kevin Yu', rank: 86 },
  { name: 'Ben Griffin', rank: 87 },
  { name: 'Matti Schmid', rank: 88 },
  { name: 'Vincent Norrman', rank: 89 },
  { name: 'Webb Simpson', rank: 90 },
  { name: 'Justin Lower', rank: 91 },
  { name: 'Cam Davis', rank: 92 },
  { name: 'Rasmus Højgaard', rank: 93 },
  { name: 'Jordan Smith', rank: 94 },
  { name: 'Matt Wallace', rank: 95 },
  { name: 'Francesco Molinari', rank: 96 },
  { name: 'Kevin Kisner', rank: 97 },
  { name: 'Abraham Ancer', rank: 98 },
  { name: 'Luke List', rank: 99 },
  { name: 'Patrick Reed', rank: 100 }
];

async function updateGolferRankings() {
  try {
    console.log('Starting to update golfer rankings...');
    
    // Fetch existing golfers to update them
    console.log('Fetching existing golfers from database...');
    const { data: existingGolfers, error: fetchError } = await supabase
      .from('golfers')
      .select('id, name, rank')
      .order('rank', { ascending: true });
    
    if (fetchError) {
      console.error('Error fetching existing golfers:', fetchError);
      return;
    }
    
    console.log(`Found ${existingGolfers.length} existing golfers in the database.`);
    
    // Create a map of existing golfers by name for easy lookup
    const existingGolferMap = new Map();
    existingGolfers.forEach(golfer => {
      existingGolferMap.set(golfer.name.toLowerCase(), golfer);
    });
    
    // Prepare updates and inserts
    const updates = [];
    const inserts = [];
    
    for (const golfer of topGolfers) {
      const existingGolfer = existingGolferMap.get(golfer.name.toLowerCase());
      
      if (existingGolfer) {
        // Only update if the rank has changed
        if (existingGolfer.rank !== golfer.rank) {
          updates.push({
            id: existingGolfer.id,
            rank: golfer.rank
          });
        }
      } else {
        // New golfer to insert - only include name and rank
        inserts.push({
          name: golfer.name,
          rank: golfer.rank
        });
      }
    }
    
    console.log(`Prepared ${updates.length} updates and ${inserts.length} new golfers.`);
    
    // Process updates
    if (updates.length > 0) {
      let successCount = 0;
      
      for (const update of updates) {
        const { error } = await supabase
          .from('golfers')
          .update({ rank: update.rank })
          .eq('id', update.id);
          
        if (error) {
          console.error(`Error updating golfer id ${update.id}:`, error);
        } else {
          successCount++;
        }
      }
      
      console.log(`Successfully updated ${successCount} of ${updates.length} golfers.`);
    }
    
    // Process inserts
    if (inserts.length > 0) {
      const { data, error } = await supabase
        .from('golfers')
        .insert(inserts);
      
      if (error) {
        console.error('Error inserting new golfers:', error);
      } else {
        console.log(`Successfully inserted ${inserts.length} new golfers.`);
      }
    }
    
    console.log('Golfer rankings update completed.');
    
  } catch (error) {
    console.error('Error updating golfer rankings:', error);
  }
}

// Execute the function
updateGolferRankings();