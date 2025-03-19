require('dotenv').config();
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');

// Initialize PostgreSQL client
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Export the pool for direct SQL queries
const db = {
  query: (text, params) => pool.query(text, params)
};

// Supabase credentials
const supabaseUrl = 'https://bgdctfdxjdpsecihqsfh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnZGN0ZmR4amRwc2VjaWhxc2ZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIyNDMzNjcsImV4cCI6MjA1NzgxOTM2N30.ZjwklXt1J4waKCE3-fq8duRkeUJnusiBu89k2zZ3Vc0';

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

module.exports = { db, supabase };