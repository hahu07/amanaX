import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listPublicDistributors, signupInvestor, type DistributorOption } from "../api/investorsApi";
import { Button } from "../components/Button";
import { Alert } from "../components/Alert";
import styles from "./LoginPage.module.css";

// Step 11 (docs/prompt.md): the one self-service identity flow in this
// system — every other role is onboarded by the Platform Operator (see
// dashboards/operator/OperatorDashboard.tsx). Reached before login exists,
// so it can't live behind ProtectedRoute; see backend/src/api/investorSignup.ts
// for the matching public backend route.
export default function InvestorSignupPage() {
  const [distributors, setDistributors] = useState<DistributorOption[]>([]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [distributor, setDistributor] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    listPublicDistributors()
      .then(setDistributors)
      .catch(() => setError("Could not reach the backend."));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signupInvestor({ fullName, email, distributor });
      setDone(true);
    } catch {
      setError("Could not create your investor account — check your details and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <main className={styles.page}>
        <div className={styles.card}>
          <div className={styles.brand}>
            Amana<span>X</span>
          </div>
          <p className={styles.subhead}>
            Account created. Your chosen Distributor will review your KYC details before you can subscribe to any note.
          </p>
          <Button variant="primary" className={styles.submit} onClick={() => navigate("/login")}>
            Continue to sign in
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          Amana<span>X</span>
        </div>
        <p className={styles.subhead}>
          Create your investor account.
          <span className={styles.devNote}>Dev signup for this environment: no ID verification required.</span>
        </p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label htmlFor="fullName">Full name</label>
            <input id="fullName" required autoFocus value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Amina Bello" />
          </div>
          <div className={styles.field}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="amina@example.com"
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="distributor">Distributor</label>
            <select id="distributor" required value={distributor} onChange={(e) => setDistributor(e.target.value)}>
              <option value="" disabled>
                Select…
              </option>
              {distributors.map((d) => (
                <option key={d.party} value={d.party}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {distributors.length === 0 && <Alert tone="neutral">No active Distributor is onboarded yet — ask the Platform Operator to add one.</Alert>}
          {error && <Alert tone="error">{error}</Alert>}

          <Button type="submit" variant="primary" className={styles.submit} disabled={submitting || distributors.length === 0}>
            {submitting ? "Creating account…" : "Create account"}
          </Button>
        </form>

        <div className={styles.footerLink}>
          <Link to="/login">← Back to sign in</Link>
        </div>
      </div>
    </main>
  );
}
