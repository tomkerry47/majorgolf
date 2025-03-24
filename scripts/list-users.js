
// Script to list all users in the database
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function listUsers() {
  const client = await pool.connect();
  
  try {
    // Query all users
    const result = await client.query(
      'SELECT id, email, username, "fullName", "isAdmin", "createdAt" FROM users ORDER BY username'
    );
    
    if (result.rows.length === 0) {
      console.log('No users found in the database');
    } else {
      console.log(`Found ${result.rows.length} users in the database:\n`);
      
      // Format and display each user
      result.rows.forEach((user, index) => {
        console.log(`User #${user.id} - ${user.username}`);
        console.log(`  Email: ${user.email}`);
        console.log(`  Full Name: ${user.fullName}`);
        console.log(`  Admin: ${user.isAdmin ? 'Yes' : 'No'}`);
        console.log(`  Created: ${new Date(user.createdAt).toLocaleString()}`);
        
        if (index < result.rows.length - 1) {
          console.log('-------------------');
        }
      });
    }
  } catch (error) {
    console.error('Error listing users:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the function
listUsers();
