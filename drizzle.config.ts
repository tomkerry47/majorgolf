import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  schemaFilter: ["public"], // Explicitly target the public schema
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
