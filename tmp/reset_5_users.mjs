import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import pg from 'pg';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const hash = await bcrypt.hash('password123', 10);

const res = await pool.query(
  `UPDATE users SET password = $1, "passwordChangedAt" = NOW()
   WHERE id = ANY($2)
   RETURNING username, email`,
  [hash, [52, 58, 64, 53, 63]]
);

console.log('Updated:');
console.table(res.rows);
await pool.end();
