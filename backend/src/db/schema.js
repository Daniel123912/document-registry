const schemaStatements = [
  `
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('responsible', 'employee')),
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS documents (
      id BIGSERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL,
      number TEXT NOT NULL DEFAULT '',
      document_date DATE NOT NULL,
      due_date DATE NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
      author_id BIGINT NOT NULL REFERENCES users(id),
      draft_file_path TEXT,
      draft_original_filename TEXT,
      draft_mime_type TEXT,
      active_version_no INTEGER NOT NULL DEFAULT 0,
      deleted_at TIMESTAMPTZ,
      deleted_by BIGINT REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS document_folders (
      id BIGSERIAL PRIMARY KEY,
      type TEXT NOT NULL,
      parent_id BIGINT REFERENCES document_folders(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS document_versions (
      id BIGSERIAL PRIMARY KEY,
      document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      version_no INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      change_reason TEXT NOT NULL,
      created_by BIGINT NOT NULL REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (document_id, version_no)
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS document_assignments (
      id BIGSERIAL PRIMARY KEY,
      document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (document_id, user_id)
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS document_acknowledgements (
      id BIGSERIAL PRIMARY KEY,
      document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      version_no INTEGER NOT NULL,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (document_id, version_no, user_id)
    );
  `,
  `
    CREATE INDEX IF NOT EXISTS idx_documents_author_id
      ON documents(author_id);
  `,
  `
    CREATE INDEX IF NOT EXISTS idx_document_versions_document_id
      ON document_versions(document_id);
  `,
  `
    CREATE INDEX IF NOT EXISTS idx_document_assignments_user_id
      ON document_assignments(user_id);
  `,
  `
    CREATE INDEX IF NOT EXISTS idx_document_acks_document_version
      ON document_acknowledgements(document_id, version_no);
  `,
  `
    CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_type_number_unique
      ON documents(type, number)
      WHERE COALESCE(number, '') <> ''
  `,
  `
    CREATE TABLE IF NOT EXISTS document_number_allocations (
      type TEXT NOT NULL,
      number TEXT NOT NULL,
      document_id BIGINT REFERENCES documents(id) ON DELETE SET NULL,
      allocated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (type, number)
    );
  `,
  `
    CREATE INDEX IF NOT EXISTS idx_document_folders_type
      ON document_folders(type);
  `,
  `
    CREATE INDEX IF NOT EXISTS idx_document_folders_parent_id
      ON document_folders(parent_id);
  `,
];

module.exports = {
  schemaStatements,
};
