"use client";
import { useEffect, useId, useRef, useState } from "react";
export function Badge({
  children,
  tone = "",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={"badge " + tone}>{children}</span>;
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">◇</span>
      <h3>{title}</h3>
      {children}
    </div>
  );
}
export function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: React.ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      className="modal"
    >
      <header>
        <h2 id={titleId}>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={close}
        >
          ×
        </button>
      </header>
      {children}
    </dialog>
  );
}
export type Column<T> = {
  key: string;
  label: string;
  render: (row: T) => React.ReactNode;
  sort?: (row: T) => string | number;
};
export function DataTable<T>({
  rows,
  columns,
  rowKey,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
}) {
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState("");
  const [asc, setAsc] = useState(true);
  const col = columns.find((c) => c.key === sort);
  const ordered = [...rows].sort((a, b) => {
    if (!col?.sort) return 0;
    const x = col.sort(a),
      y = col.sort(b);
    return (
      (typeof x === "number" && typeof y === "number"
        ? x - y
        : String(x).localeCompare(String(y), undefined, { numeric: true })) *
      (asc ? 1 : -1)
    );
  });
  const pages = Math.max(1, Math.ceil(rows.length / 25));
  const active = Math.min(page, pages - 1);
  return (
    <>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key}>
                  {c.sort ? (
                    <button
                      onClick={() => {
                        setSort(c.key);
                        setAsc(sort === c.key ? !asc : true);
                        setPage(0);
                      }}
                    >
                      {c.label}{" "}
                      <span className="muted">
                        {sort === c.key ? (asc ? "↑" : "↓") : "↕"}
                      </span>
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ordered.slice(active * 25, active * 25 + 25).map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((c) => (
                  <td key={c.key}>{c.render(row)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <Empty title="No matching records">
            <p>Try changing your search or filters.</p>
          </Empty>
        )}
      </div>
      <footer className="pagination">
        <span>
          {rows.length ? active * 25 + 1 : 0}–
          {Math.min((active + 1) * 25, rows.length)} of {rows.length} records
        </span>
        <div>
          <button disabled={active === 0} onClick={() => setPage(active - 1)}>
            ← Previous
          </button>
          <span>
            {active + 1} / {pages}
          </span>
          <button
            disabled={active + 1 >= pages}
            onClick={() => setPage(active + 1)}
          >
            Next →
          </button>
        </div>
      </footer>
    </>
  );
}
export function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="filter-label">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">All {label.toLowerCase()}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
export async function mutate(input: unknown) {
  const response = await fetch("/api/catalog", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const result = await response.json();
  if (!response.ok) throw Error(result.error || "Unable to save changes");
  return result;
}
export async function download(
  rows: Record<string, unknown>[],
  name: string,
  sheet = "Cards",
) {
  const { exportWorkbook } = await import("@/lib/workbook");
  const blob = new Blob([exportWorkbook(rows, sheet)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name + ".xlsx";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
