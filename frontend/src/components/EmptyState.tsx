import type { ReactNode } from "react";
import styles from "./EmptyState.module.css";

export function EmptyState({
  icon,
  title,
  description,
  footer,
  compact = false,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  footer?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={[styles.wrap, compact ? styles.compact : ""].filter(Boolean).join(" ")}>
      {icon && <div className={styles.icon}>{icon}</div>}
      <div className={styles.title}>{title}</div>
      {description && <p className={styles.description}>{description}</p>}
      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  );
}
