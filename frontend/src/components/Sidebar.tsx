import type { ReactNode } from "react";
import styles from "./Sidebar.module.css";

export interface NavItem {
  label: string;
  icon?: ReactNode;
  active?: boolean;
  disabled?: boolean;
}

export function Sidebar({ navItems }: { navItems: NavItem[] }) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span className={styles.brandMark}>
          Amana<span>X</span>
        </span>
      </div>
      <nav className={styles.nav}>
        <div className={styles.navLabel}>Workspace</div>
        {navItems.map((item) => (
          <button
            key={item.label}
            type="button"
            disabled={item.disabled}
            aria-current={item.active ? "page" : undefined}
            title={item.label}
            className={[styles.navItem, item.active ? styles.navItemActive : "", item.disabled ? styles.navItemDisabled : ""]
              .filter(Boolean)
              .join(" ")}
          >
            {item.icon}
            <span className={styles.navItemLabel}>{item.label}</span>
            {item.disabled && <span className={styles.comingSoon}>Soon</span>}
          </button>
        ))}
      </nav>
      <div className={styles.footer}>Canton Network</div>
    </aside>
  );
}
