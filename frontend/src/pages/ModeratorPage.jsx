import { useEffect, useMemo, useState } from "react";
import "../styles/app.css";
import {
  createModeratorUser,
  deleteModeratorUser,
  fetchModeratorUsers,
  moderatorLogin,
  updateModeratorUser,
} from "../api/client";

const emptyForm = {
  fullName: "",
  email: "",
  password: "",
  role: "employee",
  isActive: true,
};

function roleLabel(role) {
  return role === "responsible" ? "Модератор" : "Сотрудник";
}

function generatePassword(length = 10) {
  const chars =
    "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function matchesSearch(user, query) {
  if (!query) {
    return true;
  }
  const haystack = `${user.fullName} ${user.email}`.toLowerCase();
  return haystack.includes(query);
}

function PasswordCell({ password, onCopy }) {
  const [visible, setVisible] = useState(false);
  const value = password || "";

  if (!value) {
    return <span className="muted">—</span>;
  }

  return (
    <div className="moderator-password-cell">
      <code className="moderator-password">
        {visible ? value : "••••••••"}
      </code>
      <div className="moderator-password-actions">
        <button
          className="icon-text-btn"
          type="button"
          onClick={() => setVisible((current) => !current)}
          title={visible ? "Скрыть" : "Показать"}
        >
          {visible ? "Скрыть" : "Показать"}
        </button>
        <button
          className="icon-text-btn"
          type="button"
          onClick={() => onCopy(value)}
          title="Скопировать пароль"
        >
          Копировать
        </button>
      </div>
    </div>
  );
}

export default function ModeratorPage() {
  const [token, setToken] = useState(
    () => localStorage.getItem("bakorModeratorToken") || ""
  );
  const [loginForm, setLoginForm] = useState({ login: "", password: "" });
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState(null);

  const stats = useMemo(() => {
    let active = 0;
    let disabled = 0;
    let responsible = 0;
    for (const user of users) {
      if (user.isActive !== false) {
        active += 1;
      } else {
        disabled += 1;
      }
      if (user.role === "responsible") {
        responsible += 1;
      }
    }
    return {
      total: users.length,
      active,
      disabled,
      responsible,
      employees: users.length - responsible,
    };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((user) => {
      if (!matchesSearch(user, query)) {
        return false;
      }
      if (roleFilter !== "all" && user.role !== roleFilter) {
        return false;
      }
      if (statusFilter === "active" && user.isActive === false) {
        return false;
      }
      if (statusFilter === "disabled" && user.isActive !== false) {
        return false;
      }
      return true;
    });
  }, [users, search, roleFilter, statusFilter]);

  const filtersActive =
    search.trim() !== "" || roleFilter !== "all" || statusFilter !== "all";

  async function loadUsers(currentToken = token) {
    if (!currentToken) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      const rows = await fetchModeratorUsers(currentToken);
      setUsers(Array.isArray(rows) ? rows : []);
    } catch (requestError) {
      setError(requestError.message);
      if (requestError.message.includes("недействительна")) {
        logout();
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) {
      loadUsers();
    }
  }, [token]);

  useEffect(() => {
    if (!notice) {
      return undefined;
    }
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  function logout() {
    localStorage.removeItem("bakorModeratorToken");
    setToken("");
    setUsers([]);
    setEditorOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setNotice("");
    setDeleteTarget(null);
    setSearch("");
    setRoleFilter("all");
    setStatusFilter("all");
  }

  async function handleLogin(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await moderatorLogin(loginForm);
      localStorage.setItem("bakorModeratorToken", result.token);
      setToken(result.token);
      setNotice("Вход выполнен.");
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditingId(null);
    setForm({ ...emptyForm, password: generatePassword() });
    setEditorOpen(true);
    setError("");
  }

  function openEdit(user) {
    setEditingId(user.id);
    setForm({
      fullName: user.fullName,
      email: user.email,
      password: user.password || "",
      role: user.role,
      isActive: user.isActive !== false,
    });
    setEditorOpen(true);
    setError("");
  }

  function closeEditor() {
    if (loading) {
      return;
    }
    setEditorOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function copyPassword(value) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice("Пароль скопирован.");
    } catch {
      setNotice("Не удалось скопировать пароль.");
    }
  }

  async function handleSave(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (editingId) {
        const payload = {
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          role: form.role,
          isActive: form.isActive,
        };
        if (form.password.trim()) {
          payload.password = form.password;
        }
        await updateModeratorUser(token, editingId, payload);
        setNotice("Пользователь обновлён.");
      } else {
        if (!form.password.trim()) {
          setError("Укажите пароль для нового пользователя.");
          setLoading(false);
          return;
        }
        await createModeratorUser(token, {
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.role,
          isActive: form.isActive,
        });
        setNotice("Пользователь создан.");
      }
      closeEditor();
      await loadUsers();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) {
      return;
    }
    const user = deleteTarget;
    setDeleteTarget(null);
    setLoading(true);
    setError("");
    try {
      const result = await deleteModeratorUser(token, user.id);
      setNotice(result.message || "Пользователь удалён.");
      await loadUsers();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  function resetFilters() {
    setSearch("");
    setRoleFilter("all");
    setStatusFilter("all");
  }

  if (!token) {
    return (
      <main className="login-screen">
        <section className="login-card moderator-login-card">
          <p className="moderator-login-badge">Панель администратора</p>
          <h1>Вход</h1>
          <p>Управление учётными записями сотрудников реестра.</p>
          <form className="login-form" onSubmit={handleLogin}>
            <label>
              Логин
              <input
                className="field-input"
                type="text"
                autoComplete="username"
                value={loginForm.login}
                onChange={(event) =>
                  setLoginForm((current) => ({
                    ...current,
                    login: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              Пароль
              <input
                className="field-input"
                type="password"
                autoComplete="current-password"
                value={loginForm.password}
                onChange={(event) =>
                  setLoginForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
              />
            </label>
            <button className="btn primary" type="submit" disabled={loading}>
              {loading ? "Вход..." : "Войти"}
            </button>
          </form>
          <p className="helper">
            <a href="/">← К входу в реестр</a>
          </p>
          {error ? <div className="alert error">{error}</div> : null}
        </section>
      </main>
    );
  }

  return (
    <div className="moderator-shell">
      <header className="moderator-header">
        <div>
          <h1 className="moderator-title">Учётные записи</h1>
          <p className="moderator-subtitle">
            Создание, редактирование и отключение пользователей реестра
          </p>
        </div>
        <div className="moderator-header-actions">
          <button
            className="btn cancel"
            type="button"
            onClick={() => loadUsers()}
            disabled={loading}
          >
            {loading ? "Обновление..." : "Обновить"}
          </button>
          <button className="btn primary" type="button" onClick={openCreate}>
            + Новый пользователь
          </button>
          <a className="btn cancel" href="/">В реестр</a>
          <button className="btn cancel" type="button" onClick={logout}>
            Выйти
          </button>
        </div>
      </header>

      {error ? <div className="alert error">{error}</div> : null}

      <div className="report-summary moderator-summary">
        <div className="report-summary-item">
          <span className="report-summary-value">{stats.total}</span>
          <span className="report-summary-label">всего</span>
        </div>
        <div className="report-summary-item ok">
          <span className="report-summary-value">{stats.active}</span>
          <span className="report-summary-label">активных</span>
        </div>
        <div className="report-summary-item warn">
          <span className="report-summary-value">{stats.disabled}</span>
          <span className="report-summary-label">отключённых</span>
        </div>
        <div className="report-summary-item">
          <span className="report-summary-value">{stats.responsible}</span>
          <span className="report-summary-label">модераторов</span>
        </div>
      </div>

      <section className="list-card moderator-table-card">
        <div className="moderator-toolbar">
          <input
            className="search-input"
            type="search"
            placeholder="Поиск по ФИО или email..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            className="sort-select"
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
            aria-label="Фильтр по роли"
          >
            <option value="all">Все роли</option>
            <option value="employee">Сотрудники</option>
            <option value="responsible">Модераторы</option>
          </select>
          <select
            className="sort-select"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            aria-label="Фильтр по статусу"
          >
            <option value="all">Любой статус</option>
            <option value="active">Только активные</option>
            <option value="disabled">Только отключённые</option>
          </select>
          <button
            className="reset-btn"
            type="button"
            onClick={resetFilters}
            disabled={!filtersActive}
          >
            Сбросить
          </button>
        </div>

        <p className="moderator-results-hint">
          {filteredUsers.length === users.length
            ? `Показано ${users.length}`
            : `Показано ${filteredUsers.length} из ${users.length}`}
        </p>

        {loading && users.length === 0 ? (
          <div className="empty">Загрузка...</div>
        ) : users.length === 0 ? (
          <div className="moderator-empty">
            <p>Пользователей пока нет.</p>
            <button className="btn primary" type="button" onClick={openCreate}>
              Создать первого пользователя
            </button>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="moderator-empty">
            <p>Никого не найдено по текущим фильтрам.</p>
            <button className="btn cancel" type="button" onClick={resetFilters}>
              Сбросить фильтры
            </button>
          </div>
        ) : (
          <div
            className={`moderator-table-wrap${loading ? " is-loading" : ""}`}
          >
            <table className="moderator-table doc-table">
              <thead>
                <tr>
                  <th>ФИО</th>
                  <th>Email</th>
                  <th>Пароль</th>
                  <th>Роль</th>
                  <th>Статус</th>
                  <th className="doc-table-actions-col">Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    onDoubleClick={() => openEdit(user)}
                    title="Двойной щелчок — редактирование"
                  >
                    <td className="moderator-name">{user.fullName}</td>
                    <td>
                      <a
                        className="moderator-email"
                        href={`mailto:${user.email}`}
                      >
                        {user.email}
                      </a>
                    </td>
                    <td>
                      <PasswordCell
                        password={user.password}
                        onCopy={copyPassword}
                      />
                    </td>
                    <td>
                      <span
                        className={`moderator-role ${
                          user.role === "responsible" ? "lead" : ""
                        }`}
                      >
                        {roleLabel(user.role)}
                      </span>
                    </td>
                    <td>
                      {user.isActive !== false ? (
                        <span className="badge ok">Активен</span>
                      ) : (
                        <span className="badge muted">Отключён</span>
                      )}
                    </td>
                    <td className="moderator-actions doc-table-actions-col">
                      <button
                        className="link-btn"
                        type="button"
                        onClick={() => openEdit(user)}
                      >
                        Изменить
                      </button>
                      <button
                        className="link-btn danger"
                        type="button"
                        onClick={() => setDeleteTarget(user)}
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {notice ? (
        <div className="moderator-toast alert success" role="status">
          {notice}
        </div>
      ) : null}

      {editorOpen ? (
        <div className="overlay overlay-center" onClick={closeEditor}>
          <form
            className="modal moderator-editor compact"
            onClick={(event) => event.stopPropagation()}
            onSubmit={handleSave}
          >
            <div className="modal-body">
              <h2 className="modal-title">
                {editingId ? "Редактирование" : "Новый пользователь"}
              </h2>
              <label className="form-field">
                ФИО
                <input
                  className="field-input"
                  required
                  minLength={2}
                  autoFocus
                  value={form.fullName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      fullName: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="form-field">
                Email
                <input
                  className="field-input"
                  type="email"
                  required
                  value={form.email}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="form-field">
                Пароль
                <div className="moderator-password-field">
                  <input
                    className="field-input"
                    type="text"
                    autoComplete="new-password"
                    minLength={editingId ? 0 : 4}
                    placeholder={
                      editingId ? "Пусто — не менять" : "Минимум 4 символа"
                    }
                    required={!editingId}
                    value={form.password}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                  />
                  <button
                    className="btn cancel moderator-gen-btn"
                    type="button"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        password: generatePassword(),
                      }))
                    }
                  >
                    Сгенерировать
                  </button>
                </div>
              </label>
              <label className="form-field">
                Роль
                <select
                  className="field-input"
                  value={form.role}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      role: event.target.value,
                    }))
                  }
                >
                  <option value="employee">Сотрудник</option>
                  <option value="responsible">Модератор</option>
                </select>
              </label>
              <label className="user-check">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      isActive: event.target.checked,
                    }))
                  }
                />
                <span>Учётная запись активна</span>
              </label>
            </div>
            <div className="modal-foot">
              <button
                className="btn cancel"
                type="button"
                onClick={closeEditor}
                disabled={loading}
              >
                Отмена
              </button>
              <button className="btn primary" type="submit" disabled={loading}>
                {loading ? "Сохранение..." : "Сохранить"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {deleteTarget ? (
        <div
          className="overlay overlay-center"
          onClick={() => !loading && setDeleteTarget(null)}
        >
          <div
            className="modal compact moderator-delete-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-labelledby="moderator-delete-title"
          >
            <div className="modal-body">
              <h2 className="modal-title" id="moderator-delete-title">
                Удалить пользователя?
              </h2>
              <p className="moderator-delete-text">
                Будет удалён{" "}
                <strong>{deleteTarget.fullName}</strong> ({deleteTarget.email}).
                Если у пользователя есть связанные документы, удаление не
                выполнится — отключите учётную запись.
              </p>
            </div>
            <div className="modal-foot">
              <button
                className="btn cancel"
                type="button"
                disabled={loading}
                onClick={() => setDeleteTarget(null)}
              >
                Отмена
              </button>
              <button
                className="btn primary danger-btn"
                type="button"
                disabled={loading}
                onClick={confirmDelete}
              >
                {loading ? "Удаление..." : "Удалить"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
