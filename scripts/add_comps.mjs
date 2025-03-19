// Script to add more golf competitions to the database
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool } from '@neondatabase/serverless';
import { competitions } from '../shared/schema.js';
import ws from 'ws';

// Configure Neon for WebSockets
import { neonConfig } from '@neondatabase/serverless';
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

    for (const competition of newCompetitions) {
      console.log(`Adding competition: ${competition.name}`);
      
      // Check if it already exists
      const existingCompetitions = await db.select().from(competitions).where(
        { name: competition.name }
      );
      
      if (existingCompetitions.length === 0) {
        const [result] = await db.insert(competitions).values(competition).returning();
        console.log(`Added competition with ID: ${result.id}`);
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