const fs = require("fs");
const nodemailer = require("nodemailer");
const { query } = require("../db");
const { mail, appPublicUrl } = require("../config");
const { buildEmailFromTemplate } = require("./emailTemplates");
const { prepareHtmlForEmail } = require("../utils/emailHtml");
const { resolveStoredFile } = require("../utils/files");

let transporter = null;

function isMailConfigured() {
  return Boolean(mail.host && mail.user && mail.pass);
}

function getTransporter() {
  if (!isMailConfigured()) {
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: mail.host,
      port: mail.port,
      secure: mail.secure,
      auth: {
        user: mail.user,
        pass: mail.pass,
      },
    });
  }

  return transporter;
}

function documentLink(documentId) {
  const base = String(appPublicUrl || "").replace(/\/$/, "");
  return `${base}/?document=${documentId}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function sendMail({ to, subject, text, html, attachments = [] }) {
  const transport = getTransporter();
  if (!transport) {
    console.warn(`[mail] SMTP не настроен, письмо пропущено: ${subject} → ${to}`);
    return { skipped: true };
  }

  const prepared = prepareHtmlForEmail(html);

  await transport.sendMail({
    from: mail.from,
    to,
    subject,
    text,
    html: prepared.html,
    attachments: [...attachments, ...prepared.attachments],
  });

  return { skipped: false };
}

async function loadAssignmentRecipients(documentId) {
  const result = await query(
    `
      SELECT
        d.id AS document_id,
        d.title,
        d.active_version_no,
        author.full_name AS author_name,
        u.id AS user_id,
        u.full_name,
        u.email
      FROM documents d
      JOIN users author ON author.id = d.author_id
      JOIN document_assignments da ON da.document_id = d.id
      JOIN users u ON u.id = da.user_id
      WHERE d.id = $1
        AND d.deleted_at IS NULL
        AND u.is_active = TRUE
        AND u.email IS NOT NULL
        AND TRIM(u.email) <> ''
    `,
    [documentId]
  );

  return result.rows;
}

async function loadDocumentAttachment(documentId) {
  const result = await query(
    `
      SELECT
        d.draft_file_path,
        d.draft_original_filename,
        d.draft_mime_type,
        d.active_version_no,
        dv.file_path AS version_file_path,
        dv.original_filename AS version_original_filename,
        dv.mime_type AS version_mime_type
      FROM documents d
      LEFT JOIN document_versions dv
        ON dv.document_id = d.id
       AND dv.version_no = d.active_version_no
      WHERE d.id = $1
        AND d.deleted_at IS NULL
    `,
    [documentId]
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  const storedPath = row.version_file_path || row.draft_file_path;
  if (!storedPath) {
    return null;
  }

  const absolutePath = resolveStoredFile(storedPath);
  try {
    await fs.promises.access(absolutePath);
  } catch {
    return null;
  }

  return {
    filename: row.version_original_filename || row.draft_original_filename || "document",
    path: absolutePath,
    contentType: row.version_mime_type || row.draft_mime_type || "application/octet-stream",
  };
}

function buildFallbackAssignmentEmail({ row, kind, changeReason }) {
  const link = documentLink(row.document_id);
  const title = row.title || "Без названия";
  const authorName = row.author_name || "Ответственный";
  const versionNo = Number(row.active_version_no || 1);

  const isNewVersion = kind === "new_version";
  const subject = isNewVersion
    ? `Новая версия документа: ${title}`
    : `Документ на ознакомление: ${title}`;

  const reasonLine = isNewVersion && changeReason
    ? `\nПричина изменений: ${changeReason}`
    : "";

  const text = [
    `Здравствуйте, ${row.full_name || ""}!`,
    "",
    isNewVersion
      ? `Опубликована новая версия (v${versionNo}) документа «${title}».`
      : `Вам направлен документ «${title}» на ознакомление.`,
    `Автор: ${authorName}`,
    reasonLine.trim(),
    "",
    `Открыть документ: ${link}`,
    "",
    "Реестр БАКОР",
  ]
    .filter((line) => line !== "")
    .join("\n");

  const htmlReason =
    isNewVersion && changeReason
      ? `<p><strong>Причина изменений:</strong> ${escapeHtml(changeReason)}</p>`
      : "";

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1a1a1a;">
      <p>Здравствуйте, ${escapeHtml(row.full_name || "")}!</p>
      <p>${
        isNewVersion
          ? `Опубликована новая версия (v${versionNo}) документа «<strong>${escapeHtml(title)}</strong>».`
          : `Вам направлен документ «<strong>${escapeHtml(title)}</strong>» на ознакомление.`
      }</p>
      <p><strong>Автор:</strong> ${escapeHtml(authorName)}</p>
      ${htmlReason}
      <p><a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 16px;background:#1f4b7a;color:#fff;text-decoration:none;border-radius:4px;">Открыть документ</a></p>
      <p style="color:#666;font-size:12px;">Если кнопка не работает, скопируйте ссылку:<br>${escapeHtml(link)}</p>
      <p style="color:#666;font-size:12px;">Реестр БАКОР</p>
    </div>
  `;

  return { subject, text, html };
}

async function buildAssignmentEmail({ row, kind, changeReason }) {
  const link = documentLink(row.document_id);
  const title = row.title || "Без названия";
  const authorName = row.author_name || "Ответственный";
  const versionNo = String(Number(row.active_version_no || 1));
  const changeReasonBlock =
    kind === "new_version" && changeReason
      ? `<p><strong>Причина изменений:</strong> ${escapeHtml(changeReason)}</p>`
      : "";

  const templateKind = kind === "new_version" ? "new_version" : "publish";
  const fromTemplate = await buildEmailFromTemplate(templateKind, {
    fullName: escapeHtml(row.full_name || ""),
    title: escapeHtml(title),
    authorName: escapeHtml(authorName),
    versionNo: escapeHtml(versionNo),
    link: escapeHtml(link),
    changeReasonBlock,
  });

  if (fromTemplate) {
    return fromTemplate;
  }

  return buildFallbackAssignmentEmail({ row, kind, changeReason });
}

async function notifyAssignedUsers({ documentId, kind, changeReason }) {
  try {
    const rows = await loadAssignmentRecipients(documentId);
    if (!rows.length) {
      return;
    }

    const documentAttachment = await loadDocumentAttachment(documentId);
    const fileAttachments = documentAttachment
      ? [
          {
            filename: documentAttachment.filename,
            path: documentAttachment.path,
            contentType: documentAttachment.contentType,
          },
        ]
      : [];

    for (const row of rows) {
      const email = await buildAssignmentEmail({ row, kind, changeReason });
      try {
        await sendMail({
          to: row.email,
          subject: email.subject,
          text: email.text,
          html: email.html,
          attachments: fileAttachments,
        });
      } catch (error) {
        console.error(`[mail] Не удалось отправить письмо на ${row.email}:`, error.message);
      }
    }
  } catch (error) {
    console.error(`[mail] Ошибка уведомления по документу ${documentId}:`, error.message);
  }
}

module.exports = {
  isMailConfigured,
  sendMail,
  notifyAssignedUsers,
  documentLink,
};
