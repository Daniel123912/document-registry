const { query, withTransaction } = require("../db");
const { sendMail } = require("./mail");
const { htmlToPlainText } = require("./emailTemplates");
const { composeLetterHtml, isBakorLetterLayout } = require("../utils/letterLayout");
const { applyOutgoingRequisites, serializeCalendarDate } = require("../utils/letterOutgoing");

const LAYOUT_KINDS = ["default", "bakor_letter"];
const STATUSES = ["draft", "sent", "confirmed"];
const FINALIZED_STATUSES = ["sent", "confirmed"];

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function mapRow(row) {
  return {
    id: Number(row.id),
    authorId: Number(row.author_id),
    folderId: row.folder_id == null ? null : Number(row.folder_id),
    subject: row.subject,
    htmlBody: row.html_body,
    layoutKind: row.layout_kind || "bakor_letter",
    toEmails: row.to_emails,
    status: row.status,
    sentAt: row.sent_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    authorName: row.author_name || null,
    outgoingNumber: Number(row.outgoing_number) || 0,
    outgoingDate: serializeCalendarDate(row.outgoing_date),
  };
}

async function allocateOutgoingNumber(client) {
  const result = await client.query(`
    SELECT COALESCE(MAX(outgoing_number), 0) + 1 AS next_number
    FROM letters
    WHERE outgoing_number > 0
      AND status IN ('sent', 'confirmed')
      AND EXTRACT(YEAR FROM outgoing_date) = EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
  `);

  return Number(result.rows[0].next_number);
}

async function getNextOutgoingPreview() {
  const result = await query(`
    SELECT
      COALESCE(MAX(outgoing_number), 0) + 1 AS next_number,
      CURRENT_DATE AS next_date
    FROM letters
    WHERE outgoing_number > 0
      AND status IN ('sent', 'confirmed')
      AND EXTRACT(YEAR FROM outgoing_date) = EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
  `);

  return {
    outgoingNumber: Number(result.rows[0].next_number),
    outgoingDate: serializeCalendarDate(result.rows[0].next_date),
  };
}

async function finalizeOutgoing(client, letterRow) {
  const alreadyAssigned = Number(letterRow.outgoing_number) > 0;
  const outgoingNumber = alreadyAssigned
    ? Number(letterRow.outgoing_number)
    : await allocateOutgoingNumber(client);

  let outgoingDate = letterRow.outgoing_date;
  if (!alreadyAssigned) {
    const dateResult = await client.query("SELECT CURRENT_DATE AS outgoing_date");
    outgoingDate = dateResult.rows[0].outgoing_date;
  }

  const htmlBody = applyOutgoingRequisites(letterRow.html_body, outgoingNumber, outgoingDate);

  await client.query(
    `
      UPDATE letters
      SET
        outgoing_number = $2,
        outgoing_date = $3,
        html_body = $4,
        updated_at = NOW()
      WHERE id = $1
    `,
    [letterRow.id, outgoingNumber, outgoingDate, htmlBody]
  );

  return outgoingNumber;
}

function parseFolderId(folderId) {
  if (folderId === undefined) {
    return undefined;
  }
  if (folderId == null) {
    return null;
  }
  const value = Number(folderId);
  return Number.isFinite(value) && value > 0 ? value : null;
}

async function listLetters({ folderId } = {}) {
  const params = [];
  let whereClause = "";

  if (folderId !== undefined) {
    if (folderId == null) {
      whereClause = "WHERE l.folder_id IS NULL";
    } else {
      params.push(folderId);
      whereClause = "WHERE l.folder_id = $1";
    }
  }

  const result = await query(
    `
      SELECT
        l.id,
        l.author_id,
        l.folder_id,
        l.subject,
        l.html_body,
        l.layout_kind,
        l.to_emails,
        l.status,
        l.sent_at,
        l.outgoing_number,
        l.outgoing_date,
        l.created_at,
        l.updated_at,
        u.full_name AS author_name
      FROM letters l
      JOIN users u ON u.id = l.author_id
      ${whereClause}
      ORDER BY COALESCE(l.sent_at, l.updated_at) DESC, l.id DESC
    `,
    params
  );

  return result.rows.map(mapRow);
}

async function getLetter(letterId) {
  const result = await query(
    `
      SELECT
        l.id,
        l.author_id,
        l.folder_id,
        l.subject,
        l.html_body,
        l.layout_kind,
        l.to_emails,
        l.status,
        l.sent_at,
        l.outgoing_number,
        l.outgoing_date,
        l.created_at,
        l.updated_at,
        u.full_name AS author_name
      FROM letters l
      JOIN users u ON u.id = l.author_id
      WHERE l.id = $1
    `,
    [letterId]
  );

  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

async function getLetterRow(client, letterId) {
  const result = await client.query(
    `
      SELECT
        id,
        author_id,
        folder_id,
        subject,
        html_body,
        layout_kind,
        to_emails,
        status,
        sent_at,
        outgoing_number,
        outgoing_date
      FROM letters
      WHERE id = $1
    `,
    [letterId]
  );

  return result.rows[0] || null;
}

async function createLetter({
  authorId,
  folderId = null,
  subject,
  htmlBody,
  layoutKind = "bakor_letter",
  toEmails = "",
}) {
  const trimmedSubject = String(subject || "").trim();
  const trimmedBody = String(htmlBody || "").trim();
  const trimmedTo = String(toEmails || "").trim();

  if (!LAYOUT_KINDS.includes(layoutKind)) {
    throw httpError(400, "Неизвестный тип макета.");
  }

  const result = await query(
    `
      INSERT INTO letters (author_id, folder_id, subject, html_body, layout_kind, to_emails, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'draft')
      RETURNING id
    `,
    [authorId, folderId, trimmedSubject, trimmedBody, layoutKind, trimmedTo]
  );

  return getLetter(result.rows[0].id);
}

async function updateLetter(
  letterId,
  { folderId, subject, htmlBody, layoutKind, toEmails }
) {
  const current = await getLetter(letterId);
  if (!current) {
    throw httpError(404, "Письмо не найдено.");
  }
  if (FINALIZED_STATUSES.includes(current.status)) {
    throw httpError(400, "Подтверждённое или отправленное письмо нельзя редактировать.");
  }

  const nextFolderId = folderId === undefined ? current.folderId : parseFolderId(folderId);
  const nextSubject = subject === undefined ? current.subject : String(subject || "").trim();
  const nextHtmlBody = htmlBody === undefined ? current.htmlBody : htmlBody;
  const nextLayoutKind = layoutKind === undefined ? current.layoutKind : layoutKind;
  const nextToEmails = toEmails === undefined ? current.toEmails : String(toEmails || "").trim();

  if (!LAYOUT_KINDS.includes(nextLayoutKind)) {
    throw httpError(400, "Неизвестный тип макета.");
  }

  await query(
    `
      UPDATE letters
      SET
        folder_id = $2,
        subject = $3,
        html_body = $4,
        layout_kind = $5,
        to_emails = $6,
        updated_at = NOW()
      WHERE id = $1
    `,
    [letterId, nextFolderId, nextSubject, nextHtmlBody, nextLayoutKind, nextToEmails]
  );

  return getLetter(letterId);
}

async function deleteLetter(letterId) {
  const current = await getLetter(letterId);
  if (!current) {
    throw httpError(404, "Письмо не найдено.");
  }

  await query("DELETE FROM letters WHERE id = $1", [letterId]);
  return { id: Number(letterId) };
}

async function confirmLetter(letterId) {
  const current = await getLetter(letterId);
  if (!current) {
    throw httpError(404, "Письмо не найдено.");
  }
  if (FINALIZED_STATUSES.includes(current.status)) {
    throw httpError(400, "Письмо уже подтверждено.");
  }

  const trimmedBody = String(current.htmlBody || "").trim();
  if (!trimmedBody) {
    throw httpError(400, "Заполните текст письма.");
  }

  await withTransaction(async (client) => {
    const row = await getLetterRow(client, letterId);
    if (!row) {
      throw httpError(404, "Письмо не найдено.");
    }

    await finalizeOutgoing(client, row);

    await client.query(
      `
        UPDATE letters
        SET status = 'confirmed',
            sent_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
      `,
      [letterId]
    );
  });

  return getLetter(letterId);
}

async function sendLetter(letterId) {
  const current = await getLetter(letterId);
  if (!current) {
    throw httpError(404, "Письмо не найдено.");
  }
  if (current.status === "sent") {
    throw httpError(400, "Письмо уже отправлено.");
  }
  if (current.status === "confirmed") {
    throw httpError(400, "Письмо уже подтверждено. Отправка по e-mail недоступна.");
  }

  const trimmedSubject = String(current.subject || "").trim();
  const trimmedTo = String(current.toEmails || "").trim();
  const trimmedBody = String(current.htmlBody || "").trim();

  if (!trimmedSubject) {
    throw httpError(400, "Укажите тему письма.");
  }
  if (!trimmedTo) {
    throw httpError(400, "Укажите адрес получателя.");
  }
  if (!trimmedBody) {
    throw httpError(400, "Заполните текст письма.");
  }

  await withTransaction(async (client) => {
    const row = await getLetterRow(client, letterId);
    if (!row) {
      throw httpError(404, "Письмо не найдено.");
    }

    await finalizeOutgoing(client, row);
  });

  const finalized = await getLetter(letterId);
  const html = isBakorLetterLayout(finalized.layoutKind)
    ? composeLetterHtml(finalized.htmlBody)
    : finalized.htmlBody;
  const text = htmlToPlainText(html);

  await sendMail({
    to: trimmedTo,
    subject: trimmedSubject,
    html,
    text,
  });

  await query(
    `
      UPDATE letters
      SET status = 'sent',
          sent_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
    `,
    [letterId]
  );

  return getLetter(letterId);
}

module.exports = {
  LAYOUT_KINDS,
  STATUSES,
  FINALIZED_STATUSES,
  listLetters,
  getLetter,
  getNextOutgoingPreview,
  createLetter,
  updateLetter,
  deleteLetter,
  confirmLetter,
  sendLetter,
};
