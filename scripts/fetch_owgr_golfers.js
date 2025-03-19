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

async function tryOWGRWebsite() {
  console.log('Trying OWGR website as primary source...');
  try {
    // Updated OWGR URL for 2025
    const response = await fetch('https://www.owgr.com/ranking', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36'
      },
      timeout: 15000 // 15 second timeout
    });
    
    if (!response.ok) {
      console.log(`OWGR website returned status ${response.status}`);
      return null;
    }
    
    const html = await response.text();
    console.log('OWGR response length:', html.length);
    
    if (html.length < 1000) {
      console.log('OWGR response too small, may be an error page');
      return null;
    }
    
    const $ = cheerio.load(html);
    const golfers = [];
    
    // Try different possible table selectors
    const possibleSelectors = [
      '.ranking-table tbody tr', 
      '.rankings-table tbody tr',
      '.owgr-table tbody tr', 
      'table.rankings tbody tr',
      'table.ranking tbody tr',
      '.table-rankings tbody tr',
      '.ranking-list tr',
      '.world-rankings table tr',
      '.world-ranking-table tr',
      '.current-rankings tr',
      '.players-table tr',
      '.owgr-ranking tr',
      '#rankings-table tr',
      '#ranking-table tr',
      '.data-table tr',
      '.leaderboard-table tr'
    ];
    
    let tableSelector = '';
    
    // Find the right selector
    for (const selector of possibleSelectors) {
      if ($(selector).length > 0) {
        console.log(`Found OWGR table with selector: ${selector}`);
        tableSelector = selector;
        break;
      }
    }
    
    if (!tableSelector) {
      console.log('Could not find ranking table with known selectors, trying generic table rows');
      tableSelector = 'table tbody tr';
      
      if ($(tableSelector).length === 0) {
        console.log('No tables found in OWGR website');
        return null;
      }
    }
    
    // Log structure of first row to help debugging
    const firstRow = $(tableSelector).first();
    if (firstRow.length) {
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
      let rank = parseInt($(element).find(`td:nth-child(${rankColumn})`).text().trim(), 10);
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
    
    console.log(`OWGR scraping found ${golfers.length} golfers`);
    return golfers.length > 0 ? golfers : null;
    
  } catch (error) {
    console.error('OWGR website scraping failed:', error);
    return null;
  }
}

async function tryPGATourFallback() {
  console.log('Trying PGA Tour website as alternative source...');
  try {
    // Updated PGA Tour world rankings page for 2025
    const response = await fetch('https://www.pgatour.com/stats/owgr', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36'
      },
      timeout: 15000 // 15 second timeout
    });
    
    if (!response.ok) {
      console.log('PGA Tour fallback failed with status:', response.status);
      return null;
    }
    
    const html = await response.text();
    console.log('PGA Tour response received, length:', html.length);
    
    const $ = cheerio.load(html);
    const golfers = [];
    
    // Updated PGA Tour table selectors for 2025
    const possibleSelectors = [
      '.rankings-table tr',
      '.table-rankings tr',
      '.world-rankings-table tr',
      '.player-table tr',
      '.rankings-component table tr',
      '.owgr-table tr',
      '.owgr-rankings tr',
      '.stats-table tbody tr',
      'table.stats tbody tr',
      '.stats-component tr',
      'table.data-table tbody tr'
    ];
    
    let tableSelector = '';
    
    // Find the right selector
    for (const selector of possibleSelectors) {
      if ($(selector).length > 0) {
        console.log(`Found PGA Tour table with selector: ${selector}`);
        tableSelector = selector;
        break;
      }
    }
    
    if (!tableSelector) {
      console.log('No PGA Tour rankings table found');
      return null;
    }
    
    // Log structure of first row to help debugging
    const firstRow = $(tableSelector).first();
    if (firstRow.length) {
      const cells = [];
      firstRow.find('td').each((i, el) => {
        cells.push(`PGA Column ${i+1}: ${$(el).text().trim()}`);
      });
      console.log(cells.join('\n'));
    }
    
    // Extract player data
    $(tableSelector).each((i, el) => {
      if (i >= 500) return false; // Limit to 500
      
      // Try to find rank and name
      let rank, name;
      
      $(el).find('td').each((j, cell) => {
        const text = $(cell).text().trim();
        
        // Look for rank (typically first column)
        if (!rank && /^\d+$/.test(text) && parseInt(text) > 0) {
          rank = parseInt(text);
        }
        
        // Look for player name
        if (!name && text.length > 3 && text.includes(' ') && !/^\d+$/.test(text)) {
          name = text;
        }
      });
      
      if (rank && name) {
        golfers.push({
          name,
          rank,
          avatarUrl: null
        });
      }
    });
    
    console.log(`PGA Tour fallback found ${golfers.length} golfers`);
    return golfers.length > 0 ? golfers : null;
    
  } catch (error) {
    console.error('PGA Tour fallback failed:', error);
    return null;
  }
}

async function fetchTopGolfers() {
  try {
    console.log('Starting to fetch top 500 golfers from OWGR...');
    
    // Instead of deleting, we'll update existing records and keep track of them
    console.log('Fetching existing golfers to update them...');
    const { data: existingGolfers, error: fetchError } = await supabase
      .from('golfers')
      .select('id, name, rank')
      .order('rank', { ascending: true });
    
    if (fetchError) {
      console.error('Error fetching existing golfers:', fetchError);
      return;
    }
    
    console.log(`Found ${existingGolfers.length} existing golfers in the database.`);
    
    // Try OWGR website first
    let golfers = await tryOWGRWebsite();
    
    // If OWGR failed, try PGA Tour
    if (!golfers) {
      console.log('OWGR website scraping failed, trying PGA Tour...');
      golfers = await tryPGATourFallback();
    }
    
    // If both failed, use the fallback list
    if (!golfers) {
      console.log('All web scraping attempts failed, using fallback list...');
      golfers = pgatourPlayers.map((player, index) => ({
        name: player.name,
        rank: index + 1,
        avatarUrl: null
      }));
    }
    
    if (golfers.length === 0) {
      console.error('Failed to generate any golfer data. Exiting.');
      return;
    }
    
    console.log(`Successfully gathered ${golfers.length} golfers. Fetching avatars...`);
    
    // Try to fetch avatars for only the top 20 players to prevent timeout
    for (let i = 0; i < Math.min(20, golfers.length); i++) {
      golfers[i].avatarUrl = await fetchGolferAvatar(golfers[i].name);
      if (i % 5 === 0) {
        console.log(`Fetched avatars for ${i} players`);
      }
    }
    
    // Process each golfer - update existing by name or insert new ones
    console.log('Processing golfers - updating existing and adding new ones...');
    
    // Create a map of existing golfers by name for easy lookup
    const existingGolferMap = new Map();
    existingGolfers.forEach(golfer => {
      existingGolferMap.set(golfer.name.toLowerCase(), golfer);
    });
    
    // Separate into updates and inserts
    const updates = [];
    const inserts = [];
    
    for (const golfer of golfers) {
      const existingGolfer = existingGolferMap.get(golfer.name.toLowerCase());
      
      if (existingGolfer) {
        // Update this golfer
        updates.push({
          id: existingGolfer.id,
          rank: golfer.rank,
          avatarUrl: golfer.avatarUrl || existingGolfer.avatarUrl
        });
      } else {
        // New golfer to insert
        inserts.push({
          name: golfer.name,
          rank: golfer.rank,
          avatarUrl: golfer.avatarUrl,
          country: golfer.country || ''
        });
      }
    }
    
    console.log(`Processing ${updates.length} updates and ${inserts.length} new golfers...`);
    
    // Process updates in batches
    const batchSize = 100;
    let successCount = 0;
    
    if (updates.length > 0) {
      for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);
        console.log(`Updating batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(updates.length / batchSize)}`);
        
        for (const update of batch) {
          const { error } = await supabase
            .from('golfers')
            .update({ rank: update.rank, avatarUrl: update.avatarUrl })
            .eq('id', update.id);
            
          if (error) {
            console.error(`Error updating golfer id ${update.id}:`, error);
          } else {
            successCount++;
          }
        }
      }
      console.log(`Updated ${successCount} existing golfers`);
    }
    
    // Process inserts in batches
    if (inserts.length > 0) {
      successCount = 0;
      for (let i = 0; i < inserts.length; i += batchSize) {
        const batch = inserts.slice(i, i + batchSize);
        const { error } = await supabase
          .from('golfers')
          .insert(batch);
        
        if (error) {
          console.error(`Error inserting batch ${Math.floor(i / batchSize) + 1}:`, error);
        } else {
          successCount += batch.length;
          console.log(`Inserted batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(inserts.length / batchSize)}`);
        }
      }
      console.log(`Inserted ${successCount} new golfers`);
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