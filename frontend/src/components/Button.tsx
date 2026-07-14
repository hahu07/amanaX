import type { ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
}

export function Button({ variant = "secondary", size = "md", className, ...rest }: ButtonProps) {
  const classes = [styles.button, styles[variant], size === "sm" ? styles.sm : "", className]
    .filter(Boolean)
    .join(" ");
  return <button className={classes} {...rest} />;
}
