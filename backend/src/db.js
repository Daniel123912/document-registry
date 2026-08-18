const { Pool: PostgresPool } = require("pg");
const { newDb } = require("pg-mem");
const { databaseUrl, useInMemoryDb } = require("./config");
const { schemaStatements } = require("./schema");

function createPool() {
  if (useInMemoryDb) {
    const memoryDb = newDb();
    const { Pool } = memoryDb.adapters.createPg();
    return new Pool();
  }

  return new PostgresPool({
    connectionString: databaseUrl,
  });
}

const pool = createPool();

async function query(text, params) {
  return pool.query(text, params);
}

async function withTransaction(callback) {
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
    // Constraint already matches or the in-memory engine does not support ALTER.
  }
}

module.exports = {
  pool,
  query,
  withTransaction,
  initializeDatabase,
};
