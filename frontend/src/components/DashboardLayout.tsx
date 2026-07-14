import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function DashboardLayout({ title, children }: { title: string; children: ReactNode }) {
  const { auth, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ margin: 0 }}>AmanaX</h1>
          <p style={{ margin: 0, color: "#666" }}>
            {title} — signed in as {auth?.role}
            {auth?.org ? ` (${auth.org})` : ""}
          </p>
        </div>
        <button
          onClick={() => {
            logout();
            navigate("/login");
          }}
        >
          Sign out
        </button>
      </header>
      {children}
    </main>
  );
}
