import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login } from "../api/authApi";
import { useAuth } from "../auth/AuthContext";
import { ROLE_ROUTE } from "../auth/types";
import { ApiError } from "../api/backendClient";
import { Button } from "../components/Button";
import { Alert } from "../components/Alert";
import styles from "./LoginPage.module.css";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { setAuth } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const auth = await login(email);
      setAuth(auth);
      navigate(`/dashboard/${ROLE_ROUTE[auth.role]}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.status === 401 ? "No active user found for this email." : "Something went wrong signing you in. Try again in a moment.");
      } else {
        setError("Could not reach the backend.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          Amana<span>X</span>
        </div>
        <p className={styles.subhead}>
          Sign in to continue.
          <span className={styles.devNote}>Dev login for this environment: email only, no password required.</span>
        </p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="operator@amanax.dev"
            />
          </div>

          {error && <Alert tone="error">{error}</Alert>}

          <Button type="submit" variant="primary" className={styles.submit} disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <div className={styles.footerLink}>
          <Link to="/">← Back to AmanaX</Link> · <Link to="/investor-signup">New investor? Create an account</Link>
        </div>
      </div>
    </main>
  );
}
