#!/bin/bash

# Migration script to transition from Supabase to direct PostgreSQL

echo "==== Starting complete migration from Supabase to PostgreSQL ===="

# Step 1: Create a backup of existing files
echo "Creating backup of key files..."
mkdir -p backups
cp server/db.ts backups/db.ts.bak
cp server/storage.ts backups/storage.ts.bak
cp server/routes.ts backups/routes.ts.bak
cp shared/schema.ts backups/schema.ts.bak

# Step 2: Update the database connection
echo "Updating database connection..."
cp server/db.ts backups/db.ts.bak
echo "Skipping db.ts update - file already updated manually"

# Step 3: Migrate the data
echo "Migrating data from Supabase to PostgreSQL..."
node scripts/migrate-to-postgres.mjs

# Step 4: Migrate user authentication
echo "Migrating authentication..."
node scripts/migrate-auth.mjs

# Step 5: Update database storage implementation
echo "Updating storage implementation..."
cp server/storage.ts.fix server/storage.ts
echo "Storage implementation updated"

# Step 6: Update API routes
echo "Updating API routes..."
cp server/routes.ts.new server/routes.ts
echo "API routes updated"

# Step 7: Restart the application
echo "Restarting the application..."
npm run dev &

echo "==== Migration completed successfully! ===="
echo "The application is now using direct PostgreSQL instead of Supabase"