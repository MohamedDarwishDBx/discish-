import { useState } from "react";
import { api } from "../utils/api";

export default function AuthScreen({ onAuth, onBack }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "register") {
        await api("/auth/register", {
          body: { username, email, password },
          method: "POST"
        });
      }

      const token = await api("/auth/login", {
        body: { email, password },
        method: "POST"
      });
      onAuth(token.access_token);
    } catch (err) {
      setError(err.message || "Unable to authenticate");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <button type="button" className="auth-back" onClick={onBack}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2Z" /></svg>
          Back
        </button>
        <div className="auth-brand">Discish</div>
        <h2>{mode === "login" ? "Welcome back!" : "Create an account"}</h2>
        <p className="muted">
          {mode === "login"
            ? "Sign in to continue"
            : "Use your email to get started"}
        </p>
        <form onSubmit={handleSubmit} className="auth-form">
          {mode === "register" ? (
            <label>
              Username
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="yourname"
                required
              />
            </label>
          ) : null}
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@email.com"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="........"
              required
            />
          </label>
          {error ? <span className="form-error">{error}</span> : null}
          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? "Working..." : mode === "login" ? "Login" : "Register"}
          </button>
        </form>
        <button
          type="button"
          className="link-btn"
          onClick={() => {
            setMode((prev) => (prev === "login" ? "register" : "login"));
            setError("");
          }}
        >
          {mode === "login"
            ? "Need an account? Register"
            : "Already have an account? Login"}
        </button>
      </div>
    </div>
  );
}
