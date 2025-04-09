import 'dotenv/config'; // Load .env variables
import { storage } from '../server/storage.ts'; // Import directly from .ts file
import { pool } from '../server/db.ts'; // Import pool for connection management

const userEmailToGrantAdmin = 'thomaskerry@me.com';

async function grantAdminRights() {
  console.log(`Attempting to grant admin rights to: ${userEmailToGrantAdmin}`);
  try {
    const user = await storage.getUserByEmail(userEmailToGrantAdmin);

    if (!user) {
      console.error(`Error: User with email ${userEmailToGrantAdmin} not found.`);
      return;
    }

    if (user.isAdmin) {
      console.log(`User ${userEmailToGrantAdmin} already has admin rights.`);
      return;
    }

    console.log(`Found user: ${user.username} (ID: ${user.id}). Updating isAdmin flag...`);
    await storage.updateUser(user.id, { isAdmin: true });
    console.log(`Successfully granted admin rights to ${userEmailToGrantAdmin}.`);

  } catch (error) {
     console.error(`Error granting admin rights to ${userEmailToGrantAdmin}:`, error);
   } finally {
     // Ensure the database connection is closed after the script runs
     await pool.end(); // Use pool.end() to close the connection
     console.log('Database connection closed.');
   }
}

grantAdminRights();
