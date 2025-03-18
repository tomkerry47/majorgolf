import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function verifyGolfers() {
  const client = await pool.connect();
  
  try {
    console.log('Starting golfer verification...');
    
    // Get golfers count
    const golfersResult = await client.query('SELECT COUNT(*) FROM golfers');
    const golferCount = parseInt(golfersResult.rows[0].count, 10);
    
    console.log(`Found ${golferCount} golfers in database`);
    
    // Check for top 10 golfers
    const topGolfersResult = await client.query(
      'SELECT id, name, rank, "avatarUrl" FROM golfers ORDER BY rank ASC LIMIT 10'
    );
    
    console.log('\nTop 10 golfers:');
    topGolfersResult.rows.forEach(golfer => {
      console.log(`${golfer.rank}. ${golfer.name} (ID: ${golfer.id}) [Avatar: ${golfer["avatarUrl"] ? 'Yes' : 'No'}]`);
    });
    
    // Check for selections that reference golfers
    const selectionsResult = await client.query(`
      SELECT COUNT(*) FROM selections
    `);
    
    const selectionsCount = parseInt(selectionsResult.rows[0].count, 10);
    console.log(`\nFound ${selectionsCount} selections in database`);
    
    // Check for golfer references
    if (selectionsCount > 0) {
      // Sample some selections to verify references
      const sampleSelections = await client.query(`
        SELECT 
          s.id, s."userId", s."competitionId", 
          g1.id as golfer1_id, g1.name as golfer1_name,
          g2.id as golfer2_id, g2.name as golfer2_name,
          g3.id as golfer3_id, g3.name as golfer3_name
        FROM 
          selections s
          LEFT JOIN golfers g1 ON s."golfer1Id" = g1.id
          LEFT JOIN golfers g2 ON s."golfer2Id" = g2.id
          LEFT JOIN golfers g3 ON s."golfer3Id" = g3.id
        LIMIT 5
      `);
      
      console.log('\nSample selections with golfer references:');
      sampleSelections.rows.forEach(selection => {
        console.log(`Selection ID: ${selection.id} (User: ${selection.userid}, Competition: ${selection.competitionid})`);
        console.log(`  Golfer 1: ${selection.golfer1_name || 'NULL'} (ID: ${selection.golfer1_id || 'NULL'})`);
        console.log(`  Golfer 2: ${selection.golfer2_name || 'NULL'} (ID: ${selection.golfer2_id || 'NULL'})`);
        console.log(`  Golfer 3: ${selection.golfer3_name || 'NULL'} (ID: ${selection.golfer3_id || 'NULL'})`);
      });
      
      // Check for broken references
      const brokenRefs = await client.query(`
        SELECT COUNT(*) as broken_count FROM selections s
        WHERE 
          (s."golfer1Id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM golfers g WHERE g.id = s."golfer1Id"))
          OR (s."golfer2Id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM golfers g WHERE g.id = s."golfer2Id"))
          OR (s."golfer3Id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM golfers g WHERE g.id = s."golfer3Id"))
      `);
      
      const brokenCount = parseInt(brokenRefs.rows[0].broken_count, 10);
      if (brokenCount > 0) {
        console.log(`\n⚠️ Found ${brokenCount} selections with broken golfer references!`);
      } else {
        console.log('\n✅ All golfer references in selections are valid!');
      }
    }
    
    // Check avatar URLs
    const avatarStats = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN "avatarUrl" IS NOT NULL AND "avatarUrl" != '' THEN 1 END) as with_avatar,
        COUNT(CASE WHEN "avatarUrl" IS NULL OR "avatarUrl" = '' THEN 1 END) as without_avatar
      FROM golfers
    `);
    
    const { total, with_avatar, without_avatar } = avatarStats.rows[0];
    
    console.log('\nAvatar Stats:');
    console.log(`Total golfers: ${total}`);
    console.log(`Golfers with avatars: ${with_avatar} (${((with_avatar / total) * 100).toFixed(1)}%)`);
    console.log(`Golfers without avatars: ${without_avatar} (${((without_avatar / total) * 100).toFixed(1)}%)`);
    
    console.log('\nVerification complete!');
    
  } catch (error) {
    console.error('Error verifying golfers:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Execute verification
verifyGolfers();