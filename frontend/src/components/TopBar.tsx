import styles from "./TopBar.module.css";
import { IconLogout } from "./icons";

export function TopBar({
  pageLabel,
  roleLabel,
  partyId,
  onSignOut,
}: {
  pageLabel: string;
  roleLabel: string;
  partyId?: string | null;
  onSignOut: () => void;
}) {
  return (
    <header className={styles.topbar}>
      <span className={styles.pageLabel}>{pageLabel}</span>
      <div className={styles.identity}>
        <div className={styles.identityText}>
          <div className={styles.role}>{roleLabel}</div>
          {partyId && (
            <div className={styles.party} title={partyId}>
              {partyId}
            </div>
          )}
        </div>
        <div className={styles.divider} />
        <button type="button" className={styles.signOut} onClick={onSignOut}>
          <IconLogout />
          <span className={styles.signOutLabel}>Sign out</span>
        </button>
      </div>
    </header>
  );
}
