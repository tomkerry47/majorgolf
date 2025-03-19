// Script to add more golf competitions to the database
require('dotenv').config();
const { Pool } = require('@neondatabase/serverless');
const { drizzle } = require('drizzle-orm/neon-serverless');
const ws = require('ws');
const { sql, eq } = require('drizzle-orm');

// Configure the database connection
const neonConfig = require('@neondatabase/serverless').neonConfig;
neonConfig.webSocketConstructor = ws;

// Create database connection
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

async function addCompetitions() {
  try {
    console.log("Adding additional golf competitions...");

    const newCompetitions = [
      {
        name: "US Open 2025",
        venue: "Oakmont Country Club, Pennsylvania",
        startDate: new Date("2025-06-12"),
        endDate: new Date("2025-06-15"),
        selectionDeadline: new Date("2025-06-11"),
        isActive: false,
        isComplete: false,
        description: "The 125th U.S. Open Championship",
        imageUrl: "https://golf-assets.com/usopen2025.jpg"
      },
      {
        name: "The Open Championship 2025",
        venue: "Royal Portrush, Northern Ireland",
        startDate: new Date("2025-07-17"),
        endDate: new Date("2025-07-20"),
        selectionDeadline: new Date("2025-07-16"),
        isActive: false,
        isComplete: false,
        description: "The 153rd Open Championship",
        imageUrl: "https://golf-assets.com/openChampionship2025.jpg"
      },
      {
        name: "PGA Championship 2025",
        venue: "Quail Hollow Club, North Carolina",
        startDate: new Date("2025-05-15"),
        endDate: new Date("2025-05-18"),
        selectionDeadline: new Date("2025-05-14"),
        isActive: false,
        isComplete: false,
        description: "The 107th PGA Championship",
        imageUrl: "https://golf-assets.com/pgachampionship2025.jpg"
      }
    ];

    // Insert each competition directly using SQL
    for (const competition of newCompetitions) {
      console.log(`Adding competition: ${competition.name}`);
      
      // Check if it already exists
      const existingResult = await db.execute(
        sql`SELECT id FROM competitions WHERE name = ${competition.name}`
      );
      
      if (existingResult.length === 0) {
        const result = await db.execute(
          sql`INSERT INTO competitions 
              (name, venue, "startDate", "endDate", "selectionDeadline", "isActive", "isComplete", description, "imageUrl") 
              VALUES 
              (${competition.name}, ${competition.venue}, ${competition.startDate}, 
               ${competition.endDate}, ${competition.selectionDeadline}, ${competition.isActive}, 
               ${competition.isComplete}, ${competition.description}, ${competition.imageUrl})
              RETURNING id`
        );
        console.log(`Added competition with ID: ${result[0]?.id}`);
      } else {
        console.log(`Competition already exists: ${competition.name}`);
      }
    }

    console.log("Completed adding competitions!");
  } catch (error) {
    console.error("Error adding competitions:", error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

addCompetitions();