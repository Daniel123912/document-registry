const { query } = require("../db");

async function listAcknowledgementReport() {
  const result = await query(`
    SELECT
      d.id,
      d.title,
      d.type,
      d.folder_id,
      d.active_version_no,
      COUNT(DISTINCT da.user_id) AS assigned_count,
      COUNT(DISTINCT CASE WHEN da.user_id IS NOT NULL THEN ack.user_id END) AS acknowledged_count
    FROM documents d
    LEFT JOIN document_assignments da ON da.document_id = d.id
    LEFT JOIN document_acknowledgements ack
      ON ack.document_id = d.id
      AND ack.version_no = d.active_version_no
      AND ack.user_id = da.user_id
    WHERE d.deleted_at IS NULL
      AND d.status = 'published'
      AND d.type <> 'legal_entity'
    GROUP BY d.id
    ORDER BY d.type ASC, d.folder_id NULLS FIRST, d.title ASC
  `);

  return result.rows.map((row) => ({
    id: Number(row.id),
    title: row.title,
    type: row.type,
    folderId: row.folder_id == null ? null : Number(row.folder_id),
    activeVersionNo: Number(row.active_version_no),
    assignedCount: Number(row.assigned_count),
    acknowledgedCount: Number(row.acknowledged_count),
    pendingCount: Math.max(0, Number(row.assigned_count) - Number(row.acknowledged_count)),
  }));
}

module.exports = {
  listAcknowledgementReport,
};
