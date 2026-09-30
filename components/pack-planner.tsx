"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Shuffle,
  Save,
  Download,
  LockKeyhole,
  UnlockKeyhole,
  ImagePlus,
  RotateCcw,
  SlidersHorizontal,
  X,
  Sparkles,
  UsersRound,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Check,
  Pencil,
} from "lucide-react";
import type { Catalog } from "@/lib/types";
import {
  tierKeys,
  rebirthLayout,
  premiumLayout,
  formatPercent,
} from "@/lib/pocapop";
import {
  generatePlan,
  type PlannerCandidate,
  type PlannerOptions,
  type PlannerRow,
} from "@/lib/planner";
import { download, mutate, Modal } from "./ui";
import CardPhoto from "./card-photo";
import { popularityLevels, type Popularity } from "@/lib/planner-curation";

export default function PackPlanner({ data }: { data: Catalog }) {
  const router = useRouter();
  const [kind, setKind] = useState<"Rebirth" | "Premium">("Rebirth");
  const nextCode = (type: string) => {
    const prefix = type === "Premium" ? "HB" : "RB";
    return (
      prefix +
      String(
        Math.max(
          0,
          ...data.packs
            .filter((p) => p.game_pack_id?.startsWith(prefix))
            .map((p) => Number(p.game_pack_id!.slice(2))),
        ) + 1,
      ).padStart(2, "0")
    );
  };
  const [name, setName] = useState(""),
    [code, setCode] = useState(() => nextCode("Rebirth"));
  const [mode, setMode] = useState<PlannerOptions["mode"]>("balanced");
  const [limit, setLimit] = useState(2),
    [cooldown, setCooldown] = useState(1);
  const [excluded, setExcluded] = useState<string[]>([]),
    [showExcluded, setShowExcluded] = useState(false),
    [search, setSearch] = useState("");
  const [rows, setRows] = useState<PlannerRow[]>([]),
    [seed, setSeed] = useState(0);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [photoSlot, setPhotoSlot] = useState<string | null>(null),
    [asset, setAsset] = useState("");
  const [candidates, setCandidates] = useState<PlannerCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [newPercent, setNewPercent] = useState(75);
  const [levels, setLevels] = useState<Popularity[]>([...popularityLevels]);
  const [showRoster, setShowRoster] = useState(false);
  const [rosterSearch, setRosterSearch] = useState("");
  const [rosterSource, setRosterSource] = useState("all");
  const [rosterPage, setRosterPage] = useState(0);
  const [replaceSlot, setReplaceSlot] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError("");
    fetch("/api/planner", { signal: controller.signal, cache: "no-store" })
      .then(async (res) => {
        const result = await res.json();
        if (!res.ok) throw Error(result.error || "Unable to load reference roster");
        if (!controller.signal.aborted) setCandidates(result.pool);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setLoadError(e instanceof Error ? e.message : "Unable to load reference roster");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [data, reload]);
  const pool = useMemo(() => candidates.filter((c) => levels.includes(c.popularity)), [candidates, levels]);
  const replacing = rows.find((r) => r.slot === replaceSlot);
  const roster = pool.filter((c) => (!replacing || (c.idol.gender === replacing.gender && !excluded.includes(c.idol.id) && (!rows.some((r) => r.idol_id === c.idol.id) || c.idol.id === replacing.idol_id))) &&
    (rosterSource === "all" || (rosterSource === "new" ? !c.released : c.released > 0)) &&
    `${c.idol.stage_name} ${c.group?.name || "Solo"}`.toLowerCase().includes(rosterSearch.toLowerCase()));
  const counts = kind === "Premium" ? premiumLayout : rebirthLayout;
  const weights =
    kind === "Premium"
      ? [0, 0, 70, 25.8, 4, 0.2]
      : [70, 20, 7, 2.4, 0.56, 0.04];
  const used = new Set(rows.map((r) => r.idol_id));
  const candidateById = useMemo(() => new Map(candidates.map((c) => [c.idol.id, c])), [candidates]);
  const getCandidate = (id: string) => candidateById.get(id);
  const groupCounts = new Map<string, number>();
  rows.forEach((r) => {
    const p = getCandidate(r.idol_id);
    if (p) groupCounts.set(p.key, (groupCounts.get(p.key) || 0) + 1);
  });
  const complete =
    !loading && !loadError &&
    rows.length === counts.reduce((a, b) => a + b, 0) &&
    used.size === rows.length &&
    rows.every((r) => {
      const p = getCandidate(r.idol_id);
      return (
        p &&
        levels.includes(p.popularity) &&
        p.idol.gender === r.gender &&
        !excluded.includes(r.idol_id) &&
        p.gap >= cooldown
      );
    }) &&
    [...groupCounts.values()].every((n) => n <= limit) &&
    ["female", "male"].every((gender) => rows.filter((r) => r.gender === gender && !getCandidate(r.idol_id)?.released).length >= Math.ceil(counts.reduce((a, b) => a + b, 0) / 2 * newPercent / 100));
  const options: PlannerOptions = {
    kind,
    mode,
    groupLimit: limit,
    cooldown,
    excluded,
    seed: seed + 1,
    newPercent,
  };
  function generate(slot?: string) {
    setError("");
    setNotice("");
    try {
      const existing = slot
        ? rows.map((r) => ({ ...r, locked: r.slot !== slot }))
        : rows;
      const generated = generatePlan(
        data,
        {
          ...options,
          excluded: slot
            ? [...excluded, rows.find((r) => r.slot === slot)!.idol_id]
            : excluded,
        },
        existing,
        pool,
      );
      setRows(
        slot
          ? generated.map((r) => ({
              ...r,
              locked: rows.find((p) => p.slot === r.slot)?.locked || false,
            }))
          : generated,
      );
      setSeed(seed + 1);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to generate candidates.",
      );
    }
  }
  function exportRows() {
    return rows.map((r) => {
      const p = getCandidate(r.idol_id)!;
      return {
        PackID: code,
        "Pack Name": name,
        Slot: r.slot,
        Rarity: data.rarities.find((t) => t.id === r.rarity_id)?.game_key,
        Gender: r.gender === "female" ? "Female" : "Male",
        "Idol Name": p.idol.stage_name,
        "Group Name": p.group?.name || "Solo",
        "Idol ID": p.idol.game_idol_id || "",
        "Group ID": p.group?.game_group_id || "GROUP-SOLO",
        "Card ID": "",
        "Image Asset ID": r.image_asset_id,
        Notes: p.reference_artist_id ? `Reference: ${p.reference_artist_id}` : "",
      };
    });
  }
  async function save() {
    setBusy(true);
    setError("");
    try {
      await mutate({
        action: "pocapop_draft",
        values: { name, game_pack_id: code, pack_type: kind, rows },
      });
      setNotice(name + " saved as draft.");
      setCode(
        code.slice(0, 2) + String(Number(code.slice(2)) + 1).padStart(2, "0"),
      );
      setRows([]);
      setName("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save draft.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="planner-workspace">
      <aside className="planner-controls">
        <div className="section-title">
          <h2>Pack recipe</h2>
          <SlidersHorizontal size={18} />
        </div>
        <div className="segmented" aria-label="Pack type">
          {(["Rebirth", "Premium"] as const).map((t) => (
            <button
              key={t}
              className={kind === t ? "active" : ""}
              onClick={() => {
                setKind(t);
                setCode(nextCode(t));
                setRows([]);
                setError("");
                setNotice("");
              }}
              disabled={busy}
            >
              {t}
            </button>
          ))}
        </div>
        <label>
          PackID
          <input
            aria-label="PackID"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={8}
          />
        </label>
        <label>
          Pack name
          <input
            aria-label="Pack name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name your next pack"
            maxLength={200}
          />
        </label>
        <div className="control-section">
          <h3>Artist pool</h3>
          <div className="planner-pool-summary" aria-live="polite">
            {loading ? "Loading reference roster..." : `${pool.filter((c) => !c.released).length} new / ${pool.filter((c) => c.released).length} returning`}
          </div>
          <label>
            <span>Minimum new artists <b>{newPercent}%</b></span>
            <input type="range" aria-label="Minimum new artists" min={0} max={100} step={5} value={newPercent} onChange={(e) => setNewPercent(Number(e.target.value))} />
          </label>
          <fieldset className="planner-group-levels">
            <legend>Curated groups</legend>
            {popularityLevels.map((level) => <label className="check" key={level}>
              <input type="checkbox" checked={levels.includes(level)} onChange={(e) => setLevels(e.target.checked ? [...levels, level] : levels.filter((v) => v !== level))} />
              <span>{level[0].toUpperCase() + level.slice(1)}</span>
            </label>)}
          </fieldset>
          <button onClick={() => setShowRoster(true)} disabled={loading || !!loadError}>
            <UsersRound size={16} /> Candidate roster
          </button>
        </div>
        <div className="control-section">
          <h3>Selection strategy</h3>
          <div className="strategy-options">
            {(["balanced", "coverage", "variety"] as const).map((m) => (
              <button
                key={m}
                className={mode === m ? "active" : ""}
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
              >
                {m[0].toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
          <label>
            <span>
              Maximum per group <b>{limit}</b>
            </span>
            <input
              aria-label="Maximum artists per group"
              type="range"
              min={1}
              max={4}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            />
          </label>
          <label>
            Rebirth cooldown
            <select
              aria-label="Rebirth cooldown"
              value={cooldown}
              onChange={(e) => setCooldown(Number(e.target.value))}
            >
              <option value={0}>No cooldown</option>
              <option value={1}>Skip the latest pack</option>
              <option value={2}>Skip the latest 2 packs</option>
              <option value={3}>Skip the latest 3 packs</option>
            </select>
          </label>
          <button
            className="text-link"
            onClick={() => setShowExcluded(!showExcluded)}
          >
            Excluded artists <b>{excluded.length}</b>
          </button>
          {showExcluded && (
            <div className="exclude-picker">
              <input
                aria-label="Search excluded artists"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Find an artist"
              />
              <div>
                {pool
                  .filter((p) =>
                    (p.idol.stage_name + " " + p.group?.name)
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )
                  .map((p) => (
                    <label className="check" key={p.idol.id}>
                      <input
                        type="checkbox"
                        checked={excluded.includes(p.idol.id)}
                        onChange={(e) =>
                          setExcluded(
                            e.target.checked
                              ? [...excluded, p.idol.id]
                              : excluded.filter((id) => id !== p.idol.id),
                          )
                        }
                      />
                      <span>
                        {p.idol.stage_name}
                        <small>{p.group?.name || "Solo"}</small>
                      </span>
                    </label>
                  ))}
              </div>
            </div>
          )}
        </div>
        <div className="recipe-tiers">
          <h3>Composition</h3>
          {tierKeys.map(
            (key, i) =>
              counts[i] > 0 && (
                <div key={key}>
                  <span className={"tier-mark tier-" + key.toLowerCase()} />
                  <span>
                    {kind === "Premium"
                      ? ["", "", "Petal", "Silk", "Royal", "Crown"][i]
                      : key}
                    <small>
                      {formatPercent(weights[i] / counts[i])} / card
                    </small>
                  </span>
                  <b>{counts[i]}</b>
                  <small>
                    {counts[i] / 2} F / {counts[i] / 2} M
                  </small>
                </div>
              ),
          )}
        </div>
        <button
          className="primary generate-button"
          disabled={busy || loading || !!loadError || !pool.length}
          onClick={() => generate()}
        >
          <Sparkles size={17} />
          {rows.length ? "Regenerate unlocked" : "Generate pack"}
        </button>
      </aside>
      <section className="planner-board">
        <div className="planner-board-head">
          <div>
            <span className="eyebrow">{code || kind}</span>
            <h2>{name || "Untitled pack"}</h2>
          </div>
          <div className="toolbar">
            <button
              title="Clear unlocked cards"
              aria-label="Clear unlocked cards"
              disabled={busy || !rows.length}
              onClick={() => setRows(rows.filter((r) => r.locked))}
            >
              <RotateCcw size={17} />
            </button>
            <button
              disabled={!complete}
              onClick={() =>
                download(
                  exportRows(),
                  code + "-mapping",
                  kind === "Rebirth"
                    ? "Rebirth " + Number(code.slice(2))
                    : "Premium " + Number(code.slice(2)),
                )
              }
            >
              <Download size={16} /> Excel
            </button>
            <button
              className="primary"
              disabled={
                !complete ||
                busy ||
                !name.trim() ||
                !new RegExp(
                  kind === "Premium" ? "^HB[0-9]{2,6}$" : "^RB[0-9]{2,6}$",
                ).test(code) ||
                data.packs.some((p) => p.game_pack_id === code)
              }
              onClick={save}
            >
              <Save size={16} />
              {busy ? "Saving..." : "Save draft"}
            </button>
          </div>
        </div>
        <div className="planner-metrics">
          <span>
            <b>{rows.length}</b> / {counts.reduce((a, b) => a + b, 0)} cards
          </span>
          <span><b>{rows.filter((r) => !getCandidate(r.idol_id)?.released).length}</b> new to game</span>
          <span><b>{rows.filter((r) => getCandidate(r.idol_id)?.released).length}</b> returning</span>
          <span>
            <b>
              {
                new Set(
                  rows
                    .map((r) => getCandidate(r.idol_id)?.group?.id)
                    .filter(Boolean),
                ).size
              }
            </b>{" "}
            groups
          </span>
          <span>
            <LockKeyhole size={14} />
            <b>{rows.filter((r) => r.locked).length}</b> locked
          </span>
          <span>
            <b>{rows.filter((r) => r.image_asset_id).length}</b> photos chosen
          </span>
        </div>
        {loadError && <div className="notice error" role="alert">{loadError} <button onClick={() => setReload(reload + 1)}>Retry roster</button></div>}
        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div className="notice success" role="status">
            {notice}
          </div>
        )}
        {rows.length > 0 && !complete && (
          <div className="notice amber" role="status">
            Some selections no longer meet the current recipe. Regenerate
            unlocked slots or adjust the constraints.
          </div>
        )}
        {!rows.length ? (
          <div className="planner-empty">
            <div className="empty-deck">
              <span />
              <span />
              <span>
                <Sparkles size={32} />
              </span>
            </div>
            <h3>{counts.reduce((a, b) => a + b, 0)} open slots</h3>
            <span className="muted">
              Female / male · {kind === "Premium" ? 4 : 6} tiers
            </span>
          </div>
        ) : (
          <div className="plan-card-grid">
            {rows.map((r) => {
              const p = getCandidate(r.idol_id);
              const rarity = data.rarities.find((t) => t.id === r.rarity_id)!;
              const reference = p?.appearances.find(
                (c) => c.image_asset_id,
              )?.image_asset_id;
              return (
                <article
                  className={"plan-card " + (r.locked ? "locked" : "")}
                  key={r.slot}
                >
                  <div className="plan-card-top">
                    <span
                      className={"badge tier-" + rarity.game_key?.toLowerCase()}
                    >
                      {kind === "Premium"
                        ? (
                            {
                              Rare: "Petal",
                              Epic: "Silk",
                              Legendary: "Royal",
                              Mythic: "Crown",
                            } as Record<string, string>
                          )[rarity.game_key!]
                        : rarity.label}
                    </span>
                    <span>
                      #{r.slot} / {r.gender === "female" ? "F" : "M"}
                    </span>
                  </div>
                  <div className="plan-artist">
                    <div className="reference-photo">
                      <CardPhoto
                        key={r.image_asset_id || reference}
                        assetId={r.image_asset_id || reference}
                        alt={p?.idol.stage_name || "Artist"}
                      />
                      {!r.image_asset_id && <small>{reference ? "Reference" : "Photo pending"}</small>}
                    </div>
                    <div>
                      <button
                        className="planner-artist-picker"
                        aria-label={"Idol for slot " + r.slot}
                        disabled={r.locked || busy}
                        onClick={() => { setReplaceSlot(r.slot); setRosterSearch(""); setRosterSource("all"); setRosterPage(0); }}
                      >
                        <span>{p?.idol.stage_name || "Choose artist"}</span><Pencil size={13} />
                      </button>
                      <b>{p?.group?.name || "Solo"}</b>
                      <span className="planner-candidate-tags"><span className={"badge " + (p?.released ? "violet" : "green")}>{p?.released ? "Returning" : "New to game"}</span><small>{p?.popularity}</small></span>
                      <small>{r.reason}</small>
                    </div>
                  </div>
                  <footer>
                    <span>
                      {r.image_asset_id
                        ? "Photo selected"
                        : p?.pending ? `${p.pending} draft appearances` : `${p?.released || 0} released appearances`}
                    </span>
                    <div>
                      {p?.source_url && <a href={p.source_url} target="_blank" rel="noreferrer" className="icon-button" title="Artist reference" aria-label={"Artist reference for " + p.idol.stage_name}><ExternalLink size={16} /></a>}
                      <button
                        className="icon-button"
                        title="Choose image asset"
                        aria-label={"Choose image for slot " + r.slot}
                        onClick={() => {
                          setPhotoSlot(r.slot);
                          setAsset(r.image_asset_id);
                        }}
                      >
                        <ImagePlus size={16} />
                      </button>
                      <button
                        className="icon-button"
                        disabled={r.locked || busy}
                        title="Reroll this slot"
                        aria-label={"Reroll slot " + r.slot}
                        onClick={() => generate(r.slot)}
                      >
                        <Shuffle size={16} />
                      </button>
                      <button
                        className="icon-button"
                        aria-pressed={r.locked}
                        title={r.locked ? "Unlock slot" : "Lock slot"}
                        aria-label={"Lock slot " + r.slot}
                        onClick={() =>
                          setRows(
                            rows.map((v) =>
                              v.slot === r.slot
                                ? { ...v, locked: !v.locked }
                                : v,
                            ),
                          )
                        }
                      >
                        {r.locked ? (
                          <LockKeyhole size={16} />
                        ) : (
                          <UnlockKeyhole size={16} />
                        )}
                      </button>
                    </div>
                  </footer>
                </article>
              );
            })}
          </div>
        )}
      </section>
      {(showRoster || replaceSlot) && <Modal title={replaceSlot ? `Choose artist / slot ${replaceSlot}` : "Candidate roster"} close={() => { setShowRoster(false); setReplaceSlot(null); }}>
        <div className="planner-roster-toolbar">
          <input autoFocus aria-label="Search candidate roster" value={rosterSearch} onChange={(e) => { setRosterSearch(e.target.value); setRosterPage(0); }} placeholder="Idol or group" />
          <select aria-label="Candidate representation" value={rosterSource} onChange={(e) => { setRosterSource(e.target.value); setRosterPage(0); }}>
            <option value="all">All candidates</option><option value="new">New to game</option><option value="returning">Returning</option>
          </select>
        </div>
        <div className="planner-roster-count">{roster.length} artists / {roster.filter((c) => c.idol.gender === "female").length} F / {roster.filter((c) => c.idol.gender === "male").length} M</div>
        <div className="planner-roster-list">
          {roster.slice(rosterPage * 100, (rosterPage + 1) * 100).map((c) => <div key={c.identity}>
            <span><b>{c.idol.stage_name}</b><small>{c.group?.name || "Solo"} / {c.popularity}</small></span>
            <span className={"badge " + (c.released ? "violet" : "green")}>{c.released ? "Returning" : "New"}</span>
            {replaceSlot ? <button className="icon-button" title="Choose artist" aria-label={"Choose " + c.idol.stage_name + " / " + (c.group?.name || "Solo")} onClick={() => {
              setRows(rows.map((r) => r.slot === replaceSlot ? { ...r, idol_id: c.idol.id, image_asset_id: "", reason: "Moderator selection" } : r));
              setReplaceSlot(null);
            }}><Check size={16} /></button> : <button className="icon-button" title={excluded.includes(c.idol.id) ? "Include artist" : "Exclude artist"} aria-label={(excluded.includes(c.idol.id) ? "Include " : "Exclude ") + c.idol.stage_name} aria-pressed={excluded.includes(c.idol.id)} onClick={() => setExcluded(excluded.includes(c.idol.id) ? excluded.filter((id) => id !== c.idol.id) : [...excluded, c.idol.id])}><X size={16} /></button>}
          </div>)}
          {!roster.length && <p className="muted">No matching candidates.</p>}
        </div>
        <footer className="modal-actions">
          <span className="muted">{roster.length ? rosterPage * 100 + 1 : 0}-{Math.min((rosterPage + 1) * 100, roster.length)} / {roster.length}</span>
          <button className="icon-button" title="Previous candidates" aria-label="Previous candidates" disabled={!rosterPage} onClick={() => setRosterPage(rosterPage - 1)}><ChevronLeft size={16} /></button>
          <button className="icon-button" title="Next candidates" aria-label="Next candidates" disabled={(rosterPage + 1) * 100 >= roster.length} onClick={() => setRosterPage(rosterPage + 1)}><ChevronRight size={16} /></button>
        </footer>
      </Modal>}
      {photoSlot && (
        <Modal
          title={"Photo / slot " + photoSlot}
          close={() => setPhotoSlot(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setRows(
                rows.map((r) =>
                  r.slot === photoSlot ? { ...r, image_asset_id: asset } : r,
                ),
              );
              setPhotoSlot(null);
            }}
          >
            <label>
              Image Asset ID
              <input
                autoFocus
                inputMode="numeric"
                pattern="[0-9]{1,16}"
                value={asset}
                onChange={(e) => setAsset(e.target.value)}
                placeholder="Roblox asset ID"
              />
            </label>
            <div className="toolbar photo-options">
              <button
                type="button"
                onClick={() => {
                  const ref = getCandidate(
                    rows.find((r) => r.slot === photoSlot)!.idol_id,
                  )?.appearances.find((c) => c.image_asset_id)?.image_asset_id;
                  setAsset(ref || "");
                }}
              >
                Use reference photo
              </button>
              <button type="button" onClick={() => setAsset("")}>
                <X size={14} /> Clear
              </button>
            </div>
            <footer className="modal-actions">
              <button type="button" onClick={() => setPhotoSlot(null)}>
                Cancel
              </button>
              <button className="primary">Apply photo</button>
            </footer>
          </form>
        </Modal>
      )}
    </div>
  );
}
