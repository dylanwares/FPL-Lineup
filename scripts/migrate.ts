/**
 * Applies the SQL migrations in drizzle/ to DATABASE_URL (local Docker or
 * Neon). Run with `pnpm db:migrate`; already-applied migrations are skipped.
 */
import path from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // Not there: fine.
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (see .env.example).");
  const client = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle({ client }), {
      migrationsFolder: path.resolve(import.meta.dirname, "../drizzle"),
    });
    console.log(`migrate: up to date (${new URL(url).hostname})`);
  } finally {
    await client.end();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
