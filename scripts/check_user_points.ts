import 'dotenv/config'; // Load .env file variables
import { pool } from '../server/db.js'; // Import the pool from db.ts

async function checkUserPoints() {
  console.log(`Attempting to connect with DATABASE_URL: ${process.env.DATABASE_URL ? 'Set' : 'Not Set'}`); // Add log
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT COUNT(*) FROM user_points');
    const count = result.rows[0].count;
    console.log(`Count of rows in user_points table: ${count}`);
    if (parseInt(count, 10) === 0) {
      console.log("The user_points table is currently empty.");
    } else {
      console.log(`The user_points table contains ${count} rows.`);
    }
  } catch (error) {
    console.error('Error querying user_points table:', error);
  } finally {
    client.release();
    await pool.end(); // Close the pool after the query
  }
}

checkUserPoints();
