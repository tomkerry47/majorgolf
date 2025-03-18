import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;

// Connect to the PostgreSQL database directly using DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Golfer data with PGA Tour top players (updated 2023/2024 list)
const golfers = [
  { rank: 1, name: 'Scottie Scheffler', avatarUrl: 'https://pga-tour-res.cloudinary.com/image/upload/c_fill,dpr_2.0,f_auto,g_face:center,h_360,q_auto,w_360/v1/pgatour/editorial/2023/08/07/ScottieHeadshot-1694.jpg' },
  { rank: 2, name: 'Rory McIlroy', avatarUrl: 'https://pga-tour-res.cloudinary.com/image/upload/c_fill,dpr_2.0,f_auto,g_face:center,h_360,q_auto,w_360/v1/pgatour/editorial/2023/08/07/RoryHeadshot-1695.jpg' },
  { rank: 3, name: 'Xander Schauffele', avatarUrl: 'https://pga-tour-res.cloudinary.com/image/upload/c_fill,dpr_2.0,f_auto,g_face:center,h_360,q_auto,w_360/v1/pgatour/editorial/2023/08/07/XanderHeadshot-1694.jpg' },
  { rank: 4, name: 'Wyndham Clark', avatarUrl: 'https://pga-tour-res.cloudinary.com/image/upload/c_fill,dpr_2.0,f_auto,g_face:center,h_360,q_auto,w_360/v1/pgatour/editorial/2023/08/07/WyndhamHeadshot-1694.jpg' },
  { rank: 5, name: 'Ludvig Åberg', avatarUrl: 'https://pga-tour-res.cloudinary.com/image/upload/c_fill,dpr_2.0,f_auto,g_face:center,h_360,q_auto,w_360/v1/pgatour/editorial/2023/08/07/LudvigHeadshot-1694.jpg' },
  { rank: 6, name: 'Viktor Hovland', avatarUrl: 'https://pga-tour-res.cloudinary.com/image/upload/c_fill,dpr_2.0,f_auto,g_face:center,h_360,q_auto,w_360/v1/pgatour/editorial/2023/08/07/ViktorHeadshot-1694.jpg' },
  { rank: 7, name: 'Bryson DeChambeau', avatarUrl: 'https://pga-tour-res.cloudinary.com/image/upload/c_fill,dpr_2.0,f_auto,g_face:center,h_360,q_auto,w_360/v1/pgatour/editorial/2023/08/07/BrysonHeadshot-1694.jpg' },
  { rank: 8, name: 'Jon Rahm', avatarUrl: 'https://pga-tour-res.cloudinary.com/image/upload/c_fill,dpr_2.0,f_auto,g_face:center,h_360,q_auto,w_360/v1/pgatour/editorial/2023/08/03/RahmHeadshot-1694.jpg' },
  { rank: 9, name: 'Patrick Cantlay', avatarUrl: 'https://pga-tour-res.cloudinary.com/image/upload/c_fill,dpr_2.0,f_auto,g_face:center,h_360,q_auto,w_360/v1/pgatour/editorial/2023/08/07/CantlayHeadshot-1694.jpg' },
  { rank: 10, name: 'Collin Morikawa', avatarUrl: 'https://pga-tour-res.cloudinary.com/image/upload/c_fill,dpr_2.0,f_auto,g_face:center,h_360,q_auto,w_360/v1/pgatour/editorial/2023/08/07/MorikawaHeadshot-1694.jpg' },
];

// Function to generate names for golfers ranked 51-500
function generateGolferName(rank) {
  const firstNames = [
    'James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Charles',
    'Daniel', 'Matthew', 'Anthony', 'Mark', 'Donald', 'Steven', 'Paul', 'Andrew', 'Joshua', 'Kenneth',
    'Kevin', 'Brian', 'George', 'Timothy', 'Ronald', 'Jason', 'Edward', 'Jeffrey', 'Ryan', 'Jacob',
  ];
  
  const lastNames = [
    'Smith', 'Johnson', 'Williams', 'Jones', 'Brown', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor',
    'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin', 'Thompson', 'Garcia', 'Martinez', 'Robinson',
    'Clark', 'Rodriguez', 'Lewis', 'Lee', 'Walker', 'Hall', 'Allen', 'Young', 'Hernandez', 'King',
  ];
  
  // Use math to generate a consistent name based on rank
  const fnIndex = (rank * 13) % firstNames.length;
  const lnIndex = (rank * 17) % lastNames.length;
  
  return `${firstNames[fnIndex]} ${lastNames[lnIndex]}`;
}

// Generate more golfers to reach 500 total
for (let i = 11; i <= 500; i++) {
  golfers.push({
    rank: i,
    name: generateGolferName(i),
    avatarUrl: null
  });
}

async function insertGolfers() {
  const client = await pool.connect();
  
  try {
    console.log('Starting to insert PGA golfers using direct database connection...');
    
    // Start a transaction
    await client.query('BEGIN');
    
    // First, check if there are any golfers referenced in selections
    const referencedGolfers = await client.query(`
      SELECT DISTINCT g.id, g.rank, g.name, g."avatarUrl"
      FROM golfers g
      WHERE g.id IN (
        SELECT "golfer1Id" FROM selections
        UNION
        SELECT "golfer2Id" FROM selections
        UNION
        SELECT "golfer3Id" FROM selections
      )
    `);
    
    console.log(`Found ${referencedGolfers.rows.length} golfers referenced in selections that will be preserved.`);
    
    // Create a set of IDs to preserve
    const preservedIds = new Set(referencedGolfers.rows.map(g => g.id));
    
    // Delete golfers that aren't referenced in selections
    await client.query(`
      DELETE FROM golfers
      WHERE id NOT IN (
        SELECT "golfer1Id" FROM selections
        UNION
        SELECT "golfer2Id" FROM selections
        UNION
        SELECT "golfer3Id" FROM selections
      )
    `);
    console.log('Deleted golfers not referenced in selections.');

    // Get the list of existing golfers after deletion
    const existingGolfers = await client.query('SELECT id, rank, name FROM golfers');
    console.log(`Remaining golfers in database: ${existingGolfers.rows.length}`);
    
    // Create a map of existing golfer names to their ids for later reference
    const existingGolferMap = new Map();
    existingGolfers.rows.forEach(g => {
      existingGolferMap.set(g.name.toLowerCase(), g.id);
    });
    
    // Filter out golfers that already exist in the database
    const golfersToInsert = golfers.filter(golfer => 
      !existingGolferMap.has(golfer.name.toLowerCase())
    );
    
    console.log(`Inserting ${golfersToInsert.length} new golfers...`);
    
    // Insert new golfers in batches
    const batchSize = 100;
    for (let i = 0; i < golfersToInsert.length; i += batchSize) {
      const batch = golfersToInsert.slice(i, i + batchSize);
      
      if (batch.length === 0) continue;
      
      // Build a single query with multiple VALUES to improve performance
      let query = 'INSERT INTO golfers (rank, name, "avatarUrl") VALUES ';
      const values = [];
      
      batch.forEach((golfer, index) => {
        const offset = index * 3;
        query += `($${offset + 1}, $${offset + 2}, $${offset + 3})`;
        if (index < batch.length - 1) {
          query += ', ';
        }
        
        values.push(golfer.rank, golfer.name, golfer.avatarUrl);
      });
      
      await client.query(query, values);
      console.log(`Successfully inserted batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(golfersToInsert.length / batchSize)}`);
    }
    
    // Update existing golfers with new information (rank, avatarUrl)
    for (const golfer of golfers) {
      const id = existingGolferMap.get(golfer.name.toLowerCase());
      if (id) {
        await client.query(
          'UPDATE golfers SET rank = $1, "avatarUrl" = $2 WHERE id = $3',
          [golfer.rank, golfer.avatarUrl, id]
        );
      }
    }
    
    // Commit the transaction
    await client.query('COMMIT');
    
    console.log(`Successfully updated golfers database. Total golfers: ${golfersToInsert.length + existingGolfers.rows.length}`);
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error('Error inserting golfers:', error);
  } finally {
    client.release();
    pool.end();
  }
}

// Execute the function
insertGolfers();