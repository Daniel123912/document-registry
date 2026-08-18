const path = require("path");
const fs = require("fs");
const { Pool: PostgresPool } = require("pg");
const { newDb } = require("pg-mem");
const { databaseUrl, useInMemoryDb, usePostgres } = require("./config");
const { schemaStatements } = require("./schema");

let poolPromise;

function wrapPglite(db) {
  const runQuery = (executor) => (text, params) => executor.query(text, params || []);

  return {
    kind: "pglite",
    query: runQuery(db),
    connect: async () => ({
      query: runQuery(db),
      release() {},
    }),
    transaction: (callback) =>
      db.transaction(async (tx) => callback({ query: runQuery(tx) })),
  };
}

async function createPool() {
  if (useInMemoryDb) {
    const memoryDb = newDb();
    const { Pool } = memoryDb.adapters.createPg();
    return new Pool();
  }

  if (usePostgres) {
    return new PostgresPool({
      connectionString: databaseUrl,
    });
  }

  const { PGlite } = require("@electric-sql/pglite");
  const dataDir = path.join(
    process.env.ProgramData || "C:\\ProgramData",
    "bakor-docflow",
    "pglite"
  );
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new PGlite(dataDir);
  await db.waitReady;
  return wrapPglite(db);
}

function getPool() {
  if (!poolPromise) {
    poolPromise = createPool();
  }
  return poolPromise;
}

async function query(text, params) {
  const pool = await getPool();
  return pool.query(text, params);
}

async function withTransaction(callback) {
  const pool = await getPool();

  if (typeof pool.transaction === "function") {
    return pool.transaction(callback);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function initializeDatabase() {
  for (const statement of schemaStatements) {
    await query(statement);
  }

  try {
    await query("ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_status_check");
    await query(
      `ALTER TABLE documents ADD CONSTRAINT documents_status_check CHECK (status IN ('draft', 'published', 'archived'))`
    );
  } catch (error) {
    // Constraint already matches or the engine does not support ALTER.
  }
}

module.exports = {
  query,
  withTransaction,
  initializeDatabase,
  getPool,
};
