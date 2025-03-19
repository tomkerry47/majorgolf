#!/bin/bash

# Migration script to transition from Supabase to direct PostgreSQL

echo "==== Starting core component migration from Supabase to PostgreSQL ===="

# Step 1: Create a backup of existing files
echo "Creating backup of key files..."
mkdir -p backups
cp server/db.ts backups/db.ts.bak
cp server/storage.ts backups/storage.ts.bak
cp server/routes.ts backups/routes.ts.bak
cp shared/schema.ts backups/schema.ts.bak

# Step 2: Update the database connection (skip if already done)
echo "Updating database connection..."
echo "Skipping db.ts update - file already updated manually"

# Step 3: Update database storage implementation
echo "Updating storage implementation..."
cp server/storage.ts.fix server/storage.ts
echo "Storage implementation updated"

# Step 4: Update API routes
echo "Updating API routes..."
cp server/routes.ts.new server/routes.ts
echo "API routes updated"

# Step 5: Add environment variable for JWT secret
echo "Adding JWT secret to environment variables..."
if ! grep -q "JWT_SECRET" .env; then
  echo "JWT_SECRET=your_golf_syndicate_jwt_secret_key" >> .env
  echo "JWT secret added to .env file"
else
  echo "JWT secret already exists in .env file"
fi

# Step 6: Start application with updated components
echo "Starting application with updated components..."
npm run dev &

echo "==== Core component migration completed! ===="
echo "The application is now configured to use direct PostgreSQL instead of Supabase."
echo "Note: Data migration will be handled separately after testing core functionality."