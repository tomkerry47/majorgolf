CREATE TABLE IF NOT EXISTS "app_metadata" (
  "id" SERIAL PRIMARY KEY NOT NULL,
  "meta_key" VARCHAR(255) NOT NULL UNIQUE,
  "meta_value_timestamp" TIMESTAMP,
  "updated_at" TIMESTAMP DEFAULT now() NOT NULL
);

-- Optional: Add an index on meta_key for faster lookups if not already covered by UNIQUE
-- CREATE INDEX IF NOT EXISTS "app_metadata_meta_key_idx" ON "app_metadata" ("meta_key");