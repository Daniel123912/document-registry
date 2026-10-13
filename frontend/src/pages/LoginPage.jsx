export default function LoginPage({ authForm, setAuthForm, onSubmit, loading, error }) {
  return (
    <main className="login-screen">
      <section className="login-card">
        <h1>Реестр</h1>
        <p>Документы, версии и ознакомление сотрудников.</p>
        <form className="login-form" onSubmit={onSubmit} autoComplete="off">
          <label>
            Email
            <input
              className="field-input"
              type="email"
              name="login-email"
              autoComplete="off"
              value={authForm.email}
              onChange={(event) =>
                setAuthForm((current) => ({ ...current, email: event.target.value }))
              }
            />
          </label>
          <label>
            Пароль
            <input
              className="field-input"
              type="password"
              name="login-password"
              autoComplete="new-password"
              value={authForm.password}
              onChange={(event) =>
                setAuthForm((current) => ({ ...current, password: event.target.value }))
              }
            />
          </label>
          <button className="btn primary" type="submit" disabled={loading}>
            {loading ? "Вход..." : "Войти"}
          </button>
        </form>
        <div className="helper">
          <a href="/moderator">Вход модератора</a>
        </div>
        {error ? <div className="alert error">{error}</div> : null}
      </section>
    </main>
  );
}
