import fs from "node:fs";
import path from "node:path";
import initSqlJs, { type Database as SqlJsDatabase } from "sql.js";
import { drizzle, type SQLJsDatabase } from "drizzle-orm/sql-js";
import * as schema from "./schema";

/**
 * sql.js is a pure WASM build of SQLite — it needs zero native compilation,
 * so it works identically on every OS/Node version with no build tools,
 * unlike better-sqlite3 (which needs node-gyp + a C++ toolchain) or
 * node:sqlite (which needs a very recent Node version). This is the
 * trade-off: sql.js keeps the whole database in memory and we explicitly
 * persist it to disk after writes (see persist() below), rather than
 * writing straight through to a file like better-sqlite3 does.
 */

const DB_PATH = (process.env.DATABASE_URL ?? "file:./dev.db").replace(/^file:/, "");

const globalForDb = globalThis as unknown as {
  sqlJsDb?: SqlJsDatabase;
  drizzleDb?: SQLJsDatabase<typeof schema>;
  dbInitPromise?: Promise<SQLJsDatabase<typeof schema>>;
};

async function init(): Promise<SQLJsDatabase<typeof schema>> {
  const SQL = await initSqlJs({
    // Locate the sql.js WASM binary inside node_modules so this works
    // both in `next dev`/`next start` and in plain tsx scripts.
    locateFile: (file) => path.join(process.cwd(), "node_modules", "sql.js", "dist", file),
  });

  const fileExists = fs.existsSync(DB_PATH);
  const fileBuffer = fileExists ? fs.readFileSync(DB_PATH) : undefined;
  const sqlJsDb = new SQL.Database(fileBuffer);

  globalForDb.sqlJsDb = sqlJsDb;
  const drizzleDb = drizzle(sqlJsDb, { schema });
  globalForDb.drizzleDb = drizzleDb;
  return drizzleDb;
}

/** Get the (singleton, lazily-initialized) Drizzle database instance. */
export async function getDb(): Promise<SQLJsDatabase<typeof schema>> {
  if (globalForDb.drizzleDb) return globalForDb.drizzleDb;
  if (!globalForDb.dbInitPromise) globalForDb.dbInitPromise = init();
  return globalForDb.dbInitPromise;
}

/** Write the in-memory database back to dev.db. Call after any INSERT/UPDATE/DELETE. */
export function persist() {
  if (!globalForDb.sqlJsDb) return;
  const data = globalForDb.sqlJsDb.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

export { schema };
