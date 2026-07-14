import type { ReactNode } from "react";
import styles from "./DataTable.module.css";
import { IconChevronDown } from "./icons";
import { EmptyState } from "./EmptyState";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  align?: "left" | "right";
  /** Render this column's values with the monospace / tabular-numeral face — for IDs, party keys, timestamps. */
  mono?: boolean;
  width?: string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  keyExtractor: (row: T) => string;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function DataTable<T>({ columns, rows, keyExtractor, emptyTitle, emptyDescription }: DataTableProps<T>) {
  if (rows.length === 0) {
    return (
      <div className={styles.wrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} style={{ width: col.width }}>
                  <span className={styles.thInner}>
                    {col.header}
                    <IconChevronDown className={styles.sortIcon} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={styles.emptyCell} colSpan={columns.length}>
                <EmptyState
                  compact
                  title={emptyTitle ?? "Nothing here yet"}
                  description={emptyDescription ?? "Records will appear here once they exist."}
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={col.align === "right" ? styles.alignRight : undefined} style={{ width: col.width }}>
                <span className={styles.thInner}>
                  {col.header}
                  <IconChevronDown className={styles.sortIcon} />
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={keyExtractor(row)}>
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={[col.align === "right" ? styles.alignRight : "", col.mono ? styles.mono : ""]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
