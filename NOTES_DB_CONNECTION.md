# Connecting to the Database from Scripts

When running standalone scripts (e.g., in the `scripts/` directory) that need to interact with the PostgreSQL database, follow these steps to ensure the database connection string from the `.env` file is loaded correctly:

1.  **Install `dotenv`:** Make sure `dotenv` is listed in `devDependencies` in `package.json`.
2.  **Load `.env` File:** Use `dotenv.config()` at the *beginning* of your script to load environment variables from the `.env` file located at the project root.
3.  **Derive `__dirname`:** Since this project uses ES Modules (`"type": "module"` in `package.json`), `__dirname` is not available globally. Derive it using `import.meta.url` and `path.dirname`.
4.  **Initialize Pool *After* dotenv:** Import the `pg` Pool *after* calling `dotenv.config()`. Initialize a *new* Pool instance within your script using `process.env.DATABASE_URL`. Do **not** import the pre-initialized `pool` or `pgClient` from `server/db.ts`, as they might have been initialized before `dotenv` loaded the variables in the script's context.
5.  **Query:** Use the locally created client/pool to execute database queries.
6.  **Close Pool:** Ensure you call `pool.end()` in a `finally` block to close the connection when the script finishes.

## Example Script (`scripts/example_db_script.ts`)

```typescript
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url'; 
import pg from 'pg'; // Import pg AFTER dotenv

// 1. Derive __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 2. Load .env file (assuming it's in the project root, one level up from scripts/)
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// 3. Check if DATABASE_URL is loaded
if (!process.env.DATABASE_URL) {
  console.error('Error: DATABASE_URL environment variable not found. Make sure .env file exists and is loaded correctly.');
  process.exit(1);
}

// 4. Initialize a NEW Pool instance here
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = { query: (text: string, params?: any[]) => pool.query(text, params) }; 

// 5. Main script logic
async function runQuery() {
  try {
    console.log('Connecting to database...');
    const result = await client.query('SELECT NOW() as now'); // Example query
    console.log('Database time:', result.rows[0].now);
    // ... add your script logic here ...

  } catch (error) {
    console.error('Error executing query:', error);
  } finally {
    // 6. Close the pool
    await pool.end(); 
    console.log('Database pool closed.');
  }
}

runQuery();

```

**To Run:**

```bash
npx tsx scripts/example_db_script.ts 
```

This approach ensures that scripts reliably connect to the database specified in the `.env` file.
