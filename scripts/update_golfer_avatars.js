import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;

// Connect to the PostgreSQL database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Function to generate avatar URL using DiceBear
function generateAvatarUrl(name) {
  // Encode the name for URL
  const encodedName = encodeURIComponent(name);
  
  // Use DiceBear Avatars API to generate consistent avatars
  // Using the "avataaars" style which gives professional-looking avatars
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodedName}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}

async function updateGolferAvatars() {
  const client = await pool.connect();
  
  try {
    console.log('Starting to update golfer avatars...');
    
    // Start a transaction
    await client.query('BEGIN');
    
    // Get all golfers with null avatarUrl
    const golfersWithoutAvatars = await client.query(`
      SELECT id, name
      FROM golfers
      WHERE "avatarUrl" IS NULL
    `);
    
    console.log(`Found ${golfersWithoutAvatars.rows.length} golfers without avatars.`);
    
    // Update avatars in batches
    const batchSize = 50;
    let updated = 0;
    
    for (let i = 0; i < golfersWithoutAvatars.rows.length; i += batchSize) {
      const batch = golfersWithoutAvatars.rows.slice(i, i + batchSize);
      
      // Process each golfer in the batch
      for (const golfer of batch) {
        const avatarUrl = generateAvatarUrl(golfer.name);
        
        await client.query(`
          UPDATE golfers
          SET "avatarUrl" = $1
          WHERE id = $2
        `, [avatarUrl, golfer.id]);
        
        updated++;
      }
      
      console.log(`Updated batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(golfersWithoutAvatars.rows.length / batchSize)}`);
    }
    
    // Commit the transaction
    await client.query('COMMIT');
    
    console.log(`Successfully updated avatars for ${updated} golfers.`);
    
    // Verify the updates
    const verifyQuery = await client.query(`
      SELECT COUNT(*) FROM golfers WHERE "avatarUrl" IS NULL
    `);
    
    console.log(`Remaining golfers without avatars: ${verifyQuery.rows[0].count}`);
    
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error('Error updating golfer avatars:', error);
  } finally {
    client.release();
    pool.end();
  }
}

// Execute the function
updateGolferAvatars();