import 'dotenv/config'; // Load .env file variables
import { storage } from '../server/storage'; // Adjust path as needed
import { type InsertUser } from '../shared/schema'; // Adjust path as needed

const usersToCreate: InsertUser[] = [
  {
    email: 'thomaskerry@me.com',
    username: 'tomkerry',
    fullName: 'Tom Kerry',
    password: 'password123', // Storage layer will hash this
    isAdmin: true,
  },
  {
    email: 'jameskerry@me.com',
    username: 'jameskerry',
    fullName: 'James Kerry',
    password: 'password123', // Storage layer will hash this
    isAdmin: true,
  },
];

async function createAdminUsers() {
  console.log('Attempting to create admin users...');
  let createdCount = 0;
  let skippedCount = 0;

  for (const userData of usersToCreate) {
    try {
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        console.log(`User ${userData.email} already exists. Skipping creation.`);
        // Optionally update existing user to be admin if not already
        if (!existingUser.isAdmin) {
           console.log(`Updating existing user ${userData.email} to be admin.`);
           await storage.updateUser(existingUser.id, { isAdmin: true });
        }
        skippedCount++;
      } else {
        // Create the new user (password will be hashed by storage.createUser)
        const newUser = await storage.createUser({
            ...userData,
            // Ensure isAdmin is explicitly set, even though it's in userData
            isAdmin: true 
        });
        console.log(`Successfully created admin user: ${newUser.email} (ID: ${newUser.id})`);
        createdCount++;
      }
    } catch (error) {
      console.error(`Error processing user ${userData.email}:`, error);
    }
  }

  console.log(`\nFinished creating admin users.`);
  console.log(`Created: ${createdCount}, Skipped (already existed): ${skippedCount}`);
  process.exit(0); // Exit the script
}

createAdminUsers();
