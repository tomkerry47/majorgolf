import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import pg from 'pg';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Find competitions
const comps = await pool.query('SELECT id, name, "startDate", "selectionDeadline" FROM competitions ORDER BY "startDate" ASC');
console.log('\n--- Competitions ---');
console.table(comps.rows);

const thirdComp = comps.rows[2];
console.log(`\nThird competition: ${thirdComp.name} (ID: ${thirdComp.id})`);

// Get non-admin users
const allUsers = await pool.query('SELECT id, email, username, password, "lastLoginAt" FROM users WHERE "isAdmin" = false');

// Find users with non-password123 hashes
const badHashUsers = [];
for (const u of allUsers.rows) {
  const ok = await bcrypt.compare('password123', u.password);
  if (!ok) badHashUsers.push(u);
}

const badIds = badHashUsers.map(u => u.id);

// Check who hasn't logged in this week (since May 7)
const thisWeek = new Date('2026-05-07T00:00:00Z');
const notLoggedInThisWeek = badHashUsers.filter(u => !u.lastLoginAt || new Date(u.lastLoginAt) < thisWeek);

// Check selections for 3rd competition
const selRes = await pool.query(
  `SELECT DISTINCT "userId" FROM selections WHERE "competitionId" = $1 AND "userId" = ANY($2)`,
  [thirdComp.id, notLoggedInThisWeek.map(u => u.id)]
);
const hasSelection = new Set(selRes.rows.map(r => r.userId));

const targets = notLoggedInThisWeek.filter(u => !hasSelection.has(u.id));

console.log('\n--- Users with bad hash, not logged in this week, no PGA selection ---');
console.table(targets.map(u => ({ id: u.id, username: u.username, email: u.email, lastLoginAt: u.lastLoginAt })));

await pool.end();
