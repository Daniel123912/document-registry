const { query } = require("../db");

async function listAcknowledgementReport() {
  const result = await query(`
    SELECT
      d.id,
      d.title,
      d.active_version_no,
      COUNT(DISTINCT da.user_id) AS assigned_count,
      COUNT(DISTINCT ack.user_id) AS acknowledged_count
    FROM documents d
    LEFT JOIN document_assignments da ON da.document_id = d.id
    LEFT JOIN document_acknowledgements ack
      ON ack.document_id = d.id AND ack.version_no = d.active_version_no
    WHERE d.deleted_at IS NULL
    GROUP BY d.id
    ORDER BY d.created_at DESC
  `);

  return result.rows.map((row) => ({
    id: Number(row.id),
    title: row.title,
    activeVersionNo: Number(row.active_version_no),
    assignedCount: Number(row.assigned_count),
    acknowledgedCount: Number(row.acknowledged_count),
    pendingCount: Number(row.assigned_count) - Number(row.acknowledged_count),
  }));
}

module.exports = {
  listAcknowledgementReport,
};
