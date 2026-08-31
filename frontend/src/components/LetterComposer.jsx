import { useEffect, useRef, useState } from "react";
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
} from "./emailDocEditorShared";
import {
  confirmLetter,
  createLetter,
  deleteLetter,
  fetchEmailTemplates,
  fetchLetter,
  fetchNextOutgoingNumber,
  updateLetter,
} from "../api/client";
import LetterTemplate from "./LetterTemplate";
import {
  applyOutgoingRequisites,
  extractLetterRecipientFromHtml,
  isBakorLetterLayout,
  LAYOUT_KIND_BAKOR,
  normalizeOutgoingRequisitesInTemplate,
  OUTGOING_REQUISITES_SNIPPET,
  resolveLetterSubject,
} from "../utils/bakorLetterTemplate";
import { downloadLetterAsPdf, downloadLetterAsWord, printLetter } from "../utils/letterExport";

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
    htmlBody: "<p></p>",
    layoutKind: LAYOUT_KIND_BAKOR,
    status: "draft",
    outgoingNumber: 0,
    outgoingDate: null,
  });
  const [loading, setLoading] = useState(Boolean(letterId));
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  const [editorVersion, setEditorVersion] = useState(0);
  const [wordStats, setWordStats] = useState({ words: 0, characters: 0 });
  const [openMenu, setOpenMenu] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [outgoingPreview, setOutgoingPreview] = useState({ outgoingNumber: 0, outgoingDate: null });
  const toolbarRef = useRef(null);
  const editorRef = useRef(null);
  const createStartedRef = useRef(false);

  const isFinalized = draft.status === "sent" || draft.status === "confirmed";
  const canEdit = !isFinalized && !saving && !confirming;

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
    const htmlBody = letter.htmlBody || "<p></p>";
    const layoutKind = letter.layoutKind || LAYOUT_KIND_BAKOR;

    return {
      subject: resolveLetterSubject({
        layoutKind,
        htmlBody,
        subject: letter.subject || "",
      }),
      htmlBody,
      layoutKind,
      status: letter.status,
      outgoingNumber: letter.outgoingNumber || 0,
      outgoingDate: letter.outgoingDate || null,
    };
  }

  function syncDraftFromHtmlBody(htmlBody, current) {
    const nextDraft = { ...current, htmlBody };

    if (isBakorLetterLayout(current.layoutKind)) {
      const recipient = extractLetterRecipientFromHtml(htmlBody);
      if (recipient) {
        nextDraft.subject = recipient;
      }
    }

    return nextDraft;
  }

  useEffect(() => {
    setEditorReady(true);
  }, []);

  useEffect(() => {
    return () => {
      editorRef.current = null;
      if (toolbarRef.current) {
        toolbarRef.current.replaceChildren();
      }
    };
  }, [currentLetterId, editorVersion, draft.layoutKind]);

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
          setEditorVersion((current) => current + 1);
          setWordStats({ words: 0, characters: 0 });
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
    })
      .then((letter) => {
        setCurrentLetterId(letter.id);
        setDraft(mapLetterToDraft(letter));
        setEditorVersion((current) => current + 1);
        setWordStats({ words: 0, characters: 0 });
      })
      .catch((requestError) => onError(requestError.message))
      .finally(() => setLoading(false));
  }, [token, currentLetterId, folderId, onError]);

  function handleEditorReady(editor) {
    editorRef.current = editor;
    mountEditorToolbar(editor, toolbarRef);
  }

  function isCommandEnabled(commandName) {
    return isEditorCommandEnabled(editorRef, commandName);
  }

  async function printEditorContent() {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    try {
      await printLetter(editor.getData(), {
        subject: draft.subject,
        layoutKind: draft.layoutKind,
      });
    } catch (requestError) {
      onError(requestError.message);
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
        normalizeOutgoingRequisitesInTemplate(template.htmlBody || "<p></p>"),
        outgoingNumber,
        outgoingDate
      );
      const layoutKind = template.layoutKind || LAYOUT_KIND_BAKOR;
      const nextDraft = {
        subject: resolveLetterSubject({
          layoutKind,
          htmlBody,
          subject: template.subject || "",
        }),
        htmlBody,
        layoutKind,
      };

      if (editorRef.current) {
        editorRef.current.setData(htmlBody);
      }

      setEditorVersion((current) => current + 1);
      setWordStats({ words: 0, characters: 0 });

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
      const subject = resolveLetterSubject(draft);
      const updated = await updateLetter(token, currentLetterId, {
        folderId: folderId ?? null,
        subject,
        htmlBody: draft.htmlBody,
        layoutKind: draft.layoutKind,
      });
      setDraft((current) => ({
        ...current,
        subject: updated.subject || "",
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

  async function handleConfirm() {
    if (!currentLetterId || !canEdit) {
      return;
    }

    setConfirming(true);
    onError("");
    try {
      await updateLetter(token, currentLetterId, {
        folderId: folderId ?? null,
        subject: resolveLetterSubject(draft),
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

  const handleMenuAction = createMenuActionHandler({
    editorRef,
    onError,
    onSave: handleSave,
    onPrint: printEditorContent,
    onInsertOutgoingRequisites: () => {
      if (!canEdit) {
        return;
      }

      const { outgoingNumber, outgoingDate } = resolveOutgoingFields(draft);
      const htmlBody = insertHtmlSnippet(editorRef, OUTGOING_REQUISITES_SNIPPET);

      if (htmlBody) {
        const nextHtmlBody = applyOutgoingRequisites(
          normalizeOutgoingRequisitesInTemplate(htmlBody),
          outgoingNumber,
          outgoingDate
        );
        setDraft((current) => ({ ...current, htmlBody: nextHtmlBody }));
        if (editorRef.current) {
          editorRef.current.setData(nextHtmlBody);
        }
      }
    },
    setOpenMenu,
  });

  useEffect(() => {
    function handleSaveShortcut(event) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s") {
        return;
      }

      event.preventDefault();
      if (canEdit && currentLetterId) {
        handleSave();
      }
    }

    window.addEventListener("keydown", handleSaveShortcut);
    return () => window.removeEventListener("keydown", handleSaveShortcut);
  }, [canEdit, currentLetterId, draft, folderId, token, saving, confirming]);

  function getLetterHtml() {
    return editorRef.current?.getData() || draft.htmlBody;
  }

  async function handleDownloadWord() {
    try {
      await downloadLetterAsWord(getLetterHtml(), {
        subject: draft.subject,
        layoutKind: draft.layoutKind,
      });
    } catch (requestError) {
      onError(requestError.message);
    }
  }

  async function handleDownloadPdf() {
    try {
      await downloadLetterAsPdf(getLetterHtml(), {
        subject: draft.subject,
        layoutKind: draft.layoutKind,
      });
    } catch (requestError) {
      onError(requestError.message);
    }
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
                  disabled={templatesLoading || saving || confirming}
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

            {isBakorLetterLayout(draft.layoutKind) ? (
              <p className="helper">
                Тема письма берётся из поля <strong>Кому:</strong> в шапке
                {draft.subject ? `: «${draft.subject}»` : " — заполните «Кому» в тексте письма"}
              </p>
            ) : (
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
            )}

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
                <EmailEditorMenubar
                  openMenu={openMenu}
                  onToggleMenu={(menuId) =>
                    setOpenMenu((current) => (current === menuId ? null : menuId))
                  }
                  onCloseMenu={() => setOpenMenu(null)}
                  onMenuAction={handleMenuAction}
                  canSave={canEdit && Boolean(currentLetterId)}
                  saving={saving || confirming}
                  commandEnabled={isCommandEnabled}
                  variant="letter"
                />

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
                            key={`${currentLetterId}-${draft.layoutKind}-${editorVersion}`}
                            editor={DecoupledEditor}
                            config={createEditorConfig((stats) => {
                              setWordStats({
                                words: stats.words,
                                characters: stats.characters,
                              });
                            })}
                            data={draft.htmlBody}
                            disabled={!canEdit}
                            onReady={handleEditorReady}
                            onChange={(_event, editor) => {
                              setDraft((current) =>
                                syncDraftFromHtmlBody(editor.getData(), current)
                              );
                            }}
                            onError={(editorError) => {
                              onError(editorError.message || "Не удалось загрузить редактор.");
                            }}
                          />
                        </LetterTemplate>
                      ) : (
                        <CKEditor
                          key={`${currentLetterId}-${draft.layoutKind}-${editorVersion}`}
                          editor={DecoupledEditor}
                          config={createEditorConfig((stats) => {
                            setWordStats({
                              words: stats.words,
                              characters: stats.characters,
                            });
                          })}
                          data={draft.htmlBody}
                          disabled={!canEdit}
                          onReady={handleEditorReady}
                          onChange={(_event, editor) => {
                            setDraft((current) =>
                              syncDraftFromHtmlBody(editor.getData(), current)
                            );
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
          </div>

          <div className="email-template-actions">
            {canEdit ? (
              <>
                <button
                  type="button"
                  className="btn cancel"
                  onClick={handleDelete}
                  disabled={saving || confirming}
                >
                  Удалить
                </button>
                <button
                  type="button"
                  className="btn cancel"
                  onClick={handleDownloadWord}
                  disabled={saving || confirming}
                >
                  Скачать Word
                </button>
                <button
                  type="button"
                  className="btn cancel"
                  onClick={handleDownloadPdf}
                  disabled={saving || confirming}
                >
                  Скачать PDF
                </button>
                <button
                  type="button"
                  className="btn cancel"
                  onClick={handleSave}
                  disabled={saving || confirming}
                >
                  {saving ? "Сохранение..." : "Сохранить черновик"}
                </button>
                <button
                  type="button"
                  className="btn primary"
                  onClick={handleConfirm}
                  disabled={saving || confirming}
                >
                  {confirming ? "Подтверждение..." : "Подтвердить"}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="btn cancel"
                  onClick={handleDownloadWord}
                >
                  Скачать Word
                </button>
                <button
                  type="button"
                  className="btn cancel"
                  onClick={handleDownloadPdf}
                >
                  Скачать PDF
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
