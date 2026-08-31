import { useEffect, useRef, useState } from "react";
import { CKEditor } from "@ckeditor/ckeditor5-react";
import {
  Alignment,
  Bold,
  Essentials,
  GeneralHtmlSupport,
  Heading,
  Italic,
  Link,
  List,
  Paragraph,
  RemoveFormat,
  Underline,
  DecoupledEditor,
} from "ckeditor5";
import "ckeditor5/ckeditor5.css";
import {
  confirmLetter,
  createLetter,
  deleteLetter,
  fetchEmailTemplates,
  fetchLetter,
  fetchNextOutgoingNumber,
  sendLetter,
  updateLetter,
} from "../api/client";
import LetterTemplate from "./LetterTemplate";
import {
  applyOutgoingRequisites,
  buildLetterPrintDocument,
  isBakorLetterLayout,
  LAYOUT_KIND_BAKOR,
} from "../utils/bakorLetterTemplate";

const editorConfig = {
  licenseKey: "GPL",
  plugins: [
    Essentials,
    GeneralHtmlSupport,
    Paragraph,
    Heading,
    Bold,
    Italic,
    Underline,
    RemoveFormat,
    Link,
    List,
    Alignment,
  ],
  toolbar: [
    "heading",
    "|",
    "bold",
    "italic",
    "underline",
    "removeFormat",
    "|",
    "alignment",
    "|",
    "bulletedList",
    "numberedList",
    "|",
    "link",
  ],
  htmlSupport: {
    allow: [
      { name: "div", classes: true, attributes: ["class", "aria-hidden", "contenteditable"] },
      { name: "img", classes: true, attributes: ["src", "alt", "class", "draggable"] },
      { name: "p", classes: true },
      { name: "a", classes: true, attributes: ["href", "target", "rel"] },
      { name: "ul", classes: true },
      { name: "li", classes: true },
      { name: "strong" },
      { name: "br" },
    ],
  },
};

export default function LetterComposer({
  token,
  folderId,
  letterId,
  onBack,
  onNotice,
  onError,
  onSaved,
}) {
  const [currentLetterId, setCurrentLetterId] = useState(letterId);
  const [draft, setDraft] = useState({
    subject: "",
    toEmails: "",
    htmlBody: "<p></p>",
    layoutKind: LAYOUT_KIND_BAKOR,
    status: "draft",
    outgoingNumber: 0,
    outgoingDate: null,
  });
  const [loading, setLoading] = useState(Boolean(letterId));
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [outgoingPreview, setOutgoingPreview] = useState({ outgoingNumber: 0, outgoingDate: null });
  const toolbarRef = useRef(null);
  const editorRef = useRef(null);
  const createStartedRef = useRef(false);

  const isFinalized = draft.status === "sent" || draft.status === "confirmed";
  const isSent = draft.status === "sent";
  const canEdit = !isFinalized && !saving && !sending && !confirming;

  function resolveOutgoingFields(letterOrDraft) {
    if (letterOrDraft.outgoingNumber > 0 && letterOrDraft.outgoingDate) {
      return {
        outgoingNumber: letterOrDraft.outgoingNumber,
        outgoingDate: letterOrDraft.outgoingDate,
      };
    }

    return {
      outgoingNumber: outgoingPreview.outgoingNumber,
      outgoingDate: outgoingPreview.outgoingDate,
    };
  }

  function mapLetterToDraft(letter) {
    return {
      subject: letter.subject || "",
      toEmails: letter.toEmails || "",
      htmlBody: letter.htmlBody || "<p></p>",
      layoutKind: letter.layoutKind || LAYOUT_KIND_BAKOR,
      status: letter.status,
      outgoingNumber: letter.outgoingNumber || 0,
      outgoingDate: letter.outgoingDate || null,
    };
  }

  useEffect(() => {
    setEditorReady(true);
  }, []);

  useEffect(() => {
    setCurrentLetterId(letterId);
  }, [letterId]);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;
    setTemplatesLoading(true);

    fetchEmailTemplates(token, folderId ?? null)
      .then((rows) => {
        if (!cancelled) {
          setTemplates(Array.isArray(rows) ? rows : []);
        }
      })
      .catch((requestError) => {
        if (!cancelled) {
          onError(requestError.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setTemplatesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token, folderId, onError]);

  useEffect(() => {
    if (!token || isFinalized) {
      return;
    }

    let cancelled = false;

    fetchNextOutgoingNumber(token)
      .then((preview) => {
        if (!cancelled) {
          setOutgoingPreview({
            outgoingNumber: preview.outgoingNumber || 0,
            outgoingDate: preview.outgoingDate || null,
          });
        }
      })
      .catch((requestError) => {
        if (!cancelled) {
          onError(requestError.message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token, isFinalized, onError]);

  useEffect(() => {
    if (!token) {
      return;
    }

    if (currentLetterId) {
      setLoading(true);
      onError("");
      fetchLetter(token, currentLetterId)
        .then((letter) => {
          setDraft(mapLetterToDraft(letter));
        })
        .catch((requestError) => onError(requestError.message))
        .finally(() => setLoading(false));
      return;
    }

    if (createStartedRef.current) {
      return;
    }

    createStartedRef.current = true;
    setLoading(true);
    onError("");
    createLetter(token, {
      folderId: folderId ?? null,
      subject: "",
      htmlBody: "<p></p>",
      layoutKind: LAYOUT_KIND_BAKOR,
      toEmails: "",
    })
      .then((letter) => {
        setCurrentLetterId(letter.id);
        setDraft(mapLetterToDraft(letter));
      })
      .catch((requestError) => onError(requestError.message))
      .finally(() => setLoading(false));
  }, [token, currentLetterId, folderId, onError]);

  function handleEditorReady(editor) {
    editorRef.current = editor;
    const toolbarElement = editor.ui.view.toolbar.element;
    if (toolbarRef.current && toolbarElement && toolbarElement.parentNode !== toolbarRef.current) {
      toolbarRef.current.appendChild(toolbarElement);
    }
  }

  function applyTemplate(templateId) {
    setSelectedTemplateId(templateId);
    if (!templateId) {
      return;
    }

    const template = templates.find((row) => row.id === Number(templateId));
    if (!template) {
      return;
    }

    setDraft((current) => {
      const { outgoingNumber, outgoingDate } = resolveOutgoingFields(current);
      const htmlBody = applyOutgoingRequisites(
        template.htmlBody || "<p></p>",
        outgoingNumber,
        outgoingDate
      );
      const nextDraft = {
        subject: template.subject || "",
        htmlBody,
        layoutKind: template.layoutKind || LAYOUT_KIND_BAKOR,
      };

      if (editorRef.current) {
        editorRef.current.setData(htmlBody);
      }

      return {
        ...current,
        ...nextDraft,
      };
    });
  }

  async function handleSave() {
    if (!currentLetterId || !canEdit) {
      return;
    }

    setSaving(true);
    onError("");
    try {
      const updated = await updateLetter(token, currentLetterId, {
        folderId: folderId ?? null,
        subject: draft.subject,
        toEmails: draft.toEmails,
        htmlBody: draft.htmlBody,
        layoutKind: draft.layoutKind,
      });
      setDraft((current) => ({
        ...current,
        subject: updated.subject || "",
        toEmails: updated.toEmails || "",
        htmlBody: updated.htmlBody || "<p></p>",
        layoutKind: updated.layoutKind || LAYOUT_KIND_BAKOR,
        status: updated.status,
        outgoingNumber: updated.outgoingNumber || current.outgoingNumber,
        outgoingDate: updated.outgoingDate || current.outgoingDate,
      }));
      onNotice("Черновик сохранён.");
      onSaved?.();
    } catch (requestError) {
      onError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSend() {
    if (!currentLetterId || !canEdit) {
      return;
    }

    setSending(true);
    onError("");
    try {
      await updateLetter(token, currentLetterId, {
        folderId: folderId ?? null,
        subject: draft.subject,
        toEmails: draft.toEmails,
        htmlBody: draft.htmlBody,
        layoutKind: draft.layoutKind,
      });
      const sent = await sendLetter(token, currentLetterId);
      const nextDraft = mapLetterToDraft(sent);
      setDraft(nextDraft);
      if (editorRef.current) {
        editorRef.current.setData(nextDraft.htmlBody);
      }
      onNotice("Письмо отправлено.");
      onSaved?.();
    } catch (requestError) {
      onError(requestError.message);
    } finally {
      setSending(false);
    }
  }

  async function handleConfirm() {
    if (!currentLetterId || !canEdit) {
      return;
    }

    setConfirming(true);
    onError("");
    try {
      await updateLetter(token, currentLetterId, {
        folderId: folderId ?? null,
        subject: draft.subject,
        toEmails: draft.toEmails,
        htmlBody: draft.htmlBody,
        layoutKind: draft.layoutKind,
      });
      const confirmed = await confirmLetter(token, currentLetterId);
      const nextDraft = mapLetterToDraft(confirmed);
      setDraft(nextDraft);
      if (editorRef.current) {
        editorRef.current.setData(nextDraft.htmlBody);
      }
      onNotice("Письмо подтверждено. Номер исходящего сохранён.");
      onSaved?.();
    } catch (requestError) {
      onError(requestError.message);
    } finally {
      setConfirming(false);
    }
  }

  function printLetterContent() {
    const html = editorRef.current?.getData() || draft.htmlBody;
    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) {
      onError("Браузер заблокировал окно печати.");
      return;
    }

    const documentHtml = isBakorLetterLayout(draft.layoutKind)
      ? buildLetterPrintDocument(html)
      : `<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <title>Печать письма</title>
    <style>
      body {
        font-family: Arial, Helvetica, sans-serif;
        line-height: 1.6;
        padding: 40px;
        color: #1f2933;
      }
      img { max-width: 100%; height: auto; }
    </style>
  </head>
  <body>${html}</body>
</html>`;

    printWindow.document.write(documentHtml);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  async function handleDelete() {
    if (!currentLetterId) {
      return;
    }

    const confirmMessage = isFinalized
      ? "Удалить письмо? Номер исходящего уже закреплён — это действие нельзя отменить."
      : "Удалить черновик письма?";

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setSaving(true);
    onError("");
    try {
      await deleteLetter(token, currentLetterId);
      onNotice("Письмо удалено.");
      onSaved?.();
      onBack();
    } catch (requestError) {
      onError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="list-card email-templates-card">
      <div className="letters-compose-header">
        <button type="button" className="btn cancel" onClick={onBack}>
          ← К списку писем
        </button>
        <h2 className="list-title">
          {isFinalized ? "Письмо" : "Новое письмо"}
          {!isFinalized && outgoingPreview.outgoingNumber > 0 ? (
            <span className="letters-compose-outgoing-preview">
              (следующий исх. № {outgoingPreview.outgoingNumber})
            </span>
          ) : null}
        </h2>
      </div>

      {loading ? <div className="empty">Загрузка...</div> : null}

      {!loading ? (
        <>
          <div className="email-template-form">
            {canEdit ? (
              <label className="form-field email-template-select-field">
                Шаблон письма
                <select
                  className="field-input"
                  value={selectedTemplateId}
                  disabled={templatesLoading || saving || sending || confirming}
                  onChange={(event) => applyTemplate(event.target.value)}
                >
                  <option value="">
                    {templatesLoading ? "Загрузка шаблонов..." : "— выберите шаблон —"}
                  </option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="form-field">
              Кому
              <input
                className="field-input"
                value={draft.toEmails}
                disabled={!canEdit}
                placeholder="email@example.com"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, toEmails: event.target.value }))
                }
              />
            </label>

            <label className="form-field">
              Тема письма
              <input
                className="field-input"
                value={draft.subject}
                disabled={!canEdit}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, subject: event.target.value }))
                }
              />
            </label>

            <label className="form-field email-template-default-field">
              <span>Макет страницы</span>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={isBakorLetterLayout(draft.layoutKind)}
                  disabled={!canEdit}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      layoutKind: event.target.checked ? LAYOUT_KIND_BAKOR : "default",
                    }))
                  }
                />
                Фирменный бланк Бакор (шапка и подвал)
              </label>
            </label>

            <div className="form-field email-doc-field">
              <span>Текст письма</span>
              <div className="email-doc-editor">
                <div ref={toolbarRef} className="email-doc-editor__toolbar" />
                <div className="email-doc-editor__workspace">
                  <div
                    className={`email-doc-editor__canvas${
                      isBakorLetterLayout(draft.layoutKind) ? " email-doc-editor__canvas--letter" : ""
                    }`}
                  >
                    {editorReady ? (
                      isBakorLetterLayout(draft.layoutKind) ? (
                        <LetterTemplate>
                          <CKEditor
                            key={`${currentLetterId}-${draft.layoutKind}`}
                            editor={DecoupledEditor}
                            config={editorConfig}
                            data={draft.htmlBody}
                            disabled={!canEdit}
                            onReady={handleEditorReady}
                            onChange={(_event, editor) => {
                              setDraft((current) => ({
                                ...current,
                                htmlBody: editor.getData(),
                              }));
                            }}
                          />
                        </LetterTemplate>
                      ) : (
                        <CKEditor
                          key={`${currentLetterId}-${draft.layoutKind}`}
                          editor={DecoupledEditor}
                          config={editorConfig}
                          data={draft.htmlBody}
                          disabled={!canEdit}
                          onReady={handleEditorReady}
                          onChange={(_event, editor) => {
                            setDraft((current) => ({
                              ...current,
                              htmlBody: editor.getData(),
                            }));
                          }}
                        />
                      )
                    ) : (
                      <div className="empty">Загрузка редактора...</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="email-template-actions">
            {canEdit ? (
              <>
                <button
                  type="button"
                  className="btn cancel"
                  onClick={handleDelete}
                  disabled={saving || sending || confirming}
                >
                  Удалить
                </button>
                <button
                  type="button"
                  className="btn cancel"
                  onClick={printLetterContent}
                  disabled={saving || sending || confirming}
                >
                  Печать / Word
                </button>
                <button
                  type="button"
                  className="btn cancel"
                  onClick={handleSave}
                  disabled={saving || sending || confirming}
                >
                  {saving ? "Сохранение..." : "Сохранить черновик"}
                </button>
                <button
                  type="button"
                  className="btn primary"
                  onClick={handleConfirm}
                  disabled={saving || sending || confirming}
                >
                  {confirming ? "Подтверждение..." : "Подтвердить"}
                </button>
                <button
                  type="button"
                  className="btn primary"
                  onClick={handleSend}
                  disabled={saving || sending || confirming}
                >
                  {sending ? "Отправка..." : "Отправить e-mail"}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="btn cancel"
                  onClick={printLetterContent}
                >
                  Печать / Word
                </button>
                <button
                  type="button"
                  className="btn danger-text"
                  onClick={handleDelete}
                  disabled={saving}
                >
                  {saving ? "Удаление..." : "Удалить"}
                </button>
                <button type="button" className="btn cancel" onClick={onBack}>
                  Закрыть
                </button>
              </>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}
