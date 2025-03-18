import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;
import { createClient } from '@supabase/supabase-js';

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Initialize Supabase client
const supabaseUrl = 'https://bgdctfdxjdpsecihqsfh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnZGN0ZmR4amRwc2VjaWhxc2ZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIyNDMzNjcsImV4cCI6MjA1NzgxOTM2N30.ZjwklXt1J4waKCE3-fq8duRkeUJnusiBu89k2zZ3Vc0';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function syncAuthUsers() {
  const client = await pool.connect();
  
  try {
    console.log('Starting auth user synchronization...');
    
    // Get current session to test auth connection
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.error('Error getting Supabase session:', sessionError);
      return;
    }
    console.log('Supabase auth connection verified');
    
    // Check current users in database
    const dbUsers = await client.query('SELECT id, email, username, "isAdmin" FROM users');
    console.log(`Found ${dbUsers.rows.length} users in database`);
    
    // Create a map of existing users by email for quick lookup
    const userEmailMap = new Map();
    dbUsers.rows.forEach(user => {
      userEmailMap.set(user.email.toLowerCase(), user);
    });
    
    // Get authenticated users from Supabase
    // Note: In a production app, you'd need admin credentials to list all users
    // This script may require running as an admin or using service role key
    
    // For this example, manually check some known auth accounts
    const testEmails = [
      'admin@example.com',
      'user@example.com',
      'thomaskerry@me.com'
    ];
    
    console.log('Checking auth status for test emails...');
    
    for (const email of testEmails) {
      // Try to find user by email in DB
      const dbUser = userEmailMap.get(email.toLowerCase());
      
      console.log(`\nChecking user: ${email}`);
      console.log(`- Exists in database: ${dbUser ? 'Yes' : 'No'}`);
      
      try {
        // Try to get auth data by signing in (this is just for testing/diagnosis)
        // In production, you'd need admin access to check users
        const { data, error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: false
          }
        });
        
        if (error) {
          console.log(`- Auth status: Error - ${error.message}`);
        } else {
          console.log(`- Auth status: Found in auth system (OTP sent)`);
          
          if (!dbUser) {
            console.log(`  !!! User exists in auth but not in database`);
          }
        }
      } catch (error) {
        console.log(`- Auth check error: ${error.message}`);
      }
    }
    
    // Attempt to create/repair sync issues
    console.log('\nSynchronizing database with auth system...');
    
    // Get current session user (likely from login attempt)
    const { data: { session } } = await supabase.auth.getSession();
    if (session && session.user) {
      const authUser = session.user;
      console.log(`Current authenticated user: ${authUser.email}`);
      
      // Check if this user exists in database
      const dbUser = userEmailMap.get(authUser.email.toLowerCase());
      
      if (!dbUser) {
        console.log(`User ${authUser.email} exists in auth but not in database. Creating...`);
        
        // Create user in database
        const username = authUser.email.split('@')[0];
        const insertResult = await client.query(
          'INSERT INTO users (id, email, username, "fullName") VALUES ($1, $2, $3, $4) RETURNING id',
          [authUser.id, authUser.email, username, username]
        );
        
        console.log(`Created user in database with ID: ${insertResult.rows[0].id}`);
      } else {
        console.log(`User ${authUser.email} already exists in database with ID: ${dbUser.id}`);
        
        // Check if IDs match
        if (dbUser.id !== authUser.id) {
          console.log(`!!! ID mismatch: DB ID=${dbUser.id}, Auth ID=${authUser.id}`);
          
          // Update the ID in database to match auth
          await client.query(
            'UPDATE users SET id = $1 WHERE email = $2',
            [authUser.id, authUser.email]
          );
          
          console.log(`Updated user ID in database to match auth ID`);
        }
      }
    } else {
      console.log('No current authenticated user. Login with a user to sync.');
    }
    
    console.log('\nAuth syncing complete!');
    
  } catch (error) {
    console.error('Error syncing auth users:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Execute the sync
syncAuthUsers();