/**
 * Next.js instrumentation hook.
 *
 * Runs once when the server boots (dev and prod) and provisions the database:
 * creates tables/indexes, loads the destination knowledge base and guarantees the
 * demo login. It never throws - a missing PostgreSQL only produces a clear log.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { checkDbConnection, DATABASE_URL } = await import("@/db");

    if (!DATABASE_URL) {
      console.error(
        "[BOOT] PostgreSQL not connected - check DATABASE_URL.\n" +
          "[BOOT] Copy .env.example to .env and set:\n" +
          "[BOOT]   DATABASE_URL=postgresql://postgres:password@localhost:5432/myapp",
      );
    }

    const connection = await checkDbConnection();
    if (!connection.ok) {
      console.error(`[BOOT] ${connection.message}`);
      console.error("[BOOT] The app will keep running; fix .env or start PostgreSQL and reload.");
      return;
    }

    const { ensureDatabaseReady } = await import("@/db/bootstrap");
    const result = await ensureDatabaseReady();
    if (!result.ok) {
      console.error(`[BOOT] database bootstrap failed: ${result.message}`);
    }
  } catch (error) {
    console.error("[BOOT] instrumentation error:", error instanceof Error ? error.message : error);
  }
}
