const { query, withTransaction } = require("../db");
const { composeLetterHtml, isBakorLetterLayout } = require("../utils/letterLayout");
const { normalizeOutgoingRequisitesInTemplate } = require("../utils/letterOutgoing");

const TRIGGER_KINDS = ["publish", "new_version"];
const LAYOUT_KINDS = ["default", "bakor_letter"];
const DEFAULT_TEMPLATES = [
  {
    triggerKind: "publish",
    name: "Документ на ознакомление",
    subject: "Документ на ознакомление: {{title}}",
    htmlBody: `
<div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1a1a1a;">
  <p>Здравствуйте, {{fullName}}!</p>
  <p>Вам направлен документ «<strong>{{title}}</strong>» на ознакомление.</p>
  <p><strong>Автор:</strong> {{authorName}}</p>
  <p><a href="{{link}}" style="display:inline-block;padding:10px 16px;background:#1f4b7a;color:#fff;text-decoration:none;border-radius:4px;">Открыть документ</a></p>
  <p style="color:#666;font-size:12px;">Если кнопка не работает, скопируйте ссылку:<br>{{link}}</p>
  <p style="color:#666;font-size:12px;">Реестр БАКОР</p>
</div>`.trim(),
  },
  {
    triggerKind: "new_version",
    name: "Новая версия документа",
    subject: "Новая версия документа: {{title}}",
    htmlBody: `
<div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1a1a1a;">
  <p>Здравствуйте, {{fullName}}!</p>
  <p>Опубликована новая версия (v{{versionNo}}) документа «<strong>{{title}}</strong>».</p>
  <p><strong>Автор:</strong> {{authorName}}</p>
  {{changeReasonBlock}}
  <p><a href="{{link}}" style="display:inline-block;padding:10px 16px;background:#1f4b7a;color:#fff;text-decoration:none;border-radius:4px;">Открыть документ</a></p>
  <p style="color:#666;font-size:12px;">Если кнопка не работает, скопируйте ссылку:<br>{{link}}</p>
  <p style="color:#666;font-size:12px;">Реестр БАКОР</p>
</div>`.trim(),
  },
];

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function mapRow(row) {
  return {
    id: Number(row.id),
    folderId: row.folder_id == null ? null : Number(row.folder_id),
    triggerKind: row.trigger_kind,
    layoutKind: row.layout_kind || "default",
    name: row.name,
    subject: row.subject,
    htmlBody: row.html_body,
    isDefault: Boolean(row.is_default),
    updatedAt: row.updated_at,
  };
}

function renderTemplate(template, variables) {
  let result = String(template || "");
  for (const [key, value] of Object.entries(variables)) {
    result = result.split(`{{${key}}}`).join(value ?? "");
  }
  return result;
}

function htmlToPlainText(html) {
  return String(html || "")
    .replace(/<img\b[^>]*\balt=(["'])(.*?)\1[^>]*>/gi, "\n[$2]\n")
    .replace(/<img\b[^>]*>/gi, "\n[Изображение]\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function assertFolderExists(client, folderId) {
  if (folderId == null) {
    return null;
  }

  const result = await client.query("SELECT id FROM email_template_folders WHERE id = $1", [folderId]);
  if (!result.rows[0]) {
    throw httpError(404, "Папка не найдена.");
  }
  return result.rows[0];
}

async function clearDefaultForTrigger(client, triggerKind, exceptId = null) {
  const params = [triggerKind];
  let exceptClause = "";
  if (exceptId != null) {
    params.push(exceptId);
    exceptClause = "AND id <> $2";
  }

  await client.query(
    `
      UPDATE email_templates
      SET is_default = FALSE,
          updated_at = NOW()
      WHERE trigger_kind = $1
        AND is_default = TRUE
        ${exceptClause}
    `,
    params
  );
}

async function seedDefaultTemplates() {
  for (const template of DEFAULT_TEMPLATES) {
    await query(
      `
        INSERT INTO email_templates (folder_id, trigger_kind, name, subject, html_body, is_default)
        SELECT NULL, $1, $2, $3, $4, TRUE
        WHERE NOT EXISTS (
          SELECT 1 FROM email_templates WHERE trigger_kind = $1 AND is_default = TRUE
        )
      `,
      [template.triggerKind, template.name, template.subject, template.htmlBody]
    );
  }
}

async function listEmailTemplates({ folderId } = {}) {
  const params = [];
  let whereClause = "";

  if (folderId !== undefined) {
    if (folderId == null) {
      whereClause = "WHERE folder_id IS NULL";
    } else {
      params.push(folderId);
      whereClause = "WHERE folder_id = $1";
    }
  }

  const result = await query(
    `
      SELECT id, folder_id, trigger_kind, layout_kind, name, subject, html_body, is_default, updated_at
      FROM email_templates
      ${whereClause}
      ORDER BY is_default DESC, name ASC, id ASC
    `,
    params
  );

  return result.rows.map(mapRow);
}

async function getEmailTemplate(templateId) {
  const result = await query(
    `
      SELECT id, folder_id, trigger_kind, layout_kind, name, subject, html_body, is_default, updated_at
      FROM email_templates
      WHERE id = $1
    `,
    [templateId]
  );

  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

async function getDefaultEmailTemplate(triggerKind) {
  const result = await query(
    `
      SELECT id, folder_id, trigger_kind, layout_kind, name, subject, html_body, is_default, updated_at
      FROM email_templates
      WHERE trigger_kind = $1
        AND is_default = TRUE
      ORDER BY id ASC
      LIMIT 1
    `,
    [triggerKind]
  );

  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

async function createEmailTemplate({
  folderId = null,
  triggerKind,
  layoutKind = "default",
  name,
  subject,
  htmlBody,
  isDefault = false,
}) {
  if (!TRIGGER_KINDS.includes(triggerKind)) {
    throw httpError(400, "Неизвестный тип шаблона.");
  }
  if (!LAYOUT_KINDS.includes(layoutKind)) {
    throw httpError(400, "Неизвестный тип макета.");
  }

  const trimmedName = String(name || "").trim();
  const trimmedSubject = String(subject || "").trim();
  const normalizedHtmlBody = normalizeOutgoingRequisitesInTemplate(String(htmlBody || "").trim());
  if (!trimmedName || !trimmedSubject || !normalizedHtmlBody) {
    throw httpError(400, "Заполните название, тему и текст шаблона.");
  }

  return withTransaction(async (client) => {
    await assertFolderExists(client, folderId);

    if (isDefault) {
      await clearDefaultForTrigger(client, triggerKind);
    }

    const created = await client.query(
      `
        INSERT INTO email_templates (folder_id, trigger_kind, layout_kind, name, subject, html_body, is_default)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, folder_id, trigger_kind, layout_kind, name, subject, html_body, is_default, updated_at
      `,
      [folderId, triggerKind, layoutKind, trimmedName, trimmedSubject, normalizedHtmlBody, Boolean(isDefault)]
    );

    return mapRow(created.rows[0]);
  });
}

async function updateEmailTemplate(
  templateId,
  { folderId, triggerKind, layoutKind, name, subject, htmlBody, isDefault }
) {
  return withTransaction(async (client) => {
    const current = await getEmailTemplate(templateId);
    if (!current) {
      throw httpError(404, "Шаблон письма не найден.");
    }

    const nextFolderId = folderId === undefined ? current.folderId : folderId;
    const nextTriggerKind = triggerKind === undefined ? current.triggerKind : triggerKind;
    const nextLayoutKind = layoutKind === undefined ? current.layoutKind : layoutKind;
    const nextName = name === undefined ? current.name : String(name || "").trim();
    const nextSubject = subject === undefined ? current.subject : String(subject || "").trim();
    const nextHtmlBody =
      htmlBody === undefined
        ? current.htmlBody
        : normalizeOutgoingRequisitesInTemplate(String(htmlBody || "").trim());
    const nextIsDefault = isDefault === undefined ? current.isDefault : Boolean(isDefault);

    if (!TRIGGER_KINDS.includes(nextTriggerKind)) {
      throw httpError(400, "Неизвестный тип шаблона.");
    }
    if (!LAYOUT_KINDS.includes(nextLayoutKind)) {
      throw httpError(400, "Неизвестный тип макета.");
    }
    if (!nextName || !nextSubject || !String(nextHtmlBody || "").trim()) {
      throw httpError(400, "Заполните название, тему и текст шаблона.");
    }

    await assertFolderExists(client, nextFolderId);

    if (nextIsDefault) {
      await clearDefaultForTrigger(client, nextTriggerKind, templateId);
    }

    const updated = await client.query(
      `
        UPDATE email_templates
        SET
          folder_id = $2,
          trigger_kind = $3,
          layout_kind = $4,
          name = $5,
          subject = $6,
          html_body = $7,
          is_default = $8,
          updated_at = NOW()
        WHERE id = $1
        RETURNING id, folder_id, trigger_kind, layout_kind, name, subject, html_body, is_default, updated_at
      `,
      [
        templateId,
        nextFolderId,
        nextTriggerKind,
        nextLayoutKind,
        nextName,
        nextSubject,
        nextHtmlBody,
        nextIsDefault,
      ]
    );

    return mapRow(updated.rows[0]);
  });
}

async function deleteEmailTemplate(templateId) {
  return withTransaction(async (client) => {
    const current = await getEmailTemplate(templateId);
    if (!current) {
      throw httpError(404, "Шаблон письма не найден.");
    }

    await client.query("DELETE FROM email_templates WHERE id = $1", [templateId]);

    if (current.isDefault) {
      const fallback = await client.query(
        `
          SELECT id
          FROM email_templates
          WHERE trigger_kind = $1
          ORDER BY updated_at DESC, id DESC
          LIMIT 1
        `,
        [current.triggerKind]
      );

      if (fallback.rows[0]) {
        await client.query(
          `
            UPDATE email_templates
            SET is_default = TRUE,
                updated_at = NOW()
            WHERE id = $1
          `,
          [fallback.rows[0].id]
        );
      }
    }

    return { id: Number(templateId) };
  });
}

async function buildEmailFromTemplate(triggerKind, variables) {
  const template = await getDefaultEmailTemplate(triggerKind);
  if (!template) {
    return null;
  }

  const subject = renderTemplate(template.subject, variables);
  const bodyHtml = renderTemplate(template.htmlBody, variables);
  const html = isBakorLetterLayout(template.layoutKind)
    ? composeLetterHtml(bodyHtml)
    : bodyHtml;
  const text = htmlToPlainText(html);

  return { subject, html, text };
}

module.exports = {
  TRIGGER_KINDS,
  LAYOUT_KINDS,
  seedDefaultTemplates,
  listEmailTemplates,
  getEmailTemplate,
  getDefaultEmailTemplate,
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
  buildEmailFromTemplate,
  renderTemplate,
  htmlToPlainText,
};
