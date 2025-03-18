import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'https://bgdctfdxjdpsecihqsfh.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('Error: No Supabase key found. Set SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchGolferAvatar(name) {
  try {
    // Try to find a PGA Tour image for the player
    // Note: This is a simplified approach and might need adjustments
    const searchName = name.replace(/\s+/g, '+');
    const url = `https://pga-tour-res.cloudinary.com/image/upload/c_fill,dpr_2.0,f_auto,g_face:center,h_360,q_auto,w_360/v1/pgatour/editorial/2023/08/07/${searchName.split('+')[0]}Headshot-1694.jpg`;
    
    // Try to fetch the image to see if it exists
    const response = await fetch(url, { method: 'HEAD' });
    
    if (response.ok) {
      return url;
    }
    
    // Return null if no avatar is found
    return null;
  } catch (error) {
    console.log(`Could not fetch avatar for ${name}`);
    return null;
  }
}

async function fetchTopGolfers() {
  try {
    console.log('Starting to fetch top 500 golfers from OWGR...');
    
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
    
    // Fetch OWGR data 
    console.log('Fetching data from OWGR website...');
    const response = await fetch('https://www.owgr.com/ranking');
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const golfers = [];
    let tableSelector = '';
    
    // Try different possible table selectors
    const possibleSelectors = [
      '.ranking-table tbody tr', 
      '.rankings-table tbody tr',
      '.owgr-table tbody tr', 
      'table.rankings tbody tr',
      'table.ranking tbody tr',
      '.table-rankings tbody tr'
    ];
    
    // Find the right selector by checking which one returns results
    for (const selector of possibleSelectors) {
      if ($(selector).length > 0) {
        console.log(`Found matching selector: ${selector}`);
        tableSelector = selector;
        break;
      }
    }
    
    if (!tableSelector) {
      console.log('Could not find ranking table with known selectors, trying generic table rows');
      tableSelector = 'table tbody tr';
    }
    
    // Extract the table structure by logging the first row
    const firstRow = $(tableSelector).first();
    if (firstRow.length) {
      console.log('Found table row structure:');
      const cells = [];
      firstRow.find('td').each((i, el) => {
        cells.push(`Column ${i+1}: ${$(el).text().trim()}`);
      });
      console.log(cells.join('\n'));
    }
    
    // Try to determine column positions
    let rankColumn = 1;  // default position for rank
    let nameColumn = 3;  // default position for name
    
    // Process the table rows
    $(tableSelector).each((i, element) => {
      if (i >= 500) return false; // Only get top 500
      
      // Try to parse rank and name from the row
      const rank = parseInt($(element).find(`td:nth-child(${rankColumn})`).text().trim(), 10);
      let name = $(element).find(`td:nth-child(${nameColumn})`).text().trim();
      
      // If we couldn't parse a rank, look for columns that have numbers
      if (isNaN(rank)) {
        $(element).find('td').each((idx, cell) => {
          const text = $(cell).text().trim();
          const possibleRank = parseInt(text, 10);
          if (!isNaN(possibleRank) && possibleRank > 0 && possibleRank <= 500) {
            rankColumn = idx + 1;
            // Try again with new position
            rank = possibleRank;
          }
        });
      }
      
      // If we still don't have a name, try to find cells with text that looks like names
      if (!name || name.length < 4) {
        $(element).find('td').each((idx, cell) => {
          const text = $(cell).text().trim();
          if (text.length > 4 && text.includes(' ') && !/^\d+$/.test(text)) {
            nameColumn = idx + 1;
            name = text;
          }
        });
      }
      
      // Skip if we still couldn't parse the name or rank
      if (!name || isNaN(rank) || rank <= 0 || rank > 500) return;
      
      golfers.push({
        name,
        rank,
        avatarUrl: null
      });
    });
    
    if (golfers.length === 0) {
      console.error('Failed to parse any golfer data from OWGR.');
      console.log('Falling back to using PGA Tour data...');
      
      // Fallback to a list of known PGA Tour players
      // This is just a basic fallback with the top 100 or so
      for (let i = 0; i < pgatourPlayers.length && i < 500; i++) {
        golfers.push({
          name: pgatourPlayers[i].name,
          rank: i + 1,
          avatarUrl: null
        });
      }
    }
    
    console.log(`Parsed ${golfers.length} golfers. Inserting into database...`);
    
    // Try to fetch avatars for the top 50 players
    console.log('Fetching avatars for top players...');
    for (let i = 0; i < Math.min(50, golfers.length); i++) {
      golfers[i].avatarUrl = await fetchGolferAvatar(golfers[i].name);
      if (i % 10 === 0) {
        console.log(`Fetched avatars for ${i} players`);
      }
    }
    
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
    console.error('Error fetching golfers:', error);
  }
}

// Fallback list in case the web scraping fails
const pgatourPlayers = [
  { name: 'Scottie Scheffler' },
  { name: 'Rory McIlroy' },
  { name: 'Xander Schauffele' },
  { name: 'Wyndham Clark' },
  { name: 'Ludvig Åberg' },
  { name: 'Viktor Hovland' },
  { name: 'Bryson DeChambeau' },
  { name: 'Jon Rahm' },
  { name: 'Patrick Cantlay' },
  { name: 'Collin Morikawa' },
  { name: 'Tommy Fleetwood' },
  { name: 'Max Homa' },
  { name: 'Matt Fitzpatrick' },
  { name: 'Sahith Theegala' },
  { name: 'Hideki Matsuyama' },
  { name: 'Brian Harman' },
  { name: 'Brooks Koepka' },
  { name: 'Cameron Smith' },
  { name: 'Tony Finau' },
  { name: 'Si Woo Kim' },
  { name: 'Tom Kim' },
  { name: 'Cameron Young' },
  { name: 'Joaquin Niemann' },
  { name: 'Russell Henley' },
  { name: 'Jordan Spieth' },
  { name: 'Jason Day' },
  { name: 'Sungjae Im' },
  { name: 'Shane Lowry' },
  { name: 'Keegan Bradley' },
  { name: 'Sam Burns' },
  { name: 'Justin Thomas' },
  { name: 'Will Zalatoris' },
  { name: 'Min Woo Lee' },
  { name: 'Corey Conners' },
  { name: 'Justin Rose' },
  { name: 'Denny McCarthy' },
  { name: 'Adam Scott' },
  { name: 'Sepp Straka' },
  { name: 'Rickie Fowler' },
  { name: 'Billy Horschel' },
  { name: 'Adam Hadwin' },
  { name: 'Harris English' },
  { name: 'Tyrrell Hatton' },
  { name: 'Nicolai Højgaard' },
  { name: 'Lucas Glover' },
  { name: 'Eric Cole' },
  { name: 'Kurt Kitayama' },
  { name: 'Andrew Putnam' },
  { name: 'Nick Taylor' },
  { name: 'Thomas Detry' },
  { name: 'J.T. Poston' },
  { name: 'Lee Hodges' },
  { name: 'Taylor Moore' },
  { name: 'Stephan Jaeger' },
  { name: 'Alex Noren' },
  { name: 'Emiliano Grillo' },
  { name: 'Adam Svensson' },
  { name: 'Byeong Hun An' },
  { name: 'Mackenzie Hughes' },
  { name: 'Tom Hoge' },
  { name: 'Chris Kirk' },
  { name: 'Keith Mitchell' },
  { name: 'Seamus Power' },
  { name: 'Robert MacIntyre' },
  { name: 'Patrick Rodgers' },
  { name: 'Akshay Bhatia' },
  { name: 'Davis Thompson' },
  { name: 'Christiaan Bezuidenhout' },
  { name: 'Nick Dunlap' },
  { name: 'Adrian Meronk' },
  { name: 'Matt Kuchar' },
  { name: 'Taylor Pendrith' },
  { name: 'Victor Perez' },
  { name: 'Alex Smalley' },
  { name: 'Austin Eckroat' },
  { name: 'Adam Schenk' },
  { name: 'Matthieu Pavon' },
  { name: 'Aaron Rai' },
  { name: 'Brendon Todd' },
  { name: 'Davis Riley' },
  { name: 'Thomas Pieters' },
  { name: 'Cameron Davis' },
  { name: 'Maverick McNealy' },
  { name: 'Thorbjørn Olesen' },
  { name: 'Beau Hossler' },
  { name: 'Kevin Yu' },
  { name: 'Ben Griffin' },
  { name: 'Matti Schmid' },
  { name: 'Vincent Norrman' },
  { name: 'Webb Simpson' },
  { name: 'Justin Lower' },
  { name: 'Cam Davis' },
  { name: 'Rasmus Højgaard' },
  { name: 'Jordan Smith' },
  { name: 'Matt Wallace' },
  { name: 'Francesco Molinari' },
  { name: 'Kevin Kisner' },
  { name: 'Abraham Ancer' },
  { name: 'Luke List' }
];

// Execute the function
fetchTopGolfers();