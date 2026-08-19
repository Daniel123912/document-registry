import { TYPE_OPTIONS } from "../constants";

export default function CreateDocumentModal({
  createForm,
  setCreateForm,
  employeeUsers,
  loading,
  onClose,
  onSubmit,
}) {
  return (
    <div className="overlay" onClick={onClose}>
      <form
        className="modal"
        onClick={(event) => event.stopPropagation()}
        onSubmit={onSubmit}
      >
        <div className="modal-body">
          <h2 className="modal-title">Создать документ</h2>
          <div className="form-grid">
            <div className="form-row">
              <label className="form-field">
                Тип
                <select
                  className="field-select"
                  value={createForm.type}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, type: event.target.value }))
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

            <div className="form-field">
              <span>Сотрудники для ознакомления</span>
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
                  onClick={() =>
                    setCreateForm((current) => ({ ...current, assignedUsers: [] }))
                  }
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
                    <span>
                      {candidate.fullName} ({candidate.email})
                    </span>
                  </label>
                ))}
                {employeeUsers.length === 0 ? (
                  <div className="muted">Сотрудники пока не загружены</div>
                ) : null}
              </div>
            </div>

            <label className="form-field">
              Файл документа
              <input
                className="file-input"
                type="file"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.gif,.webp"
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
