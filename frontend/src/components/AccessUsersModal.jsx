import { useEffect, useRef, useState } from "react";

export default function AccessUsersModal({
  employeeUsers = [],
  selectedIds = [],
  title = "Уведомления",
  description = "Выберите сотрудников, которые получат уведомление и должны ознакомиться с документом. Все сотрудники по-прежнему видят документ в реестре.",
  confirmLabel = "Сохранить",
  cancelLabel = "Отмена",
  onClose,
  onConfirm,
}) {
  const [draftIds, setDraftIds] = useState(() => [...selectedIds]);
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function toggleUser(userId, checked) {
    setDraftIds((current) =>
      checked ? [...current, userId] : current.filter((id) => id !== userId)
    );
  }

  function handleSubmit(event) {
    event.preventDefault();
    onConfirm(draftIds);
  }

  return (
    <div
      className="overlay overlay-center"
      onClick={onClose}
    >
      <form
        className="modal access-users-modal"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="modal-body">
          <h2 className="modal-title">{title}</h2>
          {description ? <p className="modal-text">{description}</p> : null}

          <div className="form-field">
            <div className="users-toolbar">
              <button
                className="link-btn"
                type="button"
                onClick={() =>
                  setDraftIds(employeeUsers.map((candidate) => candidate.id))
                }
              >
                Выбрать всех
              </button>
              <button
                className="link-btn"
                type="button"
                onClick={() => setDraftIds([])}
              >
                Снять выделение
              </button>
            </div>
            <div className="users-box users-box-modal">
              {employeeUsers.map((candidate) => (
                <label className="user-check" key={candidate.id}>
                  <input
                    type="checkbox"
                    checked={draftIds.includes(candidate.id)}
                    onChange={(event) => toggleUser(candidate.id, event.target.checked)}
                  />
                  <span>{candidate.fullName}</span>
                </label>
              ))}
              {employeeUsers.length === 0 ? (
                <div className="muted">Сотрудники пока не загружены</div>
              ) : null}
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button
            ref={closeRef}
            className="btn cancel"
            type="button"
            onClick={onClose}
          >
            {cancelLabel}
          </button>
          <button className="btn primary" type="submit">
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
