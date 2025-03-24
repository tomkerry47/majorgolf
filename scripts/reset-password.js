
// Script to reset a user's password
import dotenv from 'dotenv';
import pg from 'pg';
import bcrypt from 'bcryptjs';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

async function resetPassword() {
  const client = await pool.connect();
  
  try {
    const email = 'thomaskerry@me.com';
    const newPassword = 'password123';
    
    // Hash the password
    const hashedPassword = await hashPassword(newPassword);
    
    // Update the user's password
    const result = await client.query(
      'UPDATE users SET password = $1 WHERE email = $2 RETURNING id, email, username',
      [hashedPassword, email]
    );
    
    if (result.rows.length === 0) {
      console.log(`User with email ${email} not found`);
    } else {
      console.log(`Password reset successfully for user: ${result.rows[0].username} (${result.rows[0].email})`);
    }
  } catch (error) {
    console.error('Error resetting password:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the password reset
resetPassword();
