import { useEffect, useRef, useState } from "react";

export default function PromptModal({
  title,
  description,
  inputLabel,
  defaultValue = "",
  confirmLabel = "Сохранить",
  cancelLabel = "Отмена",
  danger = false,
  loading = false,
  error = "",
  onClose,
  onConfirm,
}) {
  const [value, setValue] = useState(defaultValue);
  const focusRef = useRef(null);
  const hasInput = Boolean(inputLabel);

  useEffect(() => {
    focusRef.current?.focus();
    if (hasInput) {
      focusRef.current?.select?.();
    }
  }, [hasInput]);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape" && !loading) {
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [loading, onClose]);

  function handleSubmit(event) {
    event.preventDefault();
    if (loading) {
      return;
    }
    onConfirm(hasInput ? value : undefined);
  }

  return (
    <div
      className="overlay overlay-center"
      onClick={() => {
        if (!loading) {
          onClose();
        }
      }}
    >
      <form
        className="modal compact"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="modal-body">
          <h2 className="modal-title">{title}</h2>
          {description ? <p className="modal-text">{description}</p> : null}
          {error ? <div className="alert error">{error}</div> : null}
          {hasInput ? (
            <label className="form-field">
              {inputLabel}
              <input
                ref={focusRef}
                className="field-input"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                autoComplete="off"
                required
              />
            </label>
          ) : null}
        </div>
        <div className="modal-foot">
          <button className="btn cancel" type="button" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </button>
          <button
            ref={hasInput ? undefined : focusRef}
            className={danger ? "btn danger" : "btn primary"}
            type="submit"
            disabled={loading}
          >
            {loading ? "Подождите..." : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
