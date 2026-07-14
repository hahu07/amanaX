import type { ReactNode } from "react";
import styles from "./StatusBadge.module.css";

export type StatusTone = "success" | "neutral" | "error" | "warning" | "outline";

export function StatusBadge({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  const classes = [styles.badge, styles[tone]].join(" ");
  return (
    <span className={classes}>
      {tone !== "outline" && <span className={styles.dot} aria-hidden="true" />}
      {children}
    </span>
  );
}

/** Convenience wrapper for the recurring active/inactive record status. */
export function ActiveStatusBadge({ active }: { active: boolean }) {
  return <StatusBadge tone={active ? "success" : "neutral"}>{active ? "Active" : "Inactive"}</StatusBadge>;
}
