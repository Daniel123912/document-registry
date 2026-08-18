import { useEffect, useMemo, useState } from "react";

const emptyVersionForm = {
  changeReason: "",
  versionFile: null,
};

function toIsoDateValue(value) {
  if (!value) {
    return "";
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function isImageFile(filename, mimeType) {
  return (
    String(mimeType || "").startsWith("image/") ||
    /\.(png|jpe?g|gif|webp)$/i.test(filename || "")
  );
}

function isPdfFile(filename, mimeType) {
  return mimeType === "application/pdf" || /\.pdf$/i.test(filename || "");
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
  loading,
  typeLabel,
  formatDate,
  typeOptions,
  onClose,
  onSaveRequisites,
  onArchive,
  onDelete,
  onCreateVersion,
  onAcknowledge,
  onPublish,
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

  const employeeUsers = users.filter((candidate) => candidate.role === "employee");
  const ackTotal = document.assignedCount || document.assignedUsers?.length || 0;
  const ackDone = document.acknowledgedCount || 0;
  const ackPercent = ackTotal ? Math.round((ackDone / ackTotal) * 100) : 0;

  const previewFile = useMemo(() => {
    const versions = document.versions || [];
    const selected = versions.find((version) => version.versionNo === previewVersionNo);
    if (selected) {
      return {
        url: selected.fileUrl,
        name: selected.originalFilename,
        mimeType: selected.mimeType,
        label: versionLabel(selected.versionNo, document.activeVersionNo),
      };
    }
    return {
      url: document.currentFileUrl,
      name: document.currentFilename,
      mimeType: document.currentMimeType,
      label: versionLabel(document.activeVersionNo, document.activeVersionNo),
    };
  }, [document, previewVersionNo]);

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

  function handleSave(event) {
    event.preventDefault();
    onSaveRequisites(document.id, editForm);
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

      <div className="doc-tabs">
        <button className={tab === "preview" ? "active" : ""} onClick={() => setTab("preview")}>
          Просмотр
        </button>
        {isResponsible ? (
          <button
            className={tab === "requisites" ? "active" : ""}
            onClick={() => setTab("requisites")}
          >
            Реквизиты
          </button>
        ) : null}
        {isResponsible ? (
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
                <a className="btn cancel" href={previewFile.url} download>
                  Скачать файл
                </a>
              ) : null}
            </div>

            <div className="preview-stage">
              {previewFile.url && isImageFile(previewFile.name, previewFile.mimeType) ? (
                <img src={previewFile.url} alt={previewFile.name} />
              ) : previewFile.url && isPdfFile(previewFile.name, previewFile.mimeType) ? (
                <iframe title={previewFile.name} src={previewFile.url} />
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
              {isResponsible && document.status === "draft" ? (
                <button className="btn primary" type="button" onClick={() => onPublish(document.id)}>
                  Опубликовать
                </button>
              ) : null}
              {!isResponsible && !document.isAcknowledged ? (
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

      {tab === "requisites" && isResponsible ? (
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
                  {typeOptions.map((option) => (
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
            <button className="btn cancel" type="button" onClick={onClose}>
              Отмена
            </button>
            <button className="btn primary" type="submit" disabled={loading}>
              {loading ? "Сохранение..." : "Сохранить реквизиты"}
            </button>
          </div>
        </form>
      ) : null}

      {tab === "version" && isResponsible ? (
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
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.gif,.webp"
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
