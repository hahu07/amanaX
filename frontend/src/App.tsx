import { useEffect, useState } from "react";
import { getHealth, type HealthResponse } from "./api/backendClient";
import "./App.css";

export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem" }}>
      <h1>AmanaX</h1>
      <p>Islamic Capital Market Infrastructure — Milestone 0 shell.</p>
      <section>
        <h2>Backend status</h2>
        {error && <p style={{ color: "crimson" }}>Could not reach backend: {error}</p>}
        {!error && !health && <p>Checking backend…</p>}
        {health && (
          <ul>
            <li>backend: {health.backend}</li>
            <li>ledger reachable: {String(health.ledger.reachable)}</li>
            {health.ledger.offset !== undefined && <li>ledger offset: {health.ledger.offset}</li>}
            {health.ledger.error && <li>ledger error: {health.ledger.error}</li>}
          </ul>
        )}
      </section>
    </main>
  );
}
