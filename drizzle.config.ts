import { defineConfig } from "drizzle-kit";

// Same env files as Next (.env.local wins); DATABASE_URL is only needed to migrate, not to generate.
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // Not there: fine.
  }
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  // Neon Auth's tables live in the `neon_auth` schema, which Neon manages: never touch it.
  schemaFilter: ["public"],
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  strict: true,
});
