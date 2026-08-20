const { Pool } = require("pg");
const { databaseUrl } = require("../config");
const { schemaStatements } = require("./schema");
const { migrateStoredFilePaths } = require("../utils/files");

let pool;

function getPool() {
  if (!pool) {
    pool = new Pool({ connectionString: databaseUrl });
  }
  return pool;
}

async function query(text, params) {
  return getPool().query(text, params);
}

async function withTransaction(callback) {
  const client = await getPool().connect();
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
  try {
    await query("SELECT 1");
  } catch (error) {
    throw new Error(
      `Не удалось подключиться к PostgreSQL (${databaseUrl}). Проверьте DB_HOST, DB_PORT, DB_NAME, DB_USER и DB_PASSWORD в backend/.env. ${error.message}`
    );
  }

  for (const statement of schemaStatements) {
    await query(statement);
  }

  await query("ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_status_check");
  await query(
    `ALTER TABLE documents ADD CONSTRAINT documents_status_check CHECK (status IN ('draft', 'published', 'archived'))`
  );
  await query("ALTER TABLE documents ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ");
  await query("ALTER TABLE documents ADD COLUMN IF NOT EXISTS deleted_by BIGINT REFERENCES users(id)");
  await query(`
    CREATE INDEX IF NOT EXISTS idx_documents_deleted_at
      ON documents(deleted_at)
      WHERE deleted_at IS NOT NULL
  `);
  await query(`
    ALTER TABLE documents
    ADD COLUMN IF NOT EXISTS folder_id BIGINT REFERENCES document_folders(id) ON DELETE SET NULL
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_documents_folder_id
      ON documents(folder_id)
  `);
  await migrateStoredFilePaths(query);
}

module.exports = {
  query,
  withTransaction,
  initializeDatabase,
  getPool,
};
