const test = require("node:test");
const assert = require("node:assert/strict");
const { newDb } = require("pg-mem");
const { schemaStatements } = require("../src/db/schema");

async function createDatabase() {
  const db = newDb();
  const { Pool } = db.adapters.createPg();
  const pool = new Pool();

  for (const statement of schemaStatements) {
    await pool.query(statement);
  }

  return pool;
}

test("docflow schema supports create publish version ack flow", async () => {
  const db = await createDatabase();

  const responsible = (
    await db.query(
    `
      INSERT INTO users (full_name, email, password_hash, role)
      VALUES ('Иван Петров', 'responsible@bakor.local', 'hash', 'responsible')
      RETURNING id
    `
    )
  ).rows[0];

  const employee = (
    await db.query(
    `
      INSERT INTO users (full_name, email, password_hash, role)
      VALUES ('Анна Смирнова', 'employee@bakor.local', 'hash', 'employee')
      RETURNING id
    `
    )
  ).rows[0];

  const document = (
    await db.query(
    `
      INSERT INTO documents (
        title, description, type, number, document_date, due_date, status, author_id
      )
      VALUES (
        'Порядок хранения новых товаров',
        'Описание документа',
        'new_goods',
        'NT-14/2026',
        '2026-03-13',
        '2026-03-20',
        'draft',
        $1
      )
      RETURNING id, status, active_version_no
    `,
    [responsible.id]
    )
  ).rows[0];

  assert.equal(document.status, "draft");
  assert.equal(document.active_version_no, 0);

  await db.query(
    `
      INSERT INTO document_assignments (document_id, user_id)
      VALUES ($1, $2)
    `,
    [document.id, employee.id]
  );

  await db.query(
    `
      INSERT INTO document_versions (
        document_id, version_no, file_path, original_filename, mime_type, change_reason, created_by
      )
      VALUES ($1, 1, '/tmp/doc-v1.pdf', 'doc-v1.pdf', 'application/pdf', 'Первичная публикация', $2)
    `,
    [document.id, responsible.id]
  );

  await db.query(
    `
      UPDATE documents
      SET status = 'published', active_version_no = 1
      WHERE id = $1
    `,
    [document.id]
  );

  let afterPublish = (
    await db.query(
    "SELECT status, active_version_no FROM documents WHERE id = $1",
    [document.id]
    )
  ).rows[0];
  assert.equal(afterPublish.status, "published");
  assert.equal(afterPublish.active_version_no, 1);

  await db.query(
    `
      INSERT INTO document_versions (
        document_id, version_no, file_path, original_filename, mime_type, change_reason, created_by
      )
      VALUES ($1, 2, '/tmp/doc-v2.pdf', 'doc-v2.pdf', 'application/pdf', 'Изменения в правилах', $2)
    `,
    [document.id, responsible.id]
  );

  await db.query(
    `
      UPDATE documents
      SET active_version_no = 2
      WHERE id = $1
    `,
    [document.id]
  );

  const afterVersion = (
    await db.query(
    "SELECT active_version_no FROM documents WHERE id = $1",
    [document.id]
    )
  ).rows[0];
  assert.equal(afterVersion.active_version_no, 2);

  await db.query(
    `
      INSERT INTO document_acknowledgements (document_id, version_no, user_id)
      VALUES ($1, $2, $3)
    `,
    [document.id, 2, employee.id]
  );

  const totals = (
    await db.query(
    `
      SELECT
        COUNT(DISTINCT da.user_id) AS assigned_count,
        COUNT(DISTINCT ack.user_id) AS acknowledged_count
      FROM documents d
      LEFT JOIN document_assignments da ON da.document_id = d.id
      LEFT JOIN document_acknowledgements ack
        ON ack.document_id = d.id AND ack.version_no = d.active_version_no
      WHERE d.id = $1
      GROUP BY d.id
    `,
    [document.id]
    )
  ).rows[0];

  assert.equal(Number(totals.assigned_count), 1);
  assert.equal(Number(totals.acknowledged_count), 1);

  await db.end();
});

test("document number must be unique inside document type", async () => {
  const db = await createDatabase();

  const responsible = (
    await db.query(
      `
        INSERT INTO users (full_name, email, password_hash, role)
        VALUES ('Иван Петров', 'responsible@bakor.local', 'hash', 'responsible')
        RETURNING id
      `
    )
  ).rows[0];

  await db.query(
    `
      INSERT INTO documents (
        title, description, type, number, document_date, due_date, status, author_id
      )
      VALUES (
        'Первый приказ',
        '',
        'order',
        'ПР0001',
        '2026-03-13',
        '2026-03-20',
        'draft',
        $1
      )
    `,
    [responsible.id]
  );

  await assert.rejects(
    db.query(
      `
        INSERT INTO documents (
          title, description, type, number, document_date, due_date, status, author_id
        )
        VALUES (
          'Второй приказ',
          '',
          'order',
          'ПР0001',
          '2026-03-14',
          '2026-03-21',
          'draft',
          $1
        )
      `,
      [responsible.id]
    )
  );

  await db.end();
});

test("acknowledgement report counts only currently assigned users", async () => {
  const db = await createDatabase();

  const responsible = (
    await db.query(
      `
        INSERT INTO users (full_name, email, password_hash, role)
        VALUES ('Иван Петров', 'responsible@bakor.local', 'hash', 'responsible')
        RETURNING id
      `
    )
  ).rows[0];

  const employee = (
    await db.query(
      `
        INSERT INTO users (full_name, email, password_hash, role)
        VALUES ('Анна Смирнова', 'employee@bakor.local', 'hash', 'employee')
        RETURNING id
      `
    )
  ).rows[0];

  const document = (
    await db.query(
      `
        INSERT INTO documents (
          title, description, type, number, document_date, due_date, status, author_id, active_version_no
        )
        VALUES (
          'Порядок хранения новых товаров',
          'Описание документа',
          'new_goods',
          'НТ0001',
          '2026-03-13',
          '2026-03-20',
          'published',
          $1,
          1
        )
        RETURNING id
      `,
      [responsible.id]
    )
  ).rows[0];

  await db.query(
    `
      INSERT INTO document_versions (
        document_id, version_no, file_path, original_filename, mime_type, change_reason, created_by
      )
      VALUES ($1, 1, '/tmp/doc-v1.pdf', 'doc-v1.pdf', 'application/pdf', 'Первичная публикация', $2)
    `,
    [document.id, responsible.id]
  );

  await db.query(
    `
      INSERT INTO document_assignments (document_id, user_id)
      VALUES ($1, $2)
    `,
    [document.id, employee.id]
  );

  await db.query(
    `
      INSERT INTO document_acknowledgements (document_id, version_no, user_id)
      VALUES ($1, 1, $2)
    `,
    [document.id, employee.id]
  );

  await db.query("DELETE FROM document_assignments WHERE document_id = $1 AND user_id = $2", [
    document.id,
    employee.id,
  ]);

  const totals = (
    await db.query(
      `
        SELECT
          COUNT(DISTINCT da.user_id) AS assigned_count,
          COUNT(DISTINCT CASE WHEN da.user_id IS NOT NULL THEN ack.user_id END) AS acknowledged_count
        FROM documents d
        LEFT JOIN document_assignments da ON da.document_id = d.id
        LEFT JOIN document_acknowledgements ack
          ON ack.document_id = d.id
          AND ack.version_no = d.active_version_no
          AND ack.user_id = da.user_id
        WHERE d.id = $1
        GROUP BY d.id
      `,
      [document.id]
    )
  ).rows[0];

  assert.equal(Number(totals.assigned_count), 0);
  assert.equal(Number(totals.acknowledged_count), 0);

  await db.end();
});
