import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login } from "../api/authApi";
import { useAuth } from "../auth/AuthContext";
import { ROLE_ROUTE } from "../auth/types";
import { ApiError } from "../api/backendClient";
import { Button } from "../components/Button";
import { Alert } from "../components/Alert";
import styles from "./LoginPage.module.css";

// Every account seeded on this demo's ledger — see backend/scripts/seed-devnet.ts
// (or the local walkthrough's own Operator-dashboard onboarding). Dev login has
// no password by design (see the subhead note below), so there's nothing sensitive
// in listing these: they only work against this specific demo dataset, and a judge
// with no prior context otherwise has no way to discover which email maps to
// which role.
const DEMO_ACCOUNTS: { role: string; email: string }[] = [
  { role: "Platform Operator", email: "operator@amanax.dev" },
  { role: "Issuer", email: "rid@amana.ng" },
  { role: "Fund Manager", email: "fm@amana.ng" },
  { role: "Issuing House", email: "ade@amanafin.ng" },
  { role: "Shariah Advisor", email: "advisor@amanashariah.ng" },
  { role: "Trustee", email: "trustee@amanatrustee.ng" },
  { role: "SEC", email: "reviewer@sec.gov.ng" },
  { role: "Custodian", email: "custodian@amanacustody.ng" },
  { role: "Distributor", email: "distributor@amanadist.ng" },
  { role: "Investor", email: "yusuf.garba@investor.ng" },
];

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { setAuth } = useAuth();
  const navigate = useNavigate();

  async function doLogin(emailValue: string) {
    setError(null);
    setSubmitting(true);
    try {
      const auth = await login(emailValue);
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await doLogin(email);
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

        <div className={styles.demoAccounts}>
          <p className={styles.demoAccountsLabel}>Demo accounts — click to sign in as that role</p>
          <div className={styles.demoAccountsList}>
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                className={styles.demoAccountRow}
                disabled={submitting}
                onClick={() => doLogin(account.email)}
              >
                <span className={styles.demoAccountRole}>{account.role}</span>
                <span className={styles.demoAccountEmail}>{account.email}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
