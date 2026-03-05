import { useState } from "react";
import { api } from "../utils/api";

export default function AuthScreen({ onAuth, onBack }) {
  const [mode, setMode] = useState("login"); // login | register | forgot | reset
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      if (mode === "register") {
        await api("/auth/register", {
          body: { username, email, password },
          method: "POST"
        });
        const token = await api("/auth/login", {
          body: { email, password },
          method: "POST"
        });
        onAuth(token.access_token);
      } else if (mode === "login") {
        const token = await api("/auth/login", {
          body: { email, password },
          method: "POST"
        });
        onAuth(token.access_token);
      } else if (mode === "forgot") {
        const res = await api("/auth/forgot-password", {
          body: { email },
          method: "POST"
        });
        if (res.reset_token) {
          setResetToken(res.reset_token);
          setMode("reset");
          setSuccess("Reset code generated! Enter your new password.");
        } else {
          setSuccess(res.message || "Check your email for reset instructions.");
        }
      } else if (mode === "reset") {
        await api("/auth/reset-password", {
          body: { token: resetToken, new_password: newPassword },
          method: "POST"
        });
        setSuccess("Password reset! You can now log in.");
        setMode("login");
        setPassword("");
      }
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setError("");
    setSuccess("");
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <button type="button" className="auth-back" onClick={onBack}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2Z" /></svg>
          Back
        </button>
        <div className="auth-brand">Discish</div>
        <h2>
          {mode === "login" && "Welcome back!"}
          {mode === "register" && "Create an account"}
          {mode === "forgot" && "Forgot password"}
          {mode === "reset" && "Reset password"}
        </h2>
        <p className="muted">
          {mode === "login" && "Sign in to continue"}
          {mode === "register" && "Use your email to get started"}
          {mode === "forgot" && "Enter your email to reset your password"}
          {mode === "reset" && "Enter your new password"}
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
          {(mode === "login" || mode === "register" || mode === "forgot") ? (
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
          ) : null}
          {(mode === "login" || mode === "register") ? (
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
          ) : null}
          {mode === "reset" ? (
            <label>
              New Password
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Enter new password"
                required
                minLength={6}
              />
            </label>
          ) : null}
          {error ? <span className="form-error">{error}</span> : null}
          {success ? <span className="form-success">{success}</span> : null}
          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? "Working..." :
              mode === "login" ? "Login" :
              mode === "register" ? "Register" :
              mode === "forgot" ? "Send Reset Code" :
              "Reset Password"}
          </button>
        </form>
        {mode === "login" ? (
          <>
            <button type="button" className="link-btn" onClick={() => switchMode("forgot")}>
              Forgot your password?
            </button>
            <button type="button" className="link-btn" onClick={() => switchMode("register")}>
              Need an account? Register
            </button>
          </>
        ) : mode === "register" ? (
          <button type="button" className="link-btn" onClick={() => switchMode("login")}>
            Already have an account? Login
          </button>
        ) : (
          <button type="button" className="link-btn" onClick={() => switchMode("login")}>
            Back to login
          </button>
        )}
      </div>
    </div>
  );
}
