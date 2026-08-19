import { TYPE_OPTIONS } from "../constants";

export default function Sidebar({
  user,
  isResponsible,
  section,
  activeType,
  activeOpen,
  onToggleActive,
  onInbox,
  onSelectType,
  onArchive,
  onTrash,
  onReport,
  onCreate,
  onLogout,
}) {
  return (
    <aside className="sidebar">
      <h1 className="logo">Реестр</h1>
      {isResponsible ? (
        <button className="create-btn" onClick={onCreate}>
          + Создать документ
        </button>
      ) : null}

      <nav className="nav">
        <button
          className={section === "inbox" ? "nav-item active" : "nav-item"}
          onClick={onInbox}
        >
          Мои документы
        </button>

        <div className="nav-title">Рабочие разделы</div>

        <button className="nav-parent" onClick={onToggleActive}>
          <span>Действующие документы</span>
          <span className={activeOpen ? "chevron open" : "chevron"} />
        </button>

        {activeOpen
          ? TYPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                className={
                  section === "active" && activeType === option.value
                    ? "nav-sub active"
                    : "nav-sub"
                }
                onClick={() => onSelectType(option.value)}
              >
                {option.label}
              </button>
            ))
          : null}

        <button
          className={section === "archive" ? "nav-parent active" : "nav-parent"}
          onClick={onArchive}
        >
          <span>Архив</span>
          <span className="chevron" />
        </button>

        {isResponsible ? (
          <button
            className={section === "trash" ? "nav-item active" : "nav-item"}
            onClick={onTrash}
          >
            Корзина
          </button>
        ) : null}

        {isResponsible ? (
          <button
            className={section === "report" ? "nav-item active" : "nav-item"}
            onClick={onReport}
          >
            Отчеты
          </button>
        ) : null}
      </nav>

      <div className="sidebar-foot">
        <div>{user.fullName}</div>
        <div>{isResponsible ? "Ответственный" : "Сотрудник"}</div>
        <button className="logout-btn" onClick={onLogout}>
          Выйти
        </button>
      </div>
    </aside>
  );
}
