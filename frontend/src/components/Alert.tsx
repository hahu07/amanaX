import type { ReactNode } from "react";
import styles from "./Alert.module.css";
import { IconAlertTriangle } from "./icons";

export function Alert({ tone = "error", children }: { tone?: "error" | "success" | "neutral"; children: ReactNode }) {
  return (
    <div className={[styles.alert, styles[tone]].join(" ")} role={tone === "error" ? "alert" : undefined}>
      <IconAlertTriangle className={styles.icon} />
      <div>{children}</div>
    </div>
  );
}
