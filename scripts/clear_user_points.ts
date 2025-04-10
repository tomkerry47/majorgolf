import 'dotenv/config'; // Load .env file variables
import { pool } from '../server/db.js';

async function clearUserPoints() {
  console.log('Attempting to clear user_points table...');
  const client = await pool.connect();
  try {
    const result = await client.query('DELETE FROM user_points');
    console.log(`Successfully deleted ${result.rowCount} rows from user_points.`);
  } catch (error) {
    console.error('Error clearing user_points table:', error);
  } finally {
    client.release();
    await pool.end(); // Close the pool
  }
}

clearUserPoints();
