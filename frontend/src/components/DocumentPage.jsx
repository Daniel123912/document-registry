import { useEffect, useMemo, useState } from "react";
import { fetchDocumentFile } from "../api/client";
import { TYPE_OPTIONS, typeLabel } from "../constants";
import { formatDate, toIsoDateValue, daysUntilTrashPurge } from "../utils/dates";

const emptyVersionForm = {
  changeReason: "",
  versionFile: null,
};

function isImageFile(filename, mimeType) {
  return (
    String(mimeType || "").startsWith("image/") ||
    /\.(png|jpe?g|gif|webp)$/i.test(filename || "")
  );
}

function isPdfFile(filename, mimeType) {
  return mimeType === "application/pdf" || /\.pdf$/i.test(filename || "");
}

function isWordFile(filename, mimeType) {
  return (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    /\.docx$/i.test(filename || "")
  );
}

function isLegacyWordFile(filename, mimeType) {
  return mimeType === "application/msword" || /\.doc$/i.test(filename || "");
}

function isSpreadsheetFile(filename, mimeType) {
  return (
    mimeType === "application/vnd.ms-excel" ||
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    /\.xlsx?$/i.test(filename || "")
  );
}

function versionLabel(versionNo, activeVersionNo) {
  if (!versionNo) {
    return "Черновик";
  }
  return versionNo === activeVersionNo ? `v${versionNo} (текущая)` : `v${versionNo}`;
}

export default function DocumentPage({
  document,
  users,
  isResponsible,
  isTrash = false,
  loading,
  token,
  onClose,
  onSaveRequisites,
  onArchive,
  onDelete,
  onRestore,
  onPermanentDelete,
  onCreateVersion,
  onAcknowledge,
  onPublish,
  notice,
  error,
}) {
  const [tab, setTab] = useState("preview");
  const [previewVersionNo, setPreviewVersionNo] = useState(document.activeVersionNo || 0);
  const [editForm, setEditForm] = useState({
    title: document.title || "",
    type: document.type,
    number: document.number || "",
    documentDate: toIsoDateValue(document.documentDate),
    description: document.description || "",
    assignedUsers: (document.assignedUsers || []).map((user) => user.id),
  });
  const [versionForm, setVersionForm] = useState(emptyVersionForm);
  const [filePreview, setFilePreview] = useState({
    url: null,
    mimeType: null,
    docHtml: "",
    sheets: [],
    loading: false,
    error: "",
  });

  const employeeUsers = users.filter((candidate) => candidate.role === "employee");
  const ackTotal = document.assignedCount || document.assignedUsers?.length || 0;
  const ackDone = document.acknowledgedCount || 0;
  const ackPercent = ackTotal ? Math.round((ackDone / ackTotal) * 100) : 0;

  const previewFile = useMemo(() => {
    const versions = document.versions || [];
    const selected = versions.find((version) => version.versionNo === previewVersionNo);
    if (selected) {
      return {
        url: filePreview.url,
        name: selected.originalFilename,
        mimeType: filePreview.mimeType || selected.mimeType,
        label: versionLabel(selected.versionNo, document.activeVersionNo),
      };
    }
    return {
      url: filePreview.url,
      name: document.currentFilename,
      mimeType: filePreview.mimeType || document.currentMimeType,
      label: versionLabel(document.activeVersionNo, document.activeVersionNo),
    };
  }, [document, previewVersionNo, filePreview]);

  useEffect(() => {
    setTab("preview");
    setPreviewVersionNo(document.activeVersionNo || 0);
    setEditForm({
      title: document.title || "",
      type: document.type,
      number: document.number || "",
      documentDate: toIsoDateValue(document.documentDate),
      description: document.description || "",
      assignedUsers: (document.assignedUsers || []).map((user) => user.id),
    });
    setVersionForm(emptyVersionForm);
  }, [document.id]);

  useEffect(() => {
    setPreviewVersionNo(document.activeVersionNo || 0);
  }, [document.activeVersionNo]);

  useEffect(() => {
    let cancelled = false;
    let objectUrl;

    async function loadFile() {
      if (!token || !document.id) {
        return;
      }

      setFilePreview({
        url: null,
        mimeType: null,
        docHtml: "",
        sheets: [],
        loading: true,
        error: "",
      });

      try {
        const result = await fetchDocumentFile(token, document.id, previewVersionNo || undefined);
        objectUrl = result.objectUrl;
        const nextPreview = {
          url: result.objectUrl,
          mimeType: result.mimeType,
          docHtml: "",
          sheets: [],
          loading: false,
          error: "",
        };

        if (isWordFile(previewFile.name, result.mimeType)) {
          const mammoth = await import("mammoth");
          const arrayBuffer = await result.blob.arrayBuffer();
          const rendered = await mammoth.convertToHtml({ arrayBuffer });
          nextPreview.docHtml = rendered.value;
        }

        if (isSpreadsheetFile(previewFile.name, result.mimeType)) {
          const XLSX = await import("xlsx");
          const arrayBuffer = await result.blob.arrayBuffer();
          const workbook = XLSX.read(arrayBuffer, { type: "array" });
          nextPreview.sheets = workbook.SheetNames.map((sheetName) => ({
            name: sheetName,
            html: XLSX.utils.sheet_to_html(workbook.Sheets[sheetName]),
          }));
        }

        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }

        setFilePreview(nextPreview);
      } catch (requestError) {
        if (!cancelled) {
          setFilePreview({
            url: null,
            mimeType: null,
            docHtml: "",
            sheets: [],
            loading: false,
            error: requestError.message,
          });
        }
      }
    }

    loadFile();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [token, document.id, previewVersionNo, previewFile.name]);

  function handleSave(event) {
    event.preventDefault();
    onSaveRequisites(document.id, {
      title: editForm.title,
      type: editForm.type,
      number: editForm.number || "",
      documentDate: toIsoDateValue(editForm.documentDate),
      description: editForm.description || "",
      assignedUsers: (editForm.assignedUsers || []).map(Number),
    });
  }

  function handleNewVersion(event) {
    event.preventDefault();
    onCreateVersion(event, document.id, versionForm);
    setTab("preview");
  }

  return (
    <section className="doc-page">
      <header className="doc-page-head">
        <div>
          <h2 className="doc-page-title">{document.title}</h2>
          <div className="doc-page-meta">
            № {document.number || "без номера"} Тип: {typeLabel(document.type)} Дата:{" "}
            {formatDate(document.documentDate)}
          </div>
        </div>
        <button className="btn cancel" type="button" onClick={onClose}>
          Закрыть
        </button>
      </header>

      {notice ? <div className="alert success">{notice}</div> : null}
      {error ? <div className="alert error">{error}</div> : null}

      {isTrash ? (
        <div className="alert warn">
          Документ в корзине. Осталось {daysUntilTrashPurge(document.deletedAt)} дн. до
          безвозвратного удаления.
        </div>
      ) : null}

      <div className="doc-tabs">
        <button className={tab === "preview" ? "active" : ""} onClick={() => setTab("preview")}>
          Просмотр
        </button>
        {isResponsible && !isTrash ? (
          <button
            className={tab === "requisites" ? "active" : ""}
            onClick={() => setTab("requisites")}
          >
            Реквизиты
          </button>
        ) : null}
        {isResponsible && !isTrash ? (
          <button className={tab === "version" ? "active" : ""} onClick={() => setTab("version")}>
            Новая версия
          </button>
        ) : null}
      </div>

      {tab === "preview" ? (
        <div className="doc-preview">
          <aside className="doc-preview-side">
            <div className="doc-side-block">
              <div className="doc-side-title">Основное</div>
              <div className="doc-side-row">
                <span>Автор</span>
                <strong>{document.authorName}</strong>
              </div>
              <div className="doc-side-row">
                <span>Обновлено</span>
                <strong>{formatDate(document.updatedAt)}</strong>
              </div>
              {document.description ? (
                <div className="doc-side-row">
                  <span>Описание</span>
                  <strong>{document.description}</strong>
                </div>
              ) : null}
            </div>

            <div className="doc-side-block">
              <div className="doc-side-title">Версии</div>
              {(document.versions || []).length === 0 ? (
                <button
                  type="button"
                  className="version-chip active"
                  onClick={() => setPreviewVersionNo(0)}
                >
                  Черновик
                </button>
              ) : (
                (document.versions || []).map((version) => (
                  <button
                    key={version.versionNo}
                    type="button"
                    className={
                      previewVersionNo === version.versionNo ? "version-chip active" : "version-chip"
                    }
                    onClick={() => setPreviewVersionNo(version.versionNo)}
                  >
                    {versionLabel(version.versionNo, document.activeVersionNo)}
                  </button>
                ))
              )}
            </div>

            <div className="doc-side-block">
              <div className="doc-side-title">Ознакомление</div>
              <div className="ack-progress">
                <div className="ack-progress-bar" style={{ width: `${ackPercent}%` }} />
              </div>
              <div className="ack-progress-label">
                {ackDone} из {ackTotal}
              </div>
              {(document.assignedUsers || []).map((user) => (
                <div className="ack-user" key={user.id}>
                  <span>{user.fullName}</span>
                  {user.isAcknowledged ? <span className="ack-check">✓</span> : null}
                </div>
              ))}
            </div>
          </aside>

          <div className="doc-preview-main">
            <div className="preview-toolbar">
              <strong>{previewFile.label}</strong>
              <span className="preview-filename">{previewFile.name || "Файл не найден"}</span>
              {previewFile.url ? (
                <a className="btn cancel" href={previewFile.url} download={previewFile.name || true}>
                  Скачать файл
                </a>
              ) : null}
            </div>

            <div className="preview-stage">
              {filePreview.loading ? (
                <div className="preview-empty">Загрузка файла...</div>
              ) : filePreview.error ? (
                <div className="preview-empty">{filePreview.error}</div>
              ) : previewFile.url && isImageFile(previewFile.name, previewFile.mimeType) ? (
                <img src={previewFile.url} alt={previewFile.name} />
              ) : previewFile.url && isPdfFile(previewFile.name, previewFile.mimeType) ? (
                <iframe title={previewFile.name} src={previewFile.url} />
              ) : previewFile.url && isWordFile(previewFile.name, previewFile.mimeType) ? (
                filePreview.docHtml ? (
                  <div className="preview-docx">
                    <div
                      className="preview-docx-page"
                      dangerouslySetInnerHTML={{ __html: filePreview.docHtml }}
                    />
                  </div>
                ) : (
                  <div className="preview-empty">Не удалось подготовить предпросмотр Word.</div>
                )
              ) : previewFile.url && isSpreadsheetFile(previewFile.name, previewFile.mimeType) ? (
                filePreview.sheets.length ? (
                  <div className="preview-sheet-list">
                    {filePreview.sheets.map((sheet) => (
                      <section className="preview-sheet" key={sheet.name}>
                        <h3>{sheet.name}</h3>
                        <div dangerouslySetInnerHTML={{ __html: sheet.html }} />
                      </section>
                    ))}
                  </div>
                ) : (
                  <div className="preview-empty">Не удалось подготовить предпросмотр Excel.</div>
                )
              ) : previewFile.url && isLegacyWordFile(previewFile.name, previewFile.mimeType) ? (
                <div className="preview-empty">
                  Предпросмотр старого формата Word `.doc` не поддерживается. Откройте или скачайте
                  файл.
                </div>
              ) : previewFile.url ? (
                <div className="preview-empty">Предпросмотр для этого типа файла недоступен.</div>
              ) : (
                <div className="preview-empty">Файл еще не загружен.</div>
              )}
            </div>

            {previewFile.url ? (
              <a className="preview-open" href={previewFile.url} target="_blank" rel="noreferrer">
                Открыть файл в новой вкладке
              </a>
            ) : null}

            <div className="doc-actions">
              {isTrash && isResponsible ? (
                <>
                  <button
                    className="btn primary"
                    type="button"
                    disabled={loading}
                    onClick={() => onRestore(document.id)}
                  >
                    Восстановить
                  </button>
                  <button
                    className="btn danger-text"
                    type="button"
                    disabled={loading}
                    onClick={() => onPermanentDelete(document.id)}
                  >
                    Удалить безвозвратно
                  </button>
                </>
              ) : null}
              {!isTrash && isResponsible && document.status === "draft" ? (
                <button className="btn primary" type="button" onClick={() => onPublish(document.id)}>
                  Опубликовать
                </button>
              ) : null}
              {!isTrash && !isResponsible && !document.isAcknowledged ? (
                <button
                  className="btn primary"
                  type="button"
                  onClick={() => onAcknowledge(document.id, document.activeVersionNo)}
                >
                  Ознакомлен
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {tab === "requisites" && isResponsible && !isTrash ? (
        <form className="doc-form" onSubmit={handleSave}>
          <div className="form-grid">
            <div className="form-row equal">
              <label className="form-field">
                Тип документа
                <select
                  className="field-select"
                  value={editForm.type}
                  onChange={(event) =>
                    setEditForm((current) => ({ ...current, type: event.target.value }))
                  }
                >
                  {TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                Номер
                <input
                  className="field-input"
                  value={editForm.number}
                  onChange={(event) =>
                    setEditForm((current) => ({ ...current, number: event.target.value }))
                  }
                />
              </label>
            </div>

            <label className="form-field">
              Название документа
              <input
                className="field-input"
                value={editForm.title}
                onChange={(event) =>
                  setEditForm((current) => ({ ...current, title: event.target.value }))
                }
                required
              />
            </label>

            <label className="form-field">
              Дата документа
              <input
                className="field-input"
                type="date"
                value={editForm.documentDate}
                onChange={(event) =>
                  setEditForm((current) => ({ ...current, documentDate: event.target.value }))
                }
                required
              />
            </label>

            <div className="form-field">
              <span>Сотрудники для ознакомления</span>
              <div className="users-toolbar">
                <button
                  className="link-btn"
                  type="button"
                  onClick={() =>
                    setEditForm((current) => ({
                      ...current,
                      assignedUsers: employeeUsers.map((candidate) => candidate.id),
                    }))
                  }
                >
                  Выбрать всех
                </button>
                <button
                  className="link-btn"
                  type="button"
                  onClick={() => setEditForm((current) => ({ ...current, assignedUsers: [] }))}
                >
                  Снять выделение
                </button>
              </div>
              <div className="users-box">
                {employeeUsers.map((candidate) => (
                  <label className="user-check" key={candidate.id}>
                    <input
                      type="checkbox"
                      checked={editForm.assignedUsers.includes(candidate.id)}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          assignedUsers: event.target.checked
                            ? [...current.assignedUsers, candidate.id]
                            : current.assignedUsers.filter((id) => id !== candidate.id),
                        }))
                      }
                    />
                    <span>
                      {candidate.fullName} ({candidate.email})
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <label className="form-field">
              Описание
              <textarea
                rows="5"
                value={editForm.description}
                onChange={(event) =>
                  setEditForm((current) => ({ ...current, description: event.target.value }))
                }
              />
            </label>
          </div>

          <div className="modal-foot">
            {document.status !== "archived" ? (
              <button className="btn cancel" type="button" onClick={() => onArchive(document.id)}>
                В архив
              </button>
            ) : null}
            <button className="btn danger-text" type="button" onClick={() => onDelete(document.id)}>
              Удалить документ
            </button>
            <button
              className="btn cancel"
              type="button"
              onClick={() => {
                setEditForm({
                  title: document.title || "",
                  type: document.type,
                  number: document.number || "",
                  documentDate: toIsoDateValue(document.documentDate),
                  description: document.description || "",
                  assignedUsers: (document.assignedUsers || []).map((user) => user.id),
                });
                setTab("preview");
              }}
            >
              Отмена
            </button>
            <button className="btn primary" type="submit" disabled={loading}>
              {loading ? "Сохранение..." : "Сохранить реквизиты"}
            </button>
          </div>
        </form>
      ) : null}

      {tab === "version" && isResponsible && !isTrash ? (
        <form className="doc-form" onSubmit={handleNewVersion}>
          <label className="form-field">
            Причина новой версии
            <textarea
              rows="6"
              placeholder="Что изменилось в новой версии"
              value={versionForm.changeReason}
              onChange={(event) =>
                setVersionForm((current) => ({ ...current, changeReason: event.target.value }))
              }
              required
            />
          </label>
          <label className="form-field">
            Файл новой версии
            <input
              className="file-input"
              type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp"
              onChange={(event) =>
                setVersionForm((current) => ({
                  ...current,
                  versionFile: event.target.files?.[0] || null,
                }))
              }
              required
            />
          </label>
          <div className="modal-foot">
            <button className="btn cancel" type="button" onClick={() => setTab("preview")}>
              Отмена
            </button>
            <button className="btn primary" type="submit" disabled={loading}>
              {loading ? "Сохранение..." : "Создать новую версию"}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
