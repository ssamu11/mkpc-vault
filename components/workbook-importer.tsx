"use client";
import { useMemo, useRef, useState } from "react";
import {
  FileSpreadsheet,
  Upload,
  Check,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  FolderInput,
} from "lucide-react";
import type { Catalog } from "@/lib/types";
import type { ParsedSheet } from "@/lib/workbook";
import { mapSheet, previewPack, type PackMapping } from "@/lib/pack-import";
import { Badge, DataTable, Modal, mutate } from "./ui";
import CardPhoto from "./card-photo";

export default function WorkbookImporter({
  data,
  done,
}: {
  data: Catalog;
  done: () => void;
}) {
  const [sheets, setSheets] = useState<ParsedSheet[]>([]),
    [mappings, setMappings] = useState<PackMapping[]>([]);
  const [filename, setFilename] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const [focused, setFocused] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [dragging, setDragging] = useState(false);
  const [resolving, setResolving] = useState<{
      sheet: string;
      row: number;
    } | null>(null),
    [artist, setArtist] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const previews = useMemo(
    () =>
      mappings
        .filter((m) => m.selected)
        .map((m) =>
          previewPack(
            m,
            sheets.find((s) => s.name === m.sheet)?.rows || [],
            data,
          ),
        ),
    [mappings, sheets, data],
  );
  const rows = previews.flatMap((p) => p.rows);
  const invalid = previews.some(
    (p) => p.issues.length || p.rows.some((r) => r.issues.length),
  );
  const visible =
    previews.find((p) => p.mapping.sheet === focused) || previews[0];
  function change(sheet: string, values: Partial<PackMapping>) {
    setMappings(
      mappings.map((m) => (m.sheet === sheet ? { ...m, ...values } : m)),
    );
    setConfirmed(false);
    setError("");
  }
  function resolveArtist() {
    const idol = data.idols.find((i) => i.id === artist);
    if (!idol || !resolving) return;
    const group = data.groups.find((g) =>
      data.group_memberships.some(
        (m) =>
          m.idol_id === idol.id &&
          m.group_id === g.id &&
          m.membership_status === "current",
      ),
    );
    setSheets(
      sheets.map((s) =>
        s.name === resolving.sheet
          ? {
              ...s,
              rows: s.rows.map((r) =>
                r.row === resolving.row
                  ? {
                      ...r,
                      idol: idol.stage_name,
                      gender: idol.gender,
                      group: group?.name || "",
                      game_idol_id: idol.game_idol_id || "",
                      game_group_id: group?.game_group_id || "GROUP-SOLO",
                    }
                  : r,
              ),
            }
          : s,
      ),
    );
    setConfirmed(false);
    setResolving(null);
    setError("");
  }
  async function upload(file: File) {
    setBusy(true);
    setError("");
    setSuccess("");
    setConfirmed(false);
    try {
      if (file.size > 10 * 1024 * 1024)
        throw Error("Maximum workbook size is 10 MB.");
      const { parseWorkbook } = await import("@/lib/workbook");
      const parsed = parseWorkbook(await file.arrayBuffer(), "cards");
      setSheets(parsed);
      setMappings(
        parsed.map((s) => ({
          ...mapSheet(s.name, s.rows, data),
          selected: !s.error && !!s.rows.length,
        })),
      );
      setFilename(file.name);
      setFocused(parsed.find((s) => s.rows.length && !s.error)?.name || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to read workbook.");
    } finally {
      setBusy(false);
    }
  }
  async function commit() {
    setBusy(true);
    setError("");
    try {
      const result = await mutate({
        action: "pocapop_import",
        filename,
        packs: previews.map((p) => ({ mapping: p.mapping, rows: p.rows })),
      });
      setSuccess(
        `${result.created} added, ${result.updated} updated, ${result.skipped} unchanged.`,
      );
      setConfirmed(false);
      done();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="stack import-workspace">
      <div className="workflow-track">
        <span className="active">
          <Upload size={16} /> Workbook
        </span>
        <i />
        <span className={sheets.length ? "active" : ""}>
          <FolderInput size={16} /> Pack mapping
        </span>
        <i />
        <span className={rows.length ? "active" : ""}>
          <CheckCircle2 size={16} /> Review
        </span>
      </div>
      {error && (
        <div className="notice error" role="alert">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}
      {success && (
        <div className="notice success" role="status">
          <CheckCircle2 size={18} />
          {success}
        </div>
      )}
      <input
        ref={input}
        className="sr-only"
        type="file"
        aria-label="Upload PocaPop workbook"
        accept=".xlsx,.xls"
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = "";
        }}
      />
      {!sheets.length ? (
        <section
          className={`workbook-drop ${dragging ? "dragging" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (!busy && e.dataTransfer.files[0])
              void upload(e.dataTransfer.files[0]);
          }}
        >
          <div className="file-emblem">
            <FileSpreadsheet size={32} />
          </div>
          <h2>PocaPop workbook</h2>
          <span className="muted">XLSX / XLS · 10 MB maximum</span>
          <button
            className="primary"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            <Upload size={16} />
            {busy ? "Reading workbook..." : "Choose workbook"}
          </button>
        </section>
      ) : (
        <>
          <div className="file-heading">
            <FileSpreadsheet size={24} />
            <div>
              <b>{filename}</b>
              <small>
                {sheets.length} sheets · {rows.length} selected cards
              </small>
            </div>
            <button disabled={busy} onClick={() => input.current?.click()}>
              <RefreshCw size={16} /> Replace file
            </button>
          </div>
          <div className="import-layout">
            <aside className="sheet-list">
              <div className="section-title">
                <h3>Worksheets</h3>
                <button
                  className="text-link"
                  onClick={() => {
                    setMappings(
                      mappings.map((m) => ({
                        ...m,
                        selected:
                          !!sheets.find((s) => s.name === m.sheet)?.rows
                            .length &&
                          !sheets.find((s) => s.name === m.sheet)?.error,
                      })),
                    );
                    setConfirmed(false);
                  }}
                >
                  Select filled
                </button>
              </div>
              {sheets.map((s) => (
                <div
                  className={`sheet-row ${focused === s.name ? "active" : ""}`}
                  key={s.name}
                >
                  <input
                    aria-label={`Include ${s.name}`}
                    type="checkbox"
                    disabled={busy || !!s.error || !s.rows.length}
                    checked={
                      !!mappings.find((m) => m.sheet === s.name)?.selected
                    }
                    onChange={(e) =>
                      change(s.name, { selected: e.target.checked })
                    }
                  />
                  <button onClick={() => setFocused(s.name)}>
                    <b>{s.name}</b>
                    <small>
                      {s.error
                        ? "Unsupported layout"
                        : s.rows.length
                          ? `${s.rows.length} cards`
                          : "Empty template"}
                    </small>
                  </button>
                </div>
              ))}
            </aside>
            <div className="mapping-area">
              <h3>Pack mapping</h3>
              <div className="mapping-grid">
                {mappings
                  .filter((m) => m.selected)
                  .map((m) => {
                    const p = previews.find(
                      (p) => p.mapping.sheet === m.sheet,
                    )!;
                    return (
                      <div className="mapping-row" key={m.sheet}>
                        <b>
                          {m.sheet}
                          <small>
                            {p.existing_id ? "Existing catalog" : "New draft"}
                          </small>
                        </b>
                        <label>
                          PackID
                          <input
                            aria-label={`PackID for ${m.sheet}`}
                            value={m.code}
                            disabled={busy}
                            onChange={(e) =>
                              change(m.sheet, {
                                code: e.target.value.toUpperCase(),
                              })
                            }
                          />
                        </label>
                        <label>
                          Pack name
                          <input
                            aria-label={`Pack name for ${m.sheet}`}
                            value={m.name}
                            disabled={busy || !!p.existing_id}
                            placeholder="Name your pack"
                            onChange={(e) =>
                              change(m.sheet, { name: e.target.value })
                            }
                          />
                        </label>
                        <label>
                          Type
                          <select
                            aria-label={`Pack type for ${m.sheet}`}
                            value={m.type}
                            disabled={busy || !!p.existing_id}
                            onChange={(e) =>
                              change(m.sheet, {
                                type: e.target.value as PackMapping["type"],
                              })
                            }
                          >
                            <option>Rebirth</option>
                            <option>Premium</option>
                          </select>
                        </label>
                        <span
                          className={`mapping-state ${p.issues.length || p.rows.some((r) => r.issues.length) ? "error" : "success"}`}
                        >
                          {p.issues.length ||
                          p.rows.some((r) => r.issues.length) ? (
                            <AlertTriangle size={18} />
                          ) : (
                            <Check size={18} />
                          )}
                        </span>
                        {p.issues.length > 0 && (
                          <p className="mapping-errors error">
                            {p.issues.join(" ")}
                          </p>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
          <div className="import-counts">
            {(["Add", "Update", "Unchanged"] as const).map((state, i) => (
              <div key={state}>
                <span className={`count-dot c${i}`} />
                <span>
                  {state === "Add"
                    ? "New cards"
                    : state === "Update"
                      ? "Changes"
                      : "Unchanged"}
                </span>
                <b>{rows.filter((r) => r.change === state).length}</b>
              </div>
            ))}
            <div>
              <AlertTriangle size={16} />
              <span>Row issues</span>
              <b>{rows.filter((r) => r.issues.length).length}</b>
            </div>
          </div>
          {visible && (
            <section className="import-preview">
              <div className="section-title">
                <div>
                  <h3>
                    {visible.mapping.code} /{" "}
                    {visible.mapping.name || visible.mapping.sheet}
                  </h3>
                  <small>{visible.rows.length} cards</small>
                </div>
                <select
                  aria-label="Preview worksheet"
                  value={visible.mapping.sheet}
                  onChange={(e) => setFocused(e.target.value)}
                >
                  {previews.map((p) => (
                    <option key={p.mapping.sheet}>{p.mapping.sheet}</option>
                  ))}
                </select>
              </div>
              <DataTable
                rows={visible.rows}
                rowKey={(r) => `${r.sheet}:${r.row}`}
                columns={[
                  {
                    key: "photo",
                    label: "Photo",
                    render: (r) => (
                      <CardPhoto
                        key={r.image_asset_id}
                        assetId={r.image_asset_id}
                        alt={r.idol}
                      />
                    ),
                  },
                  { key: "slot", label: "Slot", render: (r) => r.slot },
                  {
                    key: "idol",
                    label: "Artist",
                    render: (r) => (
                      <>
                        <b>{r.idol}</b>
                        <small>{r.group || "Solo"}</small>
                      </>
                    ),
                  },
                  {
                    key: "tier",
                    label: "Tier",
                    render: (r) => (
                      <span className={`badge tier-${r.rarity.toLowerCase()}`}>
                        {r.rarity}
                      </span>
                    ),
                  },
                  {
                    key: "asset",
                    label: "Image Asset ID",
                    render: (r) => <code>{r.image_asset_id || "Pending"}</code>,
                  },
                  {
                    key: "change",
                    label: "Change",
                    render: (r) => (
                      <Badge
                        tone={
                          r.issues.length
                            ? "red"
                            : r.change === "Add"
                              ? "green"
                              : r.change === "Update"
                                ? "amber"
                                : ""
                        }
                      >
                        {r.issues.length ? "Resolve" : r.change}
                      </Badge>
                    ),
                  },
                  {
                    key: "details",
                    label: "Details",
                    render: (r) => (
                      <>
                        <small className={r.issues.length ? "error" : ""}>
                          {r.issues.join(" ") ||
                            r.changes.join(", ") ||
                            (r.change === "Unchanged"
                              ? "No content changes"
                              : r.game_card_id || "Draft card")}
                        </small>
                        {r.issues.length > 0 && (
                          <button
                            className="text-link"
                            disabled={busy}
                            onClick={() => {
                              const suggested = data.cards.find(
                                (c) =>
                                  c.pack_id === visible.existing_id &&
                                  c.image_asset_id === r.image_asset_id,
                              );
                              setArtist(
                                suggested
                                  ? data.card_idols.find(
                                      (a) => a.card_id === suggested.id,
                                    )?.idol_id || ""
                                  : r.idol_id || "",
                              );
                              setResolving({ sheet: r.sheet, row: r.row });
                            }}
                          >
                            Match artist
                          </button>
                        )}
                      </>
                    ),
                  },
                ]}
              />
            </section>
          )}
          <footer className="import-confirm">
            <label className="check">
              <input
                type="checkbox"
                checked={confirmed}
                disabled={busy || invalid}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              Approve the selected pack changes
            </label>
            <button
              className="primary"
              disabled={
                busy ||
                invalid ||
                !rows.length ||
                !confirmed ||
                !rows.some((r) => r.change !== "Unchanged")
              }
              onClick={commit}
            >
              {busy ? "Saving..." : "Confirm import"}
              <ArrowRight size={16} />
            </button>
          </footer>
        </>
      )}
      {!!data.import_history.length && (
        <section className="import-history">
          <div className="section-title">
            <h3>Recent imports</h3>
          </div>
          <DataTable
            rows={data.import_history.slice(0, 5)}
            rowKey={(r) => r.id}
            columns={[
              { key: "file", label: "Workbook", render: (r) => r.filename },
              {
                key: "time",
                label: "Imported",
                render: (r) => new Date(r.imported_at).toLocaleString(),
              },
              { key: "saved", label: "Saved", render: (r) => r.rows_created },
              {
                key: "skipped",
                label: "Unchanged / skipped",
                render: (r) => r.rows_skipped,
              },
            ]}
          />
        </section>
      )}
      {resolving && (
        <Modal
          title={"Match artist / row " + resolving.row}
          close={() => setResolving(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              resolveArtist();
            }}
          >
            <p>
              {
                sheets
                  .find((s) => s.name === resolving.sheet)
                  ?.rows.find((r) => r.row === resolving.row)?.idol
              }{" "}
              /{" "}
              {sheets
                .find((s) => s.name === resolving.sheet)
                ?.rows.find((r) => r.row === resolving.row)?.group || "Solo"}
            </p>
            <label>
              Catalog artist
              <select
                aria-label="Catalog artist"
                value={artist}
                required
                onChange={(e) => setArtist(e.target.value)}
              >
                <option value="">Choose an artist</option>
                {data.idols
                  .filter(
                    (i) => i.active && !i.game_idol_id?.endsWith("-GROUP"),
                  )
                  .sort((a, b) => a.stage_name.localeCompare(b.stage_name))
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.stage_name} /{" "}
                      {data.groups.find((g) =>
                        data.group_memberships.some(
                          (m) =>
                            m.idol_id === i.id &&
                            m.group_id === g.id &&
                            m.membership_status === "current",
                        ),
                      )?.name || "Solo"}
                    </option>
                  ))}
              </select>
            </label>
            <footer className="modal-actions">
              <button type="button" onClick={() => setResolving(null)}>
                Cancel
              </button>
              <button className="primary" disabled={!artist}>
                Apply match
              </button>
            </footer>
          </form>
        </Modal>
      )}
    </div>
  );
}
