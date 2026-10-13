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
  await migrateEmailTemplatesSchema(query);
  await migrateLettersSchema(query);
  await migrateStoredFilePaths(query);
  await migrateUsersPasswordStorage(query);
  await migrateDocumentNumberAllocations(query);
}

async function migrateDocumentNumberAllocations(query) {
  await query(`
    CREATE TABLE IF NOT EXISTS document_number_allocations (
      type TEXT NOT NULL,
      number TEXT NOT NULL,
      document_id BIGINT REFERENCES documents(id) ON DELETE SET NULL,
      allocated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (type, number)
    )
  `);
  await query(`
    INSERT INTO document_number_allocations (type, number, document_id)
    SELECT type, TRIM(number), id
    FROM documents
    WHERE TRIM(COALESCE(number, '')) <> ''
    ON CONFLICT (type, number) DO NOTHING
  `);
}

async function migrateUsersPasswordStorage(query) {
  const { encryptPassword } = require("../passwordVault");

  await query(`
    ALTER TABLE users
    DROP COLUMN IF EXISTS password_plain
  `);
  await query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS password_encrypted TEXT
  `);

  const responsibleEncrypted = encryptPassword("admin1234");
  if (responsibleEncrypted) {
    await query(
      `
        UPDATE users
        SET password_encrypted = $1
        WHERE email = 'responsible@bakor.local'
          AND password_encrypted IS NULL
      `,
      [responsibleEncrypted]
    );
  }

  const employeeEncrypted = encryptPassword("user1234");
  if (employeeEncrypted) {
    await query(
      `
        UPDATE users
        SET password_encrypted = $1
        WHERE email LIKE 'employee%@bakor.local'
          AND password_encrypted IS NULL
      `,
      [employeeEncrypted]
    );
  }
}

async function migrateLettersLegacySchema(query) {
  const legacyCheck = await query(`
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'letters'
      AND column_name = 'template_id'
  `);

  if (legacyCheck.rows.length === 0) {
    return;
  }

  await query(`ALTER TABLE letters ALTER COLUMN template_id DROP NOT NULL`);
  await query(`ALTER TABLE letters ALTER COLUMN recipient SET DEFAULT ''`);
  await query(`ALTER TABLE letters ALTER COLUMN recipient_contact SET DEFAULT ''`);
  await query(`ALTER TABLE letters ALTER COLUMN sender SET DEFAULT ''`);
  await query(`ALTER TABLE letters ALTER COLUMN address SET DEFAULT ''`);
  await query(`ALTER TABLE letters ALTER COLUMN email SET DEFAULT ''`);
  await query(`ALTER TABLE letters ALTER COLUMN outgoing_number SET DEFAULT 0`);
  await query(`ALTER TABLE letters ALTER COLUMN outgoing_year SET DEFAULT EXTRACT(YEAR FROM NOW())::INTEGER`);
  await query(`ALTER TABLE letters ALTER COLUMN outgoing_date SET DEFAULT CURRENT_DATE`);
  await query(`ALTER TABLE letters ALTER COLUMN body_json SET DEFAULT '{"type":"doc","content":[]}'::jsonb`);
}

async function migrateLettersSchema(query) {
  await query(`
    CREATE TABLE IF NOT EXISTS letters (
      id BIGSERIAL PRIMARY KEY,
      author_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      folder_id BIGINT REFERENCES email_template_folders(id) ON DELETE SET NULL,
      subject TEXT NOT NULL DEFAULT '',
      html_body TEXT NOT NULL DEFAULT '',
      layout_kind TEXT NOT NULL DEFAULT 'bakor_letter',
      to_emails TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent')),
      sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    ALTER TABLE letters
    ADD COLUMN IF NOT EXISTS author_id BIGINT REFERENCES users(id) ON DELETE CASCADE
  `);
  await query(`
    ALTER TABLE letters
    ADD COLUMN IF NOT EXISTS folder_id BIGINT REFERENCES email_template_folders(id) ON DELETE SET NULL
  `);
  await query(`
    ALTER TABLE letters
    ADD COLUMN IF NOT EXISTS subject TEXT NOT NULL DEFAULT ''
  `);
  await query(`
    ALTER TABLE letters
    ADD COLUMN IF NOT EXISTS html_body TEXT NOT NULL DEFAULT ''
  `);
  await query(`
    ALTER TABLE letters
    ADD COLUMN IF NOT EXISTS layout_kind TEXT NOT NULL DEFAULT 'bakor_letter'
  `);
  await query(`
    ALTER TABLE letters
    ADD COLUMN IF NOT EXISTS to_emails TEXT NOT NULL DEFAULT ''
  `);
  await query(`
    ALTER TABLE letters
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft'
  `);
  await query(`
    ALTER TABLE letters
    ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ
  `);
  await query(`
    ALTER TABLE letters
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `);
  await query(`
    ALTER TABLE letters
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_letters_folder_id
      ON letters(folder_id)
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_letters_status
      ON letters(status)
  `);
  await query(`
    ALTER TABLE letters
    ADD COLUMN IF NOT EXISTS outgoing_number INTEGER NOT NULL DEFAULT 0
  `);
  await query(`
    ALTER TABLE letters
    ADD COLUMN IF NOT EXISTS outgoing_date DATE NOT NULL DEFAULT CURRENT_DATE
  `);
  await query(`ALTER TABLE letters DROP CONSTRAINT IF EXISTS letters_status_check`);
  await query(
    `ALTER TABLE letters ADD CONSTRAINT letters_status_check CHECK (status IN ('draft', 'sent', 'confirmed'))`
  );
  await query(`
    UPDATE letters
    SET outgoing_number = 0
    WHERE status = 'draft' AND outgoing_number > 0
  `);
  await migrateLettersLegacySchema(query);
}

async function migrateEmailTemplatesSchema(query) {
  await query(`
    CREATE TABLE IF NOT EXISTS email_template_folders (
      id BIGSERIAL PRIMARY KEY,
      parent_id BIGINT REFERENCES email_template_folders(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_email_template_folders_parent_id
      ON email_template_folders(parent_id)
  `);

  const templatesTable = await query(`
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'email_templates'
  `);

  const columnCheck = await query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'email_templates'
      AND column_name = 'id'
  `);

  if (templatesTable.rows.length === 0) {
    await query(`
      CREATE TABLE email_templates (
        id BIGSERIAL PRIMARY KEY,
        folder_id BIGINT REFERENCES email_template_folders(id) ON DELETE SET NULL,
        trigger_kind TEXT NOT NULL CHECK (trigger_kind IN ('publish', 'new_version')),
        name TEXT NOT NULL,
        subject TEXT NOT NULL,
        html_body TEXT NOT NULL,
        is_default BOOLEAN NOT NULL DEFAULT FALSE,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  } else if (columnCheck.rows.length === 0) {
    await query(`
      CREATE TABLE email_templates_new (
        id BIGSERIAL PRIMARY KEY,
        folder_id BIGINT REFERENCES email_template_folders(id) ON DELETE SET NULL,
        trigger_kind TEXT NOT NULL CHECK (trigger_kind IN ('publish', 'new_version')),
        name TEXT NOT NULL,
        subject TEXT NOT NULL,
        html_body TEXT NOT NULL,
        is_default BOOLEAN NOT NULL DEFAULT FALSE,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await query(`
      INSERT INTO email_templates_new (trigger_kind, name, subject, html_body, is_default, updated_at)
      SELECT kind, name, subject, html_body, TRUE, updated_at
      FROM email_templates
    `);
    await query(`DROP TABLE email_templates`);
    await query(`ALTER TABLE email_templates_new RENAME TO email_templates`);
  }

  await query(`
    CREATE INDEX IF NOT EXISTS idx_email_templates_folder_id
      ON email_templates(folder_id)
  `);
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_email_templates_default_trigger
      ON email_templates(trigger_kind)
      WHERE is_default = TRUE
  `);
  await query(`
    ALTER TABLE email_templates
    ADD COLUMN IF NOT EXISTS layout_kind TEXT NOT NULL DEFAULT 'default'
  `);
}

module.exports = {
  query,
  withTransaction,
  initializeDatabase,
  getPool,
};
