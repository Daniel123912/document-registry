import { SORT_OPTIONS, typeLabel } from "../constants";
import { daysUntilTrashPurge, formatDate } from "../utils/dates";

export default function DocumentList({
  listTitle,
  section,
  search,
  sort,
  visibleDocuments,
  selectedDocumentId,
  onSearch,
  onSort,
  onReset,
  onSelect,
}) {
  return (
    <section className="list-card">
      <h2 className="list-title">{listTitle}</h2>
      {section === "trash" ? (
        <p className="list-hint">Документы хранятся 30 дней, после чего удаляются безвозвратно.</p>
      ) : null}
      <div className="toolbar">
        <input
          className="search-input"
          placeholder="Поиск по названию или номеру"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
        />
        <select
          className="sort-select"
          value={sort}
          onChange={(event) => onSort(event.target.value)}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button className="reset-btn" onClick={onReset}>
          Сбросить
        </button>
      </div>

      <table className="doc-table">
        <thead>
          <tr>
            <th>Документ</th>
            <th>Тип</th>
            <th>Версия</th>
            {section === "trash" ? (
              <>
                <th>Удалён</th>
                <th>Осталось</th>
              </>
            ) : null}
            {section === "inbox" ? <th>Статус</th> : null}
          </tr>
        </thead>
        <tbody>
          {visibleDocuments.map((document) => (
            <tr
              key={document.id}
              className={selectedDocumentId === document.id ? "active" : ""}
              onClick={() => onSelect(document.id)}
            >
              <td>
                <div className="doc-name">{document.title}</div>
                <div className="doc-sub">{document.number || formatDate(document.documentDate)}</div>
              </td>
              <td>{typeLabel(document.type)}</td>
              <td>v{document.activeVersionNo || 0}</td>
              {section === "trash" ? (
                <>
                  <td>{formatDate(document.deletedAt)}</td>
                  <td>{daysUntilTrashPurge(document.deletedAt)} дн.</td>
                </>
              ) : null}
              {section === "inbox" ? (
                <td>
                  <span className={`status ${document.isAcknowledged ? "ok" : "warn"}`}>
                    {document.isAcknowledged ? "Ознакомлен" : "Ожидается"}
                  </span>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>

      {visibleDocuments.length === 0 ? (
        <div className="empty">
          {section === "archive"
            ? "В архиве пока нет документов"
            : section === "trash"
              ? "Корзина пуста"
              : section === "inbox"
                ? "Нет документов на ознакомление"
                : search
                  ? "Ничего не найдено"
                  : "Документов этого типа пока нет"}
        </div>
      ) : null}
    </section>
  );
}
