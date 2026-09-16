"use client";
import { useMemo, useState } from "react";
import type { Catalog, ImportRow } from "@/lib/types";
import { planImport } from "@/lib/catalog";
import type { ParsedSheet } from "@/lib/workbook";
import { Badge, DataTable, mutate } from "./ui";
export default function Importer({
  data,
  done,
  groupName,
}: {
  data: Catalog;
  done: () => void;
  groupName?: string;
}) {
  const [mode, setMode] = useState<"cards" | "roster">(
    groupName ? "roster" : "cards",
  );
  const [sheets, setSheets] = useState<ParsedSheet[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [filename, setFilename] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [text, setText] = useState(
    data.group_memberships
      .filter(
        (m) =>
          m.membership_status === "current" &&
          data.groups.some((g) => g.id === m.group_id && g.name === groupName),
      )
      .map((m) => data.idols.find((i) => i.id === m.idol_id)?.stage_name || "")
      .join("\n"),
  );
  const [sex, setSex] = useState("unknown");
  const [excluded, setExcluded] = useState<string[]>([]);
  const [success, setSuccess] = useState("");
  const rows = useMemo(
    () =>
      sheets
        .filter((s) => selected.includes(s.name))
        .flatMap((s) => s.rows)
        .filter((r) => !excluded.includes(r.sheet + ":" + r.row)),
    [sheets, selected, excluded],
  );
  const plan = useMemo(() => planImport(rows, data, mode), [rows, data, mode]);
  const invalid = plan.filter((r) => r.issues.length);
  const good = plan.filter((r) => !r.issues.length && !r.duplicate);
  const duplicates = plan.filter((r) => r.duplicate).length;
  function reset() {
    setSheets([]);
    setSelected([]);
    setExcluded([]);
    setConfirmed(false);
    setSuccess("");
    setError("");
  }
  async function upload(file: File) {
    reset();
    setBusy(true);
    setFilename(file.name);
    try {
      if (file.size > 10 * 1024 * 1024)
        throw Error("Choose a file under 10 MB.");
      const { parseWorkbook } = await import("@/lib/workbook");
      const result = parseWorkbook(await file.arrayBuffer(), mode);
      setSheets(result);
      setSelected(result.filter((s) => !s.error).map((s) => s.name));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to read file.");
    } finally {
      setBusy(false);
    }
  }
  function paste() {
    reset();
    const lines = text
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean);
    setFilename("Roster editor — " + groupName);
    const parsed: ImportRow[] = lines.map((idol, i) => ({
      sheet: "Roster",
      row: i + 1,
      idol,
      group: groupName!,
      gender: sex,
      slot: "",
      rarity: "",
      pic_status: "",
      source_url: "",
      notes: "",
      membership_status: "current",
    }));
    setSheets([{ name: "Roster", rows: parsed, error: null, skipped: 0 }]);
    setSelected(["Roster"]);
  }
  async function commit() {
    setBusy(true);
    setError("");
    try {
      const result = await mutate({
        action: "import",
        mode,
        filename,
        rows: plan,
      });
      setSuccess(
        `${result.created} ${mode === "cards" ? "cards imported" : "roster memberships saved"}. ${duplicates + result.skipped} duplicate rows skipped.`,
      );
      setSheets([]);
      setSelected([]);
      setConfirmed(false);
      done();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="stack">
      {!groupName && (
        <div className="segmented">
          <button
            className={mode === "cards" ? "active" : ""}
            onClick={() => {
              setMode("cards");
              reset();
            }}
          >
            Rebirth workbook
          </button>
          <button
            className={mode === "roster" ? "active" : ""}
            onClick={() => {
              setMode("roster");
              reset();
            }}
          >
            Full rosters
          </button>
        </div>
      )}
      <div className="steps">
        <span className="active">
          01 <b>Upload</b>
        </span>
        <i />
        <span className={sheets.length ? "active" : ""}>
          02 <b>Review & resolve</b>
        </span>
        <i />
        <span>
          03 <b>Confirm import</b>
        </span>
      </div>
      {groupName ? (
        <div className="panel pad">
          <h3>Configure {groupName}’s full roster</h3>
          <p>
            Paste the complete current roster, one member per line. Existing
            artists are reused. Omitted members become former members; their
            cards stay intact.
          </p>
          <textarea
            rows={8}
            aria-label="Full roster members"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setConfirmed(false);
            }}
            placeholder={"Seoyeon\nHyerin\nJiwoo"}
          />
          <div className="toolbar">
            <label>
              Gender for new idols
              <select value={sex} onChange={(e) => setSex(e.target.value)}>
                {["unknown", "female", "male", "other"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <button
              className="primary"
              disabled={!text.trim() || busy}
              onClick={paste}
            >
              Parse & preview
            </button>
          </div>
        </div>
      ) : (
        <div className="upload panel">
          <span className="upload-icon">↥</span>
          <h2>
            {mode === "cards"
              ? "Bring your Rebirth workbook in."
              : "Import complete group rosters."}
          </h2>
          <p>
            {mode === "cards"
              ? "Keep your existing sheets and columns. We’ll detect packs and preview every row."
              : "Use Group, Idol, Gender, and Membership Status columns. Include every current member for each group."}
          </p>
          <label className="primary file-button">
            Choose workbook
            <input
              type="file"
              accept={mode === "roster" ? ".xlsx,.xls,.csv" : ".xlsx,.xls"}
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file);
                e.target.value = "";
              }}
            />
          </label>
          <p className="small muted">
            {mode === "cards" ? "XLSX or XLS" : "XLSX, XLS or CSV"} · Up to 10
            MB · Nothing is saved until you confirm
          </p>
        </div>
      )}
      {busy && <p role="status">Working…</p>}
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {success && (
        <div className="notice success" role="status">
          {success}
        </div>
      )}
      {!!sheets.length && (
        <>
          <section className="panel pad">
            <div className="section-title">
              <div>
                <h3>Detected sheets</h3>
                <p>
                  {filename} · {sheets.length} sheets ·{" "}
                  {sheets.reduce((n, s) => n + s.skipped, 0)} empty/header rows
                  skipped
                </p>
              </div>
              <button
                onClick={() => {
                  setSelected(
                    sheets.filter((s) => !s.error).map((s) => s.name),
                  );
                  setConfirmed(false);
                }}
              >
                Select all valid sheets
              </button>
            </div>
            <div className="sheet-grid">
              {sheets.map((s) => (
                <label className="sheet-option" key={s.name}>
                  <input
                    type="checkbox"
                    disabled={!!s.error}
                    checked={selected.includes(s.name)}
                    onChange={(e) => {
                      setSelected(
                        e.target.checked
                          ? [...selected, s.name]
                          : selected.filter((x) => x !== s.name),
                      );
                      setConfirmed(false);
                    }}
                  />
                  <span>
                    <b>{s.name}</b>
                    <small>{s.error || `${s.rows.length} rows`}</small>
                  </span>
                </label>
              ))}
            </div>
          </section>
          <div className="stat-grid compact">
            {[
              ["Ready to add", good.length],
              [
                "Existing idol matches",
                plan.filter((r) => r.existingIdol).length,
              ],
              [
                "New idols",
                new Set(
                  good
                    .filter((r) => r.newIdol)
                    .map(
                      (r) => r.group.toLowerCase() + "|" + r.idol.toLowerCase(),
                    ),
                ).size,
              ],
              [
                "New groups",
                new Set(
                  good
                    .filter((r) => r.newGroup)
                    .map((r) => r.group.toLowerCase()),
                ).size,
              ],
              ["Duplicates skipped", duplicates],
              ["Invalid rows", invalid.length],
            ].map(([label, value]) => (
              <div className="stat" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <section className="panel">
            <div className="pad">
              <h3>Review before importing</h3>
              <p>
                Fix invalid data in the workbook and upload again, or explicitly
                exclude those rows here. New packs start as drafts. Card imports
                never configure full rosters.
              </p>
              {excluded.length > 0 && (
                <p>
                  {excluded.length} rows excluded.{" "}
                  <button
                    onClick={() => {
                      setExcluded([]);
                      setConfirmed(false);
                    }}
                  >
                    Restore excluded rows
                  </button>
                </p>
              )}
            </div>
            <DataTable
              rows={plan}
              rowKey={(r) => r.sheet + ":" + r.row}
              columns={[
                {
                  key: "row",
                  label: "Source",
                  render: (r) => (
                    <>
                      {r.sheet}
                      <small>Row {r.row}</small>
                    </>
                  ),
                },
                {
                  key: "idol",
                  label: "Idol / group",
                  render: (r) => (
                    <>
                      <b>{r.idol || "Missing name"}</b>
                      <small>{r.group || "Soloist"}</small>
                    </>
                  ),
                },
                {
                  key: "slot",
                  label: mode === "cards" ? "Slot / rarity" : "Membership",
                  render: (r) =>
                    mode === "cards"
                      ? `${r.slot || "—"} / ${r.rarity}`
                      : r.membership_status,
                },
                {
                  key: "match",
                  label: "Match",
                  render: (r) => (
                    <Badge
                      tone={
                        r.issues.length
                          ? "red"
                          : r.duplicate
                            ? "amber"
                            : "green"
                      }
                    >
                      {r.issues.length
                        ? "Needs resolution"
                        : r.duplicate
                          ? "Duplicate"
                          : r.existingIdol
                            ? "Existing idol"
                            : "New idol"}
                    </Badge>
                  ),
                },
                {
                  key: "issues",
                  label: "Review",
                  render: (r) => (
                    <>
                      <span className="error small">{r.issues.join(" ")}</span>
                      <small>{r.warnings.join(" ")}</small>
                    </>
                  ),
                },
                {
                  key: "exclude",
                  label: "",
                  render: (r) => (
                    <button
                      onClick={() => {
                        setExcluded([...excluded, r.sheet + ":" + r.row]);
                        setConfirmed(false);
                      }}
                    >
                      Exclude
                    </button>
                  ),
                },
              ]}
            />
          </section>
          <div className="panel pad">
            <label className="check">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              {mode === "roster"
                ? "I confirm these are the complete rosters. Omitted members will become former members."
                : "I have reviewed new records, pack statuses, and duplicate warnings."}
            </label>
            <div className="toolbar">
              <p>
                {good.length} rows ready · {duplicates} duplicates skipped ·{" "}
                {invalid.length} invalid
              </p>
              <button
                className="primary"
                disabled={
                  !confirmed || !!invalid.length || !good.length || busy
                }
                onClick={commit}
              >
                Confirm {mode === "cards" ? "import" : "full rosters"} →
              </button>
            </div>
          </div>
        </>
      )}
      {!groupName && !sheets.length && (
        <section className="panel">
          <div className="pad">
            <h3>Import history</h3>
            <p>A record of confirmed workbook and roster imports.</p>
          </div>
          <DataTable
            rows={[...data.import_history].sort((a, b) =>
              b.imported_at.localeCompare(a.imported_at),
            )}
            rowKey={(r) => r.id}
            columns={[
              { key: "file", label: "File", render: (r) => r.filename },
              {
                key: "date",
                label: "Imported",
                render: (r) => new Date(r.imported_at).toLocaleString(),
              },
              {
                key: "processed",
                label: "Processed",
                render: (r) => r.rows_processed,
              },
              {
                key: "created",
                label: "Created / saved",
                render: (r) => r.rows_created,
              },
              {
                key: "skipped",
                label: "Skipped",
                render: (r) => r.rows_skipped,
              },
              {
                key: "warnings",
                label: "Warnings",
                render: (r) => r.warnings.join(" ") || "—",
              },
            ]}
          />
        </section>
      )}
    </div>
  );
}
