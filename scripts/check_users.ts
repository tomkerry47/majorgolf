import 'dotenv/config'; // Load .env file variables
import { db } from '../server/db'; // Adjust path as needed
import { users } from '../shared/schema'; // Adjust path as needed

async function checkUsersTable() {
  console.log('Querying users table...');
  try {
    const allUsers = await db.select().from(users);
    if (allUsers.length === 0) {
      console.log('The users table is currently empty.');
    } else {
      console.log('Users found in table:');
      console.table(allUsers); // Display results in a table format
    }
  } catch (error) {
    console.error('Error querying users table:', error);
  } finally {
    // Ensure the script exits, especially if using a pooled connection that might keep it open
    process.exit(0); 
  }
}

checkUsersTable();
