export default function LoginPage({ authForm, setAuthForm, onSubmit, loading, error }) {
  return (
    <main className="login-screen">
      <section className="login-card">
        <h1>Реестр</h1>
        <p>Документы, версии и ознакомление сотрудников.</p>
        <form className="login-form" onSubmit={onSubmit}>
          <label>
            Email
            <input
              className="field-input"
              type="email"
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
          <strong>Демо-учетки:</strong>
          <div>responsible@bakor.local / admin1234</div>
          <div>employee@bakor.local / user1234</div>
        </div>
        {error ? <div className="alert error">{error}</div> : null}
      </section>
    </main>
  );
}
