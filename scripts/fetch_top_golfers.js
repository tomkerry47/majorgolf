import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

// Initialize Supabase client
const supabaseUrl = 'https://bgdctfdxjdpsecihqsfh.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

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
    
    // Fetch OWGR data - this is a sample approach, might need adjusting based on the actual website structure
    const response = await fetch('https://www.owgr.com/ranking');
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const golfers = [];
    
    // This selector will need to be adjusted based on the actual HTML structure of the OWGR site
    $('.ranking-table tbody tr').each((i, element) => {
      if (i >= 500) return false; // Only get top 500
      
      const rank = parseInt($(element).find('td:nth-child(1)').text().trim(), 10);
      const name = $(element).find('td:nth-child(3)').text().trim();
      
      // Skip if we couldn't parse the name or rank
      if (!name || isNaN(rank)) return;
      
      golfers.push({
        name,
        rank,
        avatarUrl: null // We could fetch avatars separately if needed
      });
    });
    
    if (golfers.length === 0) {
      console.error('Failed to parse any golfer data from OWGR. Check the HTML selectors.');
      return;
    }
    
    console.log(`Parsed ${golfers.length} golfers from OWGR. Inserting into database...`);
    
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
    
    console.log('Successfully updated golfers database with top 500 OWGR players.');
  } catch (error) {
    console.error('Error fetching golfers:', error);
  }
}

// Execute the function
fetchTopGolfers();