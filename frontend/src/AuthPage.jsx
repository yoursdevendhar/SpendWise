import { useState } from "react";
import { authRequest, setToken } from "./Api.js";
import "./auth.css";

function AuthPage({ onAuthenticated }) {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isRegister = mode === "register";

  function switchMode(next) {
    setMode(next);
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (isRegister && !name.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    if (isRegister && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const body = isRegister
        ? { name: name.trim(), email: email.trim(), password }
        : { email: email.trim(), password };

      const data = await authRequest(mode, body);
      setToken(data.access_token);
      onAuthenticated(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <aside className="auth-aside">
        <div className="auth-brand">SpendWise</div>
        <h2>Know where every rupee goes.</h2>
        <p>
          Track income and expenses, spot spending patterns, and watch your
          savings grow — all in one calm dashboard.
        </p>
        <ul className="auth-points">
          <li>Monthly income vs expense charts</li>
          <li>Category-wise spending breakdown</li>
          <li>Private to your account</li>
        </ul>
      </aside>

      <main className="auth-main">
        <form className="auth-card" onSubmit={handleSubmit} noValidate>
          <div className="auth-brand auth-brand-mobile">SpendWise</div>

          <h1>{isRegister ? "Create your account" : "Welcome back"}</h1>
          <p className="auth-subtitle">
            {isRegister
              ? "Start tracking your money in under a minute."
              : "Log in to see your dashboard."}
          </p>

          <div className="auth-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={!isRegister}
              className={!isRegister ? "active" : ""}
              onClick={() => switchMode("login")}
            >
              Log in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isRegister}
              className={isRegister ? "active" : ""}
              onClick={() => switchMode("register")}
            >
              Sign up
            </button>
          </div>

          {isRegister && (
            <div className="auth-field">
              <label htmlFor="auth-name">Name</label>
              <input
                id="auth-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                maxLength={100}
              />
            </div>
          )}

          <div className="auth-field">
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              maxLength={255}
            />
          </div>

          <div className="auth-field">
            <label htmlFor="auth-password">Password</label>
            <div className="auth-password">
              <input
                id="auth-password"
                type={showPassword ? "text" : "password"}
                autoComplete={isRegister ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isRegister ? "At least 8 characters" : "Your password"}
              />
              <button
                type="button"
                className="auth-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading
              ? "Please wait..."
              : isRegister
                ? "Create account"
                : "Log in"}
          </button>

          <p className="auth-switch">
            {isRegister ? "Already have an account?" : "New to SpendWise?"}{" "}
            <button
              type="button"
              onClick={() => switchMode(isRegister ? "login" : "register")}
            >
              {isRegister ? "Log in" : "Create an account"}
            </button>
          </p>
        </form>
      </main>
    </div>
  );
}

export default AuthPage;