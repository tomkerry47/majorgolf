// Script to add more competitions to the database
import { db } from "../server/db.js";
import { competitions } from "../shared/schema.js";

// Fix for ESM modules
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

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
      // Check if the competition already exists
      const existingCompetition = await db
        .select()
        .from(competitions)
        .where({ name: competition.name });

      if (existingCompetition.length === 0) {
        await db.insert(competitions).values(competition);
        console.log(`Added competition: ${competition.name}`);
      } else {
        console.log(`Competition already exists: ${competition.name}`);
      }
    }

    console.log("Completed adding competitions!");
  } catch (error) {
    console.error("Error adding competitions:", error);
  } finally {
    process.exit(0);
  }
}

addCompetitions();