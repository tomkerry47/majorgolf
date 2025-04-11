import 'dotenv/config'; // Load .env file variables
import { db } from '../server/db'; // Adjust path as needed
import { users, selections } from '../shared/schema'; // Adjust path as needed
import { eq, inArray, notInArray } from 'drizzle-orm'; // Import Drizzle operators, added notInArray

async function forceClearDatabase() {
  console.log('Starting forced database clear down, keeping admin users...');

  try {
    await db.transaction(async (tx) => {
      // 1. Find the IDs of admin users to keep
      const adminUsers = await tx.select({ id: users.id })
        .from(users)
        .where(eq(users.isAdmin, true));

      const adminUserIds = adminUsers.map(u => u.id);
      // Handle case where there might be no admins (though unlikely now)
      const safeAdminUserIds = adminUserIds.length > 0 ? adminUserIds : [-1]; // Use -1 if empty to avoid issues with notInArray([])

      console.log(`Admin User IDs to keep: ${adminUserIds.join(', ')}`);

      // 2. Delete selections for the admin users being kept (Optional, but matches original request)
      if (adminUserIds.length > 0) {
        const deletedAdminSelections = await tx.delete(selections)
          .where(inArray(selections.userId, adminUserIds))
          .returning({ id: selections.id });
        console.log(`Deleted ${deletedAdminSelections.length} selections for admin users.`);
      } else {
        console.log(`No admin users found, skipping selection deletion for admins.`);
      }

      // 3. Delete selections for non-admin users (orphaned or existing)
      // Delete selections where the userId is NOT in the list of admin IDs
      const deletedNonAdminSelections = await tx.delete(selections)
        .where(notInArray(selections.userId, safeAdminUserIds)) // Use notInArray with the safe list
        .returning({ id: selections.id });
      console.log(`Deleted ${deletedNonAdminSelections.length} selections belonging to non-admin/deleted users.`);
      
      // 4. Find IDs of non-admin users (for deletion step)
      const nonAdminUsers = await tx.select({ id: users.id })
        .from(users)
        .where(eq(users.isAdmin, false));
      const nonAdminUserIds = nonAdminUsers.map(u => u.id);
      console.log(`Non-Admin User IDs to delete: ${nonAdminUserIds.join(', ')}`);
        
      // 5. Delete all users that are NOT admins (if any exist)
      if (nonAdminUserIds.length > 0) {
        const deletedUsers = await tx.delete(users)
          .where(inArray(users.id, nonAdminUserIds)) // Use the fetched IDs
          .returning({ id: users.id, email: users.email });
        console.log(`Deleted ${deletedUsers.length} non-admin users.`);
      } else {
         console.log(`No non-admin users found to delete.`);
      }

      // 6. Reset waiver chip status for remaining admin users
      if (adminUserIds.length > 0) {
        console.log(`Attempting to reset waiver status for admin IDs: ${adminUserIds.join(', ')}`); // Added log
        const updatedAdmins = await tx.update(users)
          .set({
            hasUsedWaiverChip: false,
            waiverChipUsedCompetitionId: null,
            waiverChipOriginalGolferId: null,
            waiverChipReplacementGolferId: null
          })
          .where(inArray(users.id, adminUserIds))
          .returning({ id: users.id });
        // Log the actual IDs updated for verification
        const updatedAdminIds = updatedAdmins.map(u => u.id);
        console.log(`Reset waiver chip status for ${updatedAdmins.length} admin users. IDs updated: ${updatedAdminIds.join(', ')}`); // Modified log
      } else {
        console.log(`No admin users found, skipping waiver chip reset.`);
      }
    });

    console.log('Forced database clear down successful.');

  } catch (error) {
    console.error('Error during forced database clear down:', error);
  } finally {
    // Ensure the script exits
    process.exit(0); 
  }
}

forceClearDatabase();
