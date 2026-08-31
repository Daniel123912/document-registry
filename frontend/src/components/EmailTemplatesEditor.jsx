import { useEffect, useMemo, useRef, useState } from "react";
import { CKEditor } from "@ckeditor/ckeditor5-react";
import { DecoupledEditor } from "ckeditor5";
import "ckeditor5/ckeditor5.css";
import {
  createEditorConfig,
  createMenuActionHandler,
  EmailEditorMenubar,
  insertHtmlSnippet,
  isEditorCommandEnabled,
  mountEditorToolbar,
  useEmailDocEditorMount,
} from "./emailDocEditorShared";
import {
  createEmailTemplate,
  deleteEmailTemplate,
  fetchEmailTemplates,
  updateEmailTemplate,
} from "../api/client";
import {
  EMAIL_TEMPLATE_IMPORT_ACCEPT,
  importEmailTemplateFromFile,
} from "../utils/emailTemplateImport";
import LetterTemplate from "./LetterTemplate";
import {
  applyBakorLetterPagesFromImport,
  buildLetterPrintShell,
  hasOutgoingRequisitesMarkers,
  isBakorLetterLayout,
  LAYOUT_KIND_BAKOR,
  normalizeOutgoingRequisitesInTemplate,
  OUTGOING_REQUISITES_SNIPPET,
  extractLetterRecipientFromHtml,
  resolveLetterSubject,
  splitHtmlAtPageTurns,
  wrapLetterPagesHtml,
} from "../utils/bakorLetterTemplate";
import { bindLetterPageLayout, insertLetterPageBreak, paginateLetterHtml, stripAutoPageBreaks } from "../utils/letterPageLayout";
import { findLiveLetterPreview, resolveLetterAssetSources } from "../utils/letterExport";

function emptyDraft() {
  return {
    name: "",
    subject: "",
    triggerKind: "publish",
    layoutKind: "default",
    isDefault: false,
    htmlBody: "",
  };
}

export default function EmailTemplatesEditor({
  listTitle,
  folderId,
  token,
  onNotice,
  onError,
  onBack,
}) {
  const [templates, setTemplates] = useState([]);
  const [activeTemplateId, setActiveTemplateId] = useState(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [wordStats, setWordStats] = useState({ words: 0, characters: 0 });
  const [openMenu, setOpenMenu] = useState(null);
  const importInputRef = useRef(null);
  const toolbarRef = useRef(null);
  const editorRef = useRef(null);
  const letterLayoutCleanupRef = useRef(null);
  const { editorMountKey, editorVisible, remountEditor } = useEmailDocEditorMount({
    editorRef,
    toolbarRef,
    letterLayoutCleanupRef,
  });

  const activeTemplate = useMemo(
    () => templates.find((template) => template.id === activeTemplateId) || null,
    [activeTemplateId, templates]
  );

  const effectiveSubject = resolveLetterSubject({
    layoutKind: draft.layoutKind,
    htmlBody: draft.htmlBody,
    subject: draft.subject,
  });

  const canSave = Boolean(
    activeTemplate &&
      !saving &&
      !importing &&
      draft.name.trim() &&
      effectiveSubject &&
      draft.htmlBody.trim()
  );

  useEffect(() => {
    let cancelled = false;

    async function loadTemplates() {
      setLoading(true);
      onError("");

      try {
        const rows = await fetchEmailTemplates(token, folderId ?? null);
        if (cancelled) {
          return;
        }

        const nextTemplates = Array.isArray(rows) ? rows : [];
        setTemplates(nextTemplates);
        setActiveTemplateId((current) => {
          if (current && nextTemplates.some((template) => template.id === current)) {
            return current;
          }
          return nextTemplates[0]?.id ?? null;
        });
      } catch (requestError) {
        if (!cancelled) {
          onError(requestError.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadTemplates();

    return () => {
      cancelled = true;
    };
  }, [folderId, token]);

  useEffect(() => {
    if (!activeTemplate) {
      setDraft(emptyDraft());
      return;
    }

    const nextDraft = {
      name: activeTemplate.name || "",
      subject: resolveLetterSubject({
        layoutKind: activeTemplate.layoutKind || "default",
        htmlBody: activeTemplate.htmlBody || "",
        subject: activeTemplate.subject || "",
      }),
      triggerKind: activeTemplate.triggerKind || "publish",
      layoutKind: activeTemplate.layoutKind || "default",
      isDefault: Boolean(activeTemplate.isDefault),
      htmlBody: activeTemplate.htmlBody || "",
    };
    const layoutChanged =
      isBakorLetterLayout(nextDraft.layoutKind) !== isBakorLetterLayout(draft.layoutKind);

    setDraft(nextDraft);
    setWordStats({ words: 0, characters: 0 });

    if (layoutChanged) {
      remountEditor();
      return;
    }

    const editor = editorRef.current;
    if (editor && editor.state !== "destroyed") {
      editor.setData(nextDraft.htmlBody);
      return;
    }

    remountEditor();
  }, [activeTemplate, remountEditor]);

  function handleEditorReady(editor) {
    editorRef.current = editor;
    mountEditorToolbar(editor, toolbarRef);

    letterLayoutCleanupRef.current?.();
    letterLayoutCleanupRef.current = bindLetterPageLayout(
      editor,
      isBakorLetterLayout(draft.layoutKind)
    );
  }

  function isCommandEnabled(commandName) {
    return isEditorCommandEnabled(editorRef, commandName);
  }

  function insertOutgoingRequisitesSnippet() {
    const htmlBody = insertHtmlSnippet(editorRef, OUTGOING_REQUISITES_SNIPPET);

    if (htmlBody) {
      setDraft((current) => ({ ...current, htmlBody }));
      onNotice("Строка исходящего номера вставлена. Номер и дата подставятся при создании письма.");
      return;
    }

    setDraft((current) => ({
      ...current,
      htmlBody: `${current.htmlBody || ""}${OUTGOING_REQUISITES_SNIPPET}`,
    }));
    remountEditor();
    onNotice("Строка исходящего номера вставлена. Номер и дата подставятся при создании письма.");
  }

  async function printEditorContent() {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) {
      onError("Браузер заблокировал окно печати.");
      return;
    }

    const html = editor.getData();
    let documentHtml;

    if (isBakorLetterLayout(draft.layoutKind)) {
      const liveDocument = findLiveLetterPreview();
      const editable = liveDocument?.querySelector(".ck-editor__editable");
      let pages = paginateLetterHtml(html, editable);
      if (pages.length <= 1 && html.includes("letter-page-turn")) {
        const splitPages = splitHtmlAtPageTurns(stripAutoPageBreaks(html));
        if (splitPages.length > 1) {
          pages = splitPages;
        }
      }
      const assets = await resolveLetterAssetSources(liveDocument);
      documentHtml = buildLetterPrintShell(wrapLetterPagesHtml(pages, assets));
    } else {
      documentHtml = `<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <title>Печать шаблона</title>
    <style>
      body {
        font-family: Arial, Helvetica, sans-serif;
        line-height: 1.6;
        padding: 40px;
        color: #1f2933;
      }
      img { max-width: 100%; height: auto; }
      table { width: 100%; border-collapse: collapse; }
      td, th { border: 1px solid #d5dde6; padding: 8px 10px; }
    </style>
  </head>
  <body>${html}</body>
</html>`;
    }

    printWindow.document.write(documentHtml);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  useEffect(() => {
    function handleSaveShortcut(event) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s") {
        return;
      }

      event.preventDefault();
      if (canSave) {
        handleSave();
      }
    }

    window.addEventListener("keydown", handleSaveShortcut);
    return () => window.removeEventListener("keydown", handleSaveShortcut);
  }, [canSave, activeTemplate, draft, folderId, token, saving, importing]);

  async function handleImportFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setImporting(true);
    onError("");

    try {
      const imported = await importEmailTemplateFromFile(file);
      let htmlBody = normalizeOutgoingRequisitesInTemplate(imported.htmlBody);
      const pageCount = imported.pageCount || 1;
      const nextDraft = { htmlBody };

      if (pageCount >= 2) {
        htmlBody = applyBakorLetterPagesFromImport(htmlBody, {
          pageCount,
          source: imported.source,
        });
        nextDraft.htmlBody = htmlBody;
        nextDraft.layoutKind = LAYOUT_KIND_BAKOR;

        const recipient = extractLetterRecipientFromHtml(htmlBody);
        if (recipient) {
          nextDraft.subject = recipient;
        }
      }

      const layoutChanged = pageCount >= 2;

      setDraft((current) => ({
        ...current,
        ...nextDraft,
      }));

      if (layoutChanged) {
        remountEditor();
      } else {
        const editor = editorRef.current;
        if (editor && editor.state !== "destroyed") {
          editor.setData(htmlBody);
        } else {
          remountEditor();
        }
      }

      onNotice(
        pageCount >= 2
          ? `Шаблон загружен (${pageCount} стр.). Включён фирменный бланк с разрывами страниц. Проверьте текст и сохраните.`
          : "Шаблон загружен из файла. Проверьте текст и сохраните изменения."
      );
    } catch (requestError) {
      onError(requestError.message || "Не удалось загрузить файл.");
    } finally {
      setImporting(false);
    }
  }

  async function handleCreateTemplate() {
    setCreating(true);
    onError("");

    try {
      const created = await createEmailTemplate(token, {
        folderId: folderId ?? null,
        triggerKind: "publish",
        name: "Новый шаблон",
        subject: "Документ: {{title}}",
        htmlBody: "<p>Здравствуйте, {{fullName}}!</p>",
        layoutKind: "default",
        isDefault: false,
      });
      setTemplates((current) => [...current, created]);
      setActiveTemplateId(created.id);
      onNotice("Шаблон создан.");
    } catch (requestError) {
      onError(requestError.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteTemplate() {
    if (!activeTemplate) {
      return;
    }

    if (!window.confirm(`Удалить шаблон «${activeTemplate.name}»?`)) {
      return;
    }

    setDeleting(true);
    onError("");

    try {
      await deleteEmailTemplate(token, activeTemplate.id);
      const nextTemplates = templates.filter((template) => template.id !== activeTemplate.id);
      setTemplates(nextTemplates);
      setActiveTemplateId(nextTemplates[0]?.id ?? null);
      onNotice("Шаблон удалён.");
    } catch (requestError) {
      onError(requestError.message);
    } finally {
      setDeleting(false);
    }
  }

  async function handleSave() {
    if (!activeTemplate) {
      return;
    }

    setSaving(true);
    onError("");

    try {
      const htmlBody = normalizeOutgoingRequisitesInTemplate(draft.htmlBody);
      const updated = await updateEmailTemplate(token, activeTemplate.id, {
        folderId: folderId ?? null,
        name: draft.name,
        htmlBody,
        subject: resolveLetterSubject({ ...draft, htmlBody }),
        triggerKind: draft.triggerKind,
        layoutKind: draft.layoutKind,
        isDefault: draft.isDefault,
      });
      setTemplates((current) =>
        current.map((template) => (template.id === updated.id ? updated : template))
      );
      onNotice("Шаблон письма сохранён.");
    } catch (requestError) {
      onError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  const handleMenuAction = createMenuActionHandler({
    editorRef,
    onError,
    onImport: () => importInputRef.current?.click(),
    onSave: handleSave,
    onPrint: printEditorContent,
    onInsertOutgoingRequisites: insertOutgoingRequisitesSnippet,
    onInsertPageBreak: () => {
      if (!isBakorLetterLayout(draft.layoutKind)) {
        return;
      }

      const htmlBody = insertLetterPageBreak(editorRef);
      if (htmlBody) {
        setDraft((current) => ({ ...current, htmlBody }));
      }
    },
    setOpenMenu,
  });

  return (
    <section className="list-card email-templates-card">
      {onBack ? (
        <div className="letters-compose-header">
          <button type="button" className="btn cancel" onClick={onBack}>
            ← К списку писем
          </button>
          <h2 className="list-title">{listTitle}</h2>
        </div>
      ) : (
        <h2 className="list-title">{listTitle}</h2>
      )}
      <p className="helper">
        Выберите папку слева и шаблон ниже. Можно создавать несколько шаблонов в одной папке,
        загружать макет из PDF, DOCX или SVG, либо использовать готовый фирменный бланк Бакор.
      </p>

      {loading ? <div className="empty">Загрузка шаблонов...</div> : null}

      {!loading && templates.length === 0 ? (
        <div className="email-template-empty">
          <div className="empty">В этой папке пока нет шаблонов.</div>
          <button
            type="button"
            className="btn primary"
            onClick={handleCreateTemplate}
            disabled={creating}
          >
            {creating ? "Создание..." : "Создать шаблон"}
          </button>
        </div>
      ) : null}

      {!loading && templates.length > 0 ? (
        <>
          <div className="email-template-toolbar">
            <label className="form-field email-template-select-field">
              Шаблон
              <select
                className="field-input"
                value={activeTemplateId ?? ""}
                onChange={(event) => setActiveTemplateId(Number(event.target.value))}
              >
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="email-template-toolbar-actions">
              <button
                type="button"
                className="btn cancel"
                onClick={handleCreateTemplate}
                disabled={creating || saving || deleting}
              >
                {creating ? "Создание..." : "Новый шаблон"}
              </button>
              <button
                type="button"
                className="btn danger-text"
                onClick={handleDeleteTemplate}
                disabled={!activeTemplate || saving || deleting || creating}
              >
                {deleting ? "Удаление..." : "Удалить"}
              </button>
            </div>
          </div>

          <div className="email-template-form">
            <label className="form-field">
              Название шаблона
              <input
                className="field-input"
                value={draft.name}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, name: event.target.value }))
                }
              />
            </label>

            {isBakorLetterLayout(draft.layoutKind) ? (
              <p className="helper">
                Тема письма берётся из поля <strong>Кому:</strong> в шапке
                {effectiveSubject ? `: «${effectiveSubject}»` : " — укажите «Кому» в тексте шаблона"}
              </p>
            ) : (
              <label className="form-field">
                Тема письма
                <input
                  className="field-input"
                  value={draft.subject}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, subject: event.target.value }))
                  }
                  placeholder="Документ на ознакомление: {{title}}"
                />
              </label>
            )}

            <div className="email-template-meta-row">
              <label className="form-field email-template-default-field">
                <span>Макет страницы</span>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={isBakorLetterLayout(draft.layoutKind)}
                    onChange={(event) => {
                      const layoutKind = event.target.checked ? LAYOUT_KIND_BAKOR : "default";
                      remountEditor();
                      setDraft((current) => ({
                        ...current,
                        layoutKind,
                      }));
                    }}
                  />
                  Фирменный бланк Бакор (шапка и подвал)
                </label>
              </label>
            </div>

            <div className="form-field email-doc-field">
              <span>Текст письма</span>
              <p className="helper email-template-outgoing-hint">
                Чтобы номер и дата исходящего подставлялись автоматически, используйте меню{" "}
                <strong>Вставка → Исходящий номер</strong> или строку{" "}
                <code>Исх. № {"{{outgoingNumber}}"} от {"{{outgoingDate}}"}</code>. При сохранении
                уже введённые номера (например, «Исх. № 2 от 31.08.2026») будут заменены на
                плейсхолдеры.
              </p>
              {isBakorLetterLayout(draft.layoutKind) &&
              !hasOutgoingRequisitesMarkers(draft.htmlBody) ? (
                <p className="helper email-template-outgoing-warning">
                  В этом шаблоне нет строки исходящего номера — при создании письма номер не
                  подставится.
                </p>
              ) : null}
              <div className="email-doc-editor">
                <EmailEditorMenubar
                  openMenu={openMenu}
                  onToggleMenu={(menuId) =>
                    setOpenMenu((current) => (current === menuId ? null : menuId))
                  }
                  onCloseMenu={() => setOpenMenu(null)}
                  onMenuAction={handleMenuAction}
                  canSave={canSave}
                  importing={importing}
                  saving={saving}
                  commandEnabled={isCommandEnabled}
                  variant={isBakorLetterLayout(draft.layoutKind) ? "letter" : "template"}
                />

                <div ref={toolbarRef} className="email-doc-editor__toolbar" />

                <div className="email-doc-editor__workspace">
                  <div
                    className={`email-doc-editor__canvas${
                      isBakorLetterLayout(draft.layoutKind) ? " email-doc-editor__canvas--letter" : ""
                    }`}
                  >
                    {editorVisible ? (
                      isBakorLetterLayout(draft.layoutKind) ? (
                        <LetterTemplate>
                          <CKEditor
                            key={`${activeTemplateId}-${draft.layoutKind}-${editorMountKey}`}
                            editor={DecoupledEditor}
                            config={createEditorConfig(
                              (stats) => {
                                setWordStats({
                                  words: stats.words,
                                  characters: stats.characters,
                                });
                              },
                              { letterPageBreak: true }
                            )}
                            data={draft.htmlBody}
                            onReady={handleEditorReady}
                            onChange={(_event, editor) => {
                              const htmlBody = editor.getData();
                              setDraft((current) => {
                                const nextDraft = { ...current, htmlBody };
                                if (isBakorLetterLayout(current.layoutKind)) {
                                  const recipient = extractLetterRecipientFromHtml(htmlBody);
                                  if (recipient) {
                                    nextDraft.subject = recipient;
                                  }
                                }
                                return nextDraft;
                              });
                            }}
                            onError={(editorError) => {
                              onError(editorError.message || "Не удалось загрузить редактор.");
                            }}
                          />
                        </LetterTemplate>
                      ) : (
                        <CKEditor
                          key={`${activeTemplateId}-${draft.layoutKind}-${editorMountKey}`}
                          editor={DecoupledEditor}
                          config={createEditorConfig((stats) => {
                            setWordStats({
                              words: stats.words,
                              characters: stats.characters,
                            });
                          })}
                          data={draft.htmlBody}
                          onReady={handleEditorReady}
                          onChange={(_event, editor) => {
                            setDraft((current) => ({
                              ...current,
                              htmlBody: editor.getData(),
                            }));
                          }}
                          onError={(editorError) => {
                            onError(editorError.message || "Не удалось загрузить редактор.");
                          }}
                        />
                      )
                    ) : (
                      <div className="empty">Загрузка редактора...</div>
                    )}
                  </div>
                </div>

                <div className="email-doc-editor__statusbar">
                  <span>Количество слов: {wordStats.words}</span>
                  <span>Количество символов: {wordStats.characters}</span>
                </div>
              </div>
            </div>

            <div className="email-template-actions">
              <input
                ref={importInputRef}
                type="file"
                accept={EMAIL_TEMPLATE_IMPORT_ACCEPT}
                className="visually-hidden"
                onChange={handleImportFile}
              />
              <button
                type="button"
                className="btn cancel"
                onClick={() => importInputRef.current?.click()}
                disabled={importing || saving}
              >
                {importing ? "Загрузка файла..." : "Загрузить из PDF/DOCX/SVG"}
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={handleSave}
                disabled={!canSave}
              >
                {saving ? "Сохранение..." : "Сохранить шаблон"}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
