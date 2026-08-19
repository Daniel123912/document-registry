export default function ReportTable({ listTitle, reportRows }) {
  return (
    <section className="list-card">
      <h2 className="list-title">{listTitle}</h2>
      <table className="doc-table">
        <thead>
          <tr>
            <th>Документ</th>
            <th>Версия</th>
            <th>Назначено</th>
            <th>Ознакомились</th>
            <th>Ожидают</th>
          </tr>
        </thead>
        <tbody>
          {reportRows.map((row) => (
            <tr key={row.id}>
              <td>{row.title}</td>
              <td>v{row.activeVersionNo}</td>
              <td>{row.assignedCount}</td>
              <td>{row.acknowledgedCount}</td>
              <td>{row.pendingCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {reportRows.length === 0 ? <div className="empty">Отчетов пока нет</div> : null}
    </section>
  );
}
