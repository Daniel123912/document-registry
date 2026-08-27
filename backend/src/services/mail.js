const nodemailer = require("nodemailer");
const { query } = require("../db");
const { mail, appPublicUrl } = require("../config");

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

async function sendMail({ to, subject, text, html }) {
  const transport = getTransporter();
  if (!transport) {
    console.warn(`[mail] SMTP не настроен, письмо пропущено: ${subject} → ${to}`);
    return { skipped: true };
  }

  await transport.sendMail({
    from: mail.from,
    to,
    subject,
    text,
    html,
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

function buildAssignmentEmail({ row, kind, changeReason }) {
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

async function notifyAssignedUsers({ documentId, kind, changeReason }) {
  try {
    const rows = await loadAssignmentRecipients(documentId);
    if (!rows.length) {
      return;
    }

    for (const row of rows) {
      const email = buildAssignmentEmail({ row, kind, changeReason });
      try {
        await sendMail({
          to: row.email,
          subject: email.subject,
          text: email.text,
          html: email.html,
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
