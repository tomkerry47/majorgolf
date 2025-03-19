import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { createClient } from '@supabase/supabase-js';

// Initialize PostgreSQL client
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Export Drizzle ORM instance
export const db = drizzle(pool);

// Initialize Supabase client (keeping this for compatibility with existing code)
const supabaseUrl = 'https://bgdctfdxjdpsecihqsfh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnZGN0ZmR4amRwc2VjaWhxc2ZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIyNDMzNjcsImV4cCI6MjA1NzgxOTM2N30.ZjwklXt1J4waKCE3-fq8duRkeUJnusiBu89k2zZ3Vc0';

// Export the Supabase client for use throughout the application
export const supabase = createClient(supabaseUrl, supabaseAnonKey);