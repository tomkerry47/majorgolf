// scripts/reset_all_passwords.ts
import { db, hashPassword } from '../server/db'; // Adjust path if necessary
import { users } from '../shared/schema'; // Use relative path
import { count, sql } from 'drizzle-orm'; // Import count and sql from drizzle-orm

const NEW_PASSWORD = "password123";

async function resetAllPasswords() {
  console.log(`WARNING: This script will reset ALL user passwords to "${NEW_PASSWORD}".`);
  console.log("This is irreversible and highly insecure for production environments.");
  // In a real scenario, you might add a prompt here for confirmation.
  // For this automated script, we'll proceed after the warning.
  console.log("Proceeding with password reset...");

  try {
    // 1. Hash the new password
    const hashedPassword = await hashPassword(NEW_PASSWORD);
    console.log("New password hashed successfully.");

    // 2. Update all users' passwords
    // Drizzle's update without a .where() clause affects all rows.
    // The result object structure might vary; we'll fetch count separately for reliable logging.
    await db.update(users)
      .set({ password: hashedPassword });
      
    // Fetch the count of users for logging.
    const userCountResult = await db.select({ value: count() }).from(users); // Use count()
    const userCount = userCountResult[0]?.value ?? 0; // Access the count value

    console.log(`Successfully updated the password for ${userCount} users to "${NEW_PASSWORD}".`);
    console.log("Password reset complete.");

  } catch (error) {
    console.error("Error resetting passwords:", error);
    process.exit(1); // Exit with error code
  }
}

resetAllPasswords();
