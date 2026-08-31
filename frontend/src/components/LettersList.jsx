import { formatDate } from "../utils/dates";

function statusLabel(status) {
  if (status === "sent" || status === "confirmed") {
    return "Подтверждено";
  }
  return "Черновик";
}

export default function LettersList({
  listTitle,
  letters,
  loading,
  onSelect,
  onCompose,
  onDelete,
}) {
  return (
    <section className="list-card">
      <div className="letters-list-header">
        <h2 className="list-title">{listTitle}</h2>
        <button type="button" className="btn primary" onClick={onCompose}>
          Написать письмо
        </button>
      </div>

      {loading ? <div className="empty">Загрузка писем...</div> : null}

      {!loading ? (
        <table className="doc-table">
          <thead>
            <tr>
              <th>Тема</th>
              <th>Статус</th>
              <th>Дата</th>
              <th className="doc-table-actions-col" />
            </tr>
          </thead>
          <tbody>
            {letters.map((letter) => (
              <tr key={letter.id} onClick={() => onSelect(letter.id)}>
                <td>
                  <div className="doc-name">{letter.subject || "Без темы"}</div>
                  <div className="doc-sub">{letter.authorName}</div>
                </td>
                <td>
                  <span className={`status ${letter.status === "draft" ? "warn" : "ok"}`}>
                    {statusLabel(letter.status)}
                  </span>
                </td>
                <td>{formatDate(letter.sentAt || letter.updatedAt)}</td>
                <td className="doc-table-actions-col">
                  <button
                    type="button"
                    className="btn danger-text doc-table-action-btn"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete?.(letter);
                    }}
                  >
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {!loading && letters.length === 0 ? (
        <div className="empty">Писем пока нет. Нажмите «Написать письмо» или выберите пункт в контекстном меню.</div>
      ) : null}
    </section>
  );
}
