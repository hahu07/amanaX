import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./AppShell.module.css";
import { Sidebar, type NavItem } from "./Sidebar";
import { TopBar } from "./TopBar";
import { useAuth } from "../auth/AuthContext";
import { ROLE_LABEL } from "../auth/types";

/**
 * Shared application shell used identically by all 9 dashboards: dark chrome
 * sidebar + top bar, light content area. Individual dashboards only supply
 * their nav items, a page label, and their content.
 */
export function AppShell({ navItems, pageLabel, children }: { navItems: NavItem[]; pageLabel: string; children: ReactNode }) {
  const { auth, logout } = useAuth();
  const navigate = useNavigate();

  function handleSignOut() {
    logout();
    navigate("/login");
  }

  const roleLabel = auth ? ROLE_LABEL[auth.role] ?? auth.role : "";
  const partyId = auth?.party ?? auth?.org ?? null;

  return (
    <div className={styles.shell}>
      <Sidebar navItems={navItems} />
      <div className={styles.main}>
        <TopBar pageLabel={pageLabel} roleLabel={roleLabel} partyId={partyId} onSignOut={handleSignOut} />
        <main className={styles.content}>
          <div className={styles.contentInner}>{children}</div>
        </main>
      </div>
    </div>
  );
}
