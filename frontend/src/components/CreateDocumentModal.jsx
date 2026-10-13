import { ALL_TYPE_OPTIONS, ORDER_TYPE, typeAllowsFolders } from "../constants";
import { flattenFoldersForSelect } from "../utils/folders";

function NotifyRecipientsField({
  createForm,
  setCreateForm,
  employeeUsers,
  className = "",
  variant = "default",
}) {
  const selectedCount = createForm.assignedUsers.length;
  const isPanel = variant === "panel";

  return (
    <div
      className={[
        "form-field",
        isPanel ? "create-document-order-notify" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {isPanel ? (
        <div className="create-document-order-notify-head">
          <span className="create-document-order-notify-title">Кому отправить уведомление</span>
          {employeeUsers.length > 0 ? (
            <span className="create-document-order-notify-count">
              {selectedCount} из {employeeUsers.length}
            </span>
          ) : null}
        </div>
      ) : (
        <span>Кому отправить уведомление</span>
      )}
      <div className="users-toolbar">
        <button
          className="link-btn"
          type="button"
          onClick={() =>
            setCreateForm((current) => ({
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
          onClick={() => setCreateForm((current) => ({ ...current, assignedUsers: [] }))}
        >
          Снять выделение
        </button>
      </div>
      <div className="users-box">
        {employeeUsers.map((candidate) => (
          <label className="user-check" key={candidate.id}>
            <input
              type="checkbox"
              checked={createForm.assignedUsers.includes(candidate.id)}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  assignedUsers: event.target.checked
                    ? [...current.assignedUsers, candidate.id]
                    : current.assignedUsers.filter((id) => id !== candidate.id),
                }))
              }
            />
            <span className="user-check-name">{candidate.fullName}</span>
          </label>
        ))}
        {employeeUsers.length === 0 ? (
          <div className="muted">Сотрудники пока не загружены</div>
        ) : null}
      </div>
    </div>
  );
}

function OrderCreateFields({ createForm, setCreateForm, employeeUsers, orderPreviewNumber }) {
  return (
    <div className="create-document-order-layout">
      <div className="create-document-order-top">
        <div className="form-row create-document-order-meta">
          <label className="form-field">
            Номер
            <input
              className="field-input"
              value={orderPreviewNumber || "…"}
              readOnly
              aria-readonly="true"
              title="Номер присваивается при создании и не переиспользуется"
            />
          </label>
          <label className="form-field">
            Тип
            <select
              className="field-select"
              value={createForm.type}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  type: event.target.value,
                  folderId: "",
                }))
              }
            >
              {ALL_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            Дата документа
            <input
              className="field-input"
              type="date"
              value={createForm.documentDate}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  documentDate: event.target.value,
                }))
              }
              required
            />
          </label>
        </div>

        <label className="form-field">
          Название документа
          <input
            className="field-input"
            value={createForm.title}
            onChange={(event) =>
              setCreateForm((current) => ({ ...current, title: event.target.value }))
            }
            required
          />
        </label>
      </div>

      <label className="form-field create-document-order-description-field">
        <span className="create-document-order-field-label">Описание</span>
        <textarea
          className="create-document-order-description"
          rows={3}
          placeholder="Краткое описание документа"
          value={createForm.description}
          onChange={(event) =>
            setCreateForm((current) => ({
              ...current,
              description: event.target.value,
            }))
          }
        />
      </label>

      <label className="form-field create-document-order-file">
        <span className="create-document-order-field-label">
          Файл документа
          <span className="field-optional-badge">необязательно</span>
        </span>
        <input
          className="file-input"
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp"
          onChange={(event) =>
            setCreateForm((current) => ({
              ...current,
              docFile: event.target.files?.[0] || null,
            }))
          }
        />
      </label>

      <NotifyRecipientsField
        createForm={createForm}
        setCreateForm={setCreateForm}
        employeeUsers={employeeUsers}
        variant="panel"
        className="create-document-order-aside"
      />
    </div>
  );
}

export default function CreateDocumentModal({
  createForm,
  setCreateForm,
  folders = [],
  employeeUsers,
  loading,
  orderPreviewNumber = "",
  onClose,
  onSubmit,
}) {
  const folderOptions = flattenFoldersForSelect(folders, createForm.type);
  const isOrderType = createForm.type === ORDER_TYPE;

  return (
    <div
      className={["overlay", isOrderType ? "overlay-center" : ""].filter(Boolean).join(" ")}
      onClick={onClose}
    >
      <form
        className={["modal", isOrderType ? "create-document-order" : ""].filter(Boolean).join(" ")}
        onClick={(event) => event.stopPropagation()}
        onSubmit={onSubmit}
      >
        <div className="modal-body">
          <h2 className="modal-title">Создать документ</h2>

          {isOrderType ? (
            <OrderCreateFields
              createForm={createForm}
              setCreateForm={setCreateForm}
              employeeUsers={employeeUsers}
              orderPreviewNumber={orderPreviewNumber}
            />
          ) : (
            <div className="form-grid">
              <div className="form-row">
                <label className="form-field">
                  Тип
                  <select
                    className="field-select"
                    value={createForm.type}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        type: event.target.value,
                        folderId: "",
                      }))
                    }
                  >
                    {ALL_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-field">
                  Дата документа
                  <input
                    className="field-input"
                    type="date"
                    value={createForm.documentDate}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        documentDate: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
              </div>

              {typeAllowsFolders(createForm.type) ? (
                <label className="form-field">
                  Папка
                  <select
                    className="field-select"
                    value={createForm.folderId || ""}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        folderId: event.target.value,
                      }))
                    }
                  >
                    <option value="">Выберите папку</option>
                    {folderOptions.map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {folder.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <label className="form-field">
                Название документа
                <input
                  className="field-input"
                  value={createForm.title}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, title: event.target.value }))
                  }
                  required
                />
              </label>

              <label className="form-field">
                Описание
                <textarea
                  rows="4"
                  placeholder="Краткое описание документа"
                  value={createForm.description}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                />
              </label>

              <NotifyRecipientsField
                createForm={createForm}
                setCreateForm={setCreateForm}
                employeeUsers={employeeUsers}
              />

              <label className="form-field">
                Файл документа
                <input
                  className="file-input"
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp"
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      docFile: event.target.files?.[0] || null,
                    }))
                  }
                  required
                />
              </label>
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn cancel" type="button" onClick={onClose}>
            Отмена
          </button>
          <button className="btn primary" type="submit" disabled={loading}>
            {loading ? "Сохранение..." : "Создать документ"}
          </button>
        </div>
      </form>
    </div>
  );
}
