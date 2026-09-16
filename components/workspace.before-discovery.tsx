"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Catalog, Card, Group } from "@/lib/types";
import {
  cardIdols,
  cardGroups,
  coverage,
  liveCards,
  cardExport,
} from "@/lib/catalog";
import { Badge, DataTable, Empty, Modal, download, mutate } from "./ui";
import {
  CardEditor,
  RecordEditor,
  DeleteDialog,
  MembershipEditor,
} from "./editors";
import Importer from "./importer";
import Cards from "./cards";
import { logout } from "@/app/login/actions";
const nav = [
  ["Dashboard", "◫"],
  ["Cards", "▤"],
  ["Packs", "▣"],
  ["Groups", "◈"],
  ["Idols", "♧"],
  ["Import", "↥"],
  ["Export", "↧"],
  ["Settings", "⚙"],
];
type Edit = { table: string; record?: Record<string, unknown> };
export default function Workspace({
  initial: data,
  email,
  role,
}: {
  initial: Catalog;
  email: string;
  role: string;
}) {
  const router = useRouter();
  const [page, setPage] = useState("Dashboard");
  const [detail, setDetail] = useState<string | null>(null);
  const [edit, setEdit] = useState<Edit | null>(null);
  const [cardEdit, setCardEdit] = useState<{ card?: Card } | null>(null);
  const [deletion, setDeletion] = useState<{
    table: string;
    id: string;
    name: string;
  } | null>(null);
  const [roster, setRoster] = useState<Group | null>(null);
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [missingOnly, setMissingOnly] = useState(false);
  const [notice, setNotice] = useState("");
  const [mobile, setMobile] = useState(false);
  function go(name: string, id: string | null = null) {
    setPage(name);
    setDetail(id);
    setQuery("");
    setMissingOnly(false);
    setMobile(false);
  }
  function done() {
    router.refresh();
    setNotice("Changes saved.");
    setTimeout(() => setNotice(""), 4000);
  }
  const live = liveCards(data);
  const represented = new Set(
    live.flatMap((c) => cardIdols(c, data).map((i) => i.id)),
  );
  const group = data.groups.find((g) => g.id === detail),
    pack = data.packs.find((p) => p.id === detail),
    idol = data.idols.find((i) => i.id === detail);
  const cardActions = {
    edit: (c?: Card) => setCardEdit({ card: c }),
    remove: (c: Card) =>
      setDeletion({
        table: "cards",
        id: c.id,
        name:
          c.card_name ||
          cardIdols(c, data)
            .map((i) => i.stage_name)
            .join(" × ") ||
          "Group card",
      }),
  };
  const headline = detail
    ? page === "Groups"
      ? group?.name
      : page === "Packs"
        ? pack?.name
        : idol?.stage_name
    : page === "Dashboard"
      ? "The big picture."
      : page === "Cards"
        ? "Your card masterlist."
        : page === "Import"
          ? "From spreadsheet to catalog."
          : page === "Export"
            ? "Your data, ready to go."
            : page === "Groups"
              ? "Every group. Every member."
              : page === "Packs"
                ? "Inside every pack."
                : page === "Idols"
                  ? "Meet your catalog."
                  : "Workspace settings.";
  function recordActions(
    table: string,
    record: { id: string; name?: string; stage_name?: string },
  ) {
    return (
      <div className="row-actions">
        <button
          onClick={() =>
            setEdit({
              table,
              record: record as unknown as Record<string, unknown>,
            })
          }
        >
          Edit
        </button>
        <button
          className="text-danger"
          onClick={() =>
            setDeletion({
              table,
              id: record.id,
              name: record.name || record.stage_name || "record",
            })
          }
        >
          Delete
        </button>
      </div>
    );
  }
  function groupRosterRows(g: Group) {
    return data.group_memberships
      .filter((m) => m.group_id === g.id)
      .map((m) => {
        const i = data.idols.find((i) => i.id === m.idol_id)!;
        const cs = live.filter(
          (c) =>
            cardIdols(c, data).some((x) => x.id === i.id) &&
            cardGroups(c, data).some((x) => x.id === g.id),
        );
        return {
          id: m.id,
          idol: i,
          cards: cs,
          packs: [
            ...new Set(
              cs.map(
                (c) => data.packs.find((p) => p.id === c.pack_id)?.name || "",
              ),
            ),
          ],
          status:
            m.membership_status === "former"
              ? "Former"
              : cs.length
                ? "Represented"
                : g.roster_configured
                  ? "Missing"
                  : "No live cards",
        };
      });
  }
  const coverageRows = data.groups.map((g) => {
    const c = coverage(g, data);
    return {
      Group: g.name,
      "Represented members": c.represented,
      "Full roster": c.total ?? "Not configured",
      "Missing members": c.missing?.length ?? "—",
      "Coverage %":
        c.percentage === null ? "—" : Number(c.percentage.toFixed(1)),
      "Total live cards": c.cards,
      "Total cards": data.cards.filter(card=>cardGroups(card,data).some(x=>x.id===g.id)).length,
    };
  });
  const rosterExport = (g: Group) =>
    groupRosterRows(g).map((r) => ({
      Group: g.name,
      Idol: r.idol.stage_name,
      Gender: r.idol.gender,
      "Membership status": r.status === "Former" ? "former" : "current",
      Cards: r.cards.length,
      Packs: r.packs.join(", "),
      "Representation status": r.status,
    }));
  return (
    <div className="app-shell">
      <aside className={"sidebar " + (mobile ? "open" : "")}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            go("Dashboard");
          }}
        >
          <span className="brand-mark">✦</span>
          <span>
            bias<span className="brand-light">vault</span>
            <small>MODERATOR WORKSPACE</small>
          </span>
        </a>
        <span className="nav-label">YOUR CATALOG</span>
        <nav>
          {nav.map(([name, icon], index) => (
            <button
              key={name}
              className={
                (page === name ? "active " : "") +
                (index === 5 ? "nav-break" : "")
              }
              onClick={() => go(name)}
            >
              <span>{icon}</span>
              {name}
              {name === "Cards" && (
                <small>{data.cards.length.toLocaleString()}</small>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="private-note">
            <span>◇</span>
            <div>
              <b>A shared source of truth</b>
              <p>Built for your moderator team.</p>
            </div>
          </div>
          <div className="user">
            <span className="avatar">{email.slice(0, 2).toUpperCase()}</span>
            <span>
              <b>{email.split("@")[0]}</b>
              <small>{role}</small>
            </span>
            <form action={logout}>
              <button title="Sign out" aria-label="Sign out">
                ↪
              </button>
            </form>
          </div>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div>
            <button
              className="mobile-menu"
              aria-label="Toggle navigation"
              onClick={() => setMobile(!mobile)}
            >
              ☰
            </button>
            <span className="muted">Workspace</span>
            <span className="crumb">/</span>
            <b>{page}</b>
            {detail && (
              <>
                <span className="crumb">/</span>
                <span>{headline}</span>
              </>
            )}
          </div>
          <span className="workspace-badge">
            Private workspace <span>↗</span>
          </span>
        </header>
        <main className="content">
          {notice && (
            <div className="toast" role="status">
              ✓ {notice}
            </div>
          )}
          <div className="page-heading">
            <div>
              {detail && (
                <button className="back" onClick={() => go(page)}>
                  ← All {page.toLowerCase()}
                </button>
              )}
              <p className="eyebrow">
                {page === "Dashboard"
                  ? "CATALOG OVERVIEW"
                  : page === "Import"
                    ? "REVIEW FIRST. IMPORT SECOND."
                    : page.toUpperCase()}
              </p>
              <h1>{headline}</h1>
              <p>
                {page === "Dashboard"
                  ? "A clear view of your cards, packs, and the members still waiting for a spotlight."
                  : page === "Cards"
                    ? "The source of truth for every card in your game."
                    : page === "Groups"
                      ? "Known artists and complete rosters stay distinctly separate."
                      : page === "Packs"
                        ? "Track each pack from the first draft to release."
                        : page === "Idols"
                          ? "Registered artists, represented members, and their card history."
                          : page === "Import"
                            ? "Import your Rebirth cards or configure complete group rosters."
                            : page === "Export"
                              ? "Download clean Excel files from your current catalog."
                              : "Manage your catalog’s rules and access."}
              </p>
            </div>
            {page === "Dashboard" && (
              <button className="primary" onClick={() => go("Import")}>
                ↥ Import Rebirth workbook
              </button>
            )}
            {["Groups", "Packs", "Idols"].includes(page) && !detail && (
              <button
                className="primary"
                onClick={() => setEdit({ table: page.toLowerCase() })}
              >
                ＋ Add {page.slice(0, -1).toLowerCase()}
              </button>
            )}
          </div>
          {page === "Dashboard" && (
            <>
              <div className="stat-grid">
                <Stat
                  label="Total cards"
                  value={data.cards.length}
                  note={`${live.length} in representation scope`}
                  icon="▤"
                />
                <Stat
                  label="Represented idols"
                  value={represented.size}
                  note={`${data.idols.length} registered artists`}
                  icon="♧"
                />
                <Stat
                  label="Groups"
                  value={data.groups.length}
                  note={`${data.groups.filter((g) => g.roster_configured).length} full rosters configured`}
                  icon="◈"
                />
                <Stat
                  label="Packs"
                  value={data.packs.length}
                  note={`${data.packs.filter((p) => p.status === "released").length} released · ${data.packs.filter((p) => ["draft", "planning", "ready"].includes(p.status)).length} upcoming`}
                  icon="▣"
                />
              </div>
              {!data.cards.length && (
                <div className="getting-started">
                  <div className="hero-glyph">✦</div>
                  <div>
                    <Badge tone="dark">YOUR CATALOG STARTS HERE</Badge>
                    <h2>Give every card a place.</h2>
                    <p>
                      Upload your Rebirth workbook to build your masterlist.
                      <br />
                      We’ll match artists and groups. You review before anything
                      is saved.
                    </p>
                    <button
                      className="dark-button"
                      onClick={() => go("Import")}
                    >
                      Import Rebirth workbook ↗
                    </button>
                  </div>
                  <div className="card-art" aria-hidden="true">
                    <div className="art-card one">
                      ✧<small>REBIRTH</small>
                    </div>
                    <div className="art-card two">
                      ✦<small>YOUR NEXT CHAPTER</small>
                    </div>
                  </div>
                </div>
              )}
              <div className="dashboard-grid">
                <section className="panel">
                  <div className="section-title pad">
                    <div>
                      <h2>Group representation</h2>
                      <p>
                        {data.settings.include_unreleased
                          ? "All pack statuses"
                          : "Released packs only"}{" "}
                        · Current members
                      </p>
                    </div>
                    <button onClick={() => go("Groups")}>View groups ↗</button>
                  </div>
                  {data.groups.length ? (
                    <div className="coverage-list">
                      {[...data.groups]
                        .sort(
                          (a, b) =>
                            (coverage(b, data).missing?.length || 0) -
                            (coverage(a, data).missing?.length || 0),
                        )
                        .slice(0, 6)
                        .map((g) => {
                          const c = coverage(g, data);
                          return (
                            <button
                              className="coverage-item"
                              key={g.id}
                              onClick={() => go("Groups", g.id)}
                            >
                              <div className="identity">
                                <span className="avatar group-avatar">
                                  {g.name.slice(0, 2)}
                                </span>
                                <span>
                                  <b>{g.name}</b>
                                  <small>
                                    {c.total === null
                                      ? `${c.represented} represented · Full roster not configured`
                                      : `${c.represented} / ${c.total} represented · ${c.missing?.length} missing`}
                                  </small>
                                </span>
                              </div>
                              <div className="coverage-value">
                                {c.percentage === null ? (
                                  <Badge>Not configured</Badge>
                                ) : (
                                  <>
                                    <b>{c.percentage.toFixed(1)}%</b>
                                    <div className="progress">
                                      <span
                                        style={{ width: c.percentage + "%" }}
                                      />
                                    </div>
                                  </>
                                )}
                              </div>
                            </button>
                          );
                        })}
                    </div>
                  ) : (
                    <Empty title="Your groups will appear here">
                      <p>
                        Import cards to discover represented idols.
                        <br />
                        Configure full rosters to see who’s missing.
                      </p>
                    </Empty>
                  )}
                </section>
                <section className="panel">
                  <div className="section-title pad">
                    <div>
                      <h2>Pack pipeline</h2>
                      <p>A little clarity on what’s next.</p>
                    </div>
                  </div>
                  <div className="pipeline">
                    {["planning", "draft", "ready", "released", "archived"].map(
                      (s, i) => (
                        <button key={s} onClick={() => go("Packs")}>
                          <span className={"pipeline-icon p" + i}>
                            {["◷", "▧", "✓", "↗", "▣"][i]}
                          </span>
                          <span>
                            {s[0].toUpperCase() + s.slice(1)}
                            <small>
                              {s === "released"
                                ? "Live in your game"
                                : s === "archived"
                                  ? "Kept for history"
                                  : "In preparation"}
                            </small>
                          </span>
                          <strong>
                            {data.packs.filter((p) => p.status === s).length}
                          </strong>
                        </button>
                      ),
                    )}
                  </div>
                  <div className="panel-foot">
                    Picture status is tracked separately from release status.
                  </div>
                </section>
              </div>
              <div className="notice">
                <strong>Roster configured ≠ fully represented.</strong>
                <p>
                  A configured roster tells us who belongs to a group. Card
                  appearances tell us who is represented. We only calculate
                  coverage when both are known.
                </p>
              </div>
            </>
          )}
          {page === "Cards" && <Cards data={data} {...cardActions} />}
          {page === "Groups" && !detail && (
            <section className="panel">
              <div className="table-toolbar">
                <input
                  className="search"
                  aria-label="Search groups"
                  placeholder="Find a group…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <select
                  aria-label="Roster filter"
                  value={groupFilter}
                  onChange={(e) => setGroupFilter(e.target.value)}
                >
                  <option value="">All roster states</option>
                  <option value="configured">Roster configured</option>
                  <option value="unconfigured">Roster not configured</option>
                  <option value="missing">Missing members</option>
                  <option value="full">Fully represented</option>
                </select>
                <button
                  onClick={() =>
                    download(coverageRows, "group-coverage", "Coverage")
                  }
                >
                  ↓ Export coverage
                </button>
              </div>
              <DataTable
                rows={data.groups.filter((g) => {
                  const c = coverage(g, data);
                  return (
                    g.name.toLowerCase().includes(query.toLowerCase()) &&
                    (!groupFilter ||
                      (groupFilter === "configured"
                        ? g.roster_configured
                        : groupFilter === "unconfigured"
                          ? !g.roster_configured
                          : groupFilter === "missing"
                            ? !!c.missing?.length
                            : c.percentage === 100))
                  );
                })}
                rowKey={(g) => g.id}
                columns={[
                  {
                    key: "name",
                    label: "Group",
                    sort: (g) => g.name,
                    render: (g) => (
                      <button
                        className="text-link"
                        onClick={() => go("Groups", g.id)}
                      >
                        {g.name} ↗
                      </button>
                    ),
                  },
                  {
                    key: "represented",
                    label: "Represented",
                    sort: (g) => coverage(g, data).represented,
                    render: (g) => coverage(g, data).represented,
                  },
                  {
                    key: "roster",
                    label: "Full roster",
                    render: (g) => coverage(g, data).total ?? "Not configured",
                  },
                  {
                    key: "missing",
                    label: "Missing",
                    render: (g) => coverage(g, data).missing?.length ?? "—",
                  },
                  {
                    key: "coverage",
                    label: "Coverage",
                    render: (g) => {
                      const c = coverage(g, data);
                      return c.percentage === null ? (
                        "—"
                      ) : (
                        <Badge tone={c.percentage === 100 ? "green" : "amber"}>
                          {c.percentage.toFixed(1)}%
                        </Badge>
                      );
                    },
                  },
                  {
                    key: "cards",
                    label: "Total cards",
                    render: (g) => data.cards.filter(card=>cardGroups(card,data).some(x=>x.id===g.id)).length,
                  },
                  {
                    key: "status",
                    label: "Roster status",
                    render: (g) => (
                      <Badge tone={g.roster_configured ? "green" : ""}>
                        {g.roster_configured ? "Configured" : "Not configured"}
                      </Badge>
                    ),
                  },
                  {
                    key: "actions",
                    label: "Actions",
                    render: (g) => recordActions("groups", g),
                  },
                ]}
              />
            </section>
          )}
          {page === "Groups" &&
            group &&
            (() => {
              const c = coverage(group, data);
              const members = groupRosterRows(group);
              return (
                <div className="stack">
                  <div className="detail-toolbar">
                    <Badge>{group.status}</Badge>
                    <button
                      className="primary"
                      onClick={() => setRoster(group)}
                    >
                      {group.roster_configured
                        ? "Edit full roster"
                        : "Configure full roster"}
                    </button>
                    {recordActions("groups", group)}
                    <button
                      onClick={() =>
                        download(
                          rosterExport(group),
                          group.name + "-roster",
                          "Roster",
                        )
                      }
                    >
                      ↓ Export roster
                    </button>
                    <button
                      onClick={() =>
                        download(
                          cardExport(
                            data.cards.filter((c) =>
                              cardGroups(c, data).some(
                                (g) => g.id === group.id,
                              ),
                            ),
                            data,
                          ),
                          group.name + "-cards",
                        )
                      }
                    >
                      ↓ Export cards
                    </button>
                  </div>
                  {!group.roster_configured && (
                    <div className="notice">
                      <strong>Full roster has not been configured yet.</strong>
                      <p>
                        These are known artists, not a complete roster. Coverage
                        and missing members are unavailable until you confirm
                        the full roster.
                      </p>
                    </div>
                  )}
                  <div className="stat-grid">
                    <Stat
                      label="Full roster"
                      value={c.total ?? "—"}
                      note={
                        group.roster_configured
                          ? "Current members"
                          : "Not configured"
                      }
                    />
                    <Stat
                      label="Represented"
                      value={c.represented}
                      note={`${c.cards} cards in scope · ${data.cards.filter(card=>cardGroups(card,data).some(x=>x.id===group.id)).length} total cards`}
                    />
                    <Stat
                      label="Missing"
                      value={c.missing?.length ?? "—"}
                      note="Current roster members"
                    />
                    <Stat
                      label="Coverage"
                      value={
                        c.percentage === null
                          ? "—"
                          : c.percentage.toFixed(1) + "%"
                      }
                      note={
                        c.percentage === 100
                          ? "All members represented"
                          : "Based on representation scope"
                      }
                    />
                  </div>
                  <section className="panel">
                    <div className="table-toolbar">
                      <h2>Members</h2>
                      {group.roster_configured && (
                        <>
                          <label className="check">
                            <input
                              type="checkbox"
                              checked={missingOnly}
                              onChange={(e) => setMissingOnly(e.target.checked)}
                            />
                            Show missing members only
                          </label>
                          <button
                            onClick={() =>
                              download(
                                rosterExport(group).filter(
                                  (r) =>
                                    r["Representation status"] === "Missing",
                                ),
                                group.name + "-missing",
                                "Missing members",
                              )
                            }
                          >
                            ↓ Export missing
                          </button>
                        </>
                      )}
                    </div>
                    {missingOnly &&
                    !members.some((m) => m.status === "Missing") ? (
                      <Empty title="All members are currently represented." />
                    ) : (
                      <DataTable
                        rows={members.filter(
                          (m) => !missingOnly || m.status === "Missing",
                        )}
                        rowKey={(r) => r.id}
                        columns={[
                          {
                            key: "member",
                            label: "Member",
                            sort: (r) => r.idol.stage_name,
                            render: (r) => (
                              <button
                                className="text-link"
                                onClick={() => go("Idols", r.idol.id)}
                              >
                                {r.idol.stage_name}
                              </button>
                            ),
                          },
                          {
                            key: "cards",
                            label: "Cards",
                            sort: (r) => r.cards.length,
                            render: (r) => r.cards.length,
                          },
                          {
                            key: "packs",
                            label: "Packs",
                            render: (r) => r.packs.join(", ") || "—",
                          },
                          {
                            key: "status",
                            label: "Status",
                            render: (r) => (
                              <Badge
                                tone={
                                  r.status === "Missing"
                                    ? "amber"
                                    : r.status === "Represented"
                                      ? "green"
                                      : ""
                                }
                              >
                                {r.status}
                              </Badge>
                            ),
                          },
                        ]}
                      />
                    )}
                  </section>
                </div>
              );
            })()}
          {page === "Packs" && !detail && (
            <section className="panel">
              <div className="table-toolbar">
                <input
                  className="search"
                  aria-label="Search packs"
                  placeholder="Find a pack…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <DataTable
                rows={data.packs.filter((p) =>
                  p.name.toLowerCase().includes(query.toLowerCase()),
                )}
                rowKey={(p) => p.id}
                columns={[
                  {
                    key: "name",
                    label: "Pack",
                    sort: (p) => p.name,
                    render: (p) => (
                      <button
                        className="text-link"
                        onClick={() => go("Packs", p.id)}
                      >
                        {p.name} ↗
                      </button>
                    ),
                  },
                  {
                    key: "type",
                    label: "Type",
                    sort: (p) => p.pack_type,
                    render: (p) => <Badge tone="violet">{p.pack_type}</Badge>,
                  },
                  {
                    key: "status",
                    label: "Status",
                    sort: (p) => p.status,
                    render: (p) => (
                      <Badge tone={p.status === "released" ? "green" : "amber"}>
                        {p.status}
                      </Badge>
                    ),
                  },
                  {
                    key: "cards",
                    label: "Cards",
                    render: (p) =>
                      data.cards.filter((c) => c.pack_id === p.id).length,
                  },
                  {
                    key: "release",
                    label: "Release date",
                    sort: (p) => p.release_date || "",
                    render: (p) => p.release_date || "Not set",
                  },
                  {
                    key: "notes",
                    label: "Notes",
                    render: (p) => p.notes || "—",
                  },
                  {
                    key: "actions",
                    label: "Actions",
                    render: (p) => recordActions("packs", p),
                  },
                ]}
              />
            </section>
          )}
          {page === "Packs" &&
            pack &&
            (() => {
              const cards = data.cards.filter((c) => c.pack_id === pack.id);
              const males = cards.filter((c) =>
                  cardIdols(c, data).some((i) => i.gender === "male"),
                ).length,
                females = cards.filter((c) =>
                  cardIdols(c, data).some((i) => i.gender === "female"),
                ).length;
              return (
                <div className="stack">
                  <div className="detail-toolbar">
                    <Badge tone="violet">{pack.pack_type}</Badge>
                    <Badge
                      tone={pack.status === "released" ? "green" : "amber"}
                    >
                      {pack.status}
                    </Badge>
                    <span>{pack.release_date || "Release date not set"}</span>
                    {recordActions("packs", pack)}
                    <button
                      onClick={() =>
                        download(cardExport(cards, data), pack.name)
                      }
                    >
                      ↓ Export pack
                    </button>
                  </div>
                  {pack.notes && <p>{pack.notes}</p>}
                  <div className="stat-grid">
                    <Stat
                      label="Total cards"
                      value={cards.length}
                      note="No fixed pack size"
                    />
                    <Stat
                      label="Gender representation"
                      value={`${males} / ${females}`}
                      note="Male / female cards; mixed cards count in both"
                    />
                    <Stat
                      label="Unique idols"
                      value={
                        new Set(
                          cards.flatMap((c) =>
                            cardIdols(c, data).map((i) => i.id),
                          ),
                        ).size
                      }
                    />
                    <Stat
                      label="Unique groups"
                      value={
                        new Set(
                          cards.flatMap((c) =>
                            cardGroups(c, data).map((g) => g.id),
                          ),
                        ).size
                      }
                    />
                  </div>
                  <section className="panel pad">
                    <h3>Rarity distribution</h3>
                    <div className="rarity-bars">
                      {[...data.rarities]
                        .sort((a, b) => a.sort_order - b.sort_order)
                        .map((r) => {
                          const n = cards.filter(
                            (c) => c.rarity_id === r.id,
                          ).length;
                          return (
                            <div key={r.id}>
                              <Badge tone="violet">{r.label}</Badge>
                              <div className="progress">
                                <span
                                  style={{
                                    width:
                                      (cards.length
                                        ? (n / cards.length) * 100
                                        : 0) + "%",
                                  }}
                                />
                              </div>
                              <b>{n}</b>
                            </div>
                          );
                        })}
                    </div>
                  </section>
                  <Cards data={data} scope={cards} {...cardActions} />
                </div>
              );
            })()}
          {page === "Idols" && !detail && (
            <section className="panel">
              <div className="table-toolbar">
                <input
                  className="search"
                  aria-label="Search idols"
                  placeholder="Find an idol or group…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <DataTable
                rows={data.idols.filter((i) =>
                  (
                    i.stage_name +
                    " " +
                    data.groups
                      .filter((g) =>
                        data.group_memberships.some(
                          (m) => m.idol_id === i.id && m.group_id === g.id,
                        ),
                      )
                      .map((g) => g.name)
                      .join(" ")
                  )
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )}
                rowKey={(i) => i.id}
                columns={[
                  {
                    key: "name",
                    label: "Idol",
                    sort: (i) => i.stage_name,
                    render: (i) => (
                      <button
                        className="text-link"
                        onClick={() => go("Idols", i.id)}
                      >
                        {i.stage_name} ↗
                      </button>
                    ),
                  },
                  {
                    key: "group",
                    label: "Associated groups",
                    render: (i) =>
                      data.group_memberships
                        .filter((m) => m.idol_id === i.id)
                        .map(
                          (m) =>
                            `${data.groups.find((g) => g.id === m.group_id)?.name} (${m.membership_status})`,
                        )
                        .join(", ") || "Soloist / no group",
                  },
                  { key: "gender", label: "Gender", render: (i) => i.gender },
                  {
                    key: "cards",
                    label: "Total cards",
                    sort: (i) =>
                      data.card_idols.filter((c) => c.idol_id === i.id).length,
                    render: (i) =>
                      data.card_idols.filter((c) => c.idol_id === i.id).length,
                  },
                  {
                    key: "status",
                    label: "Representation",
                    render: (i) => (
                      <Badge tone={represented.has(i.id) ? "green" : "amber"}>
                        {represented.has(i.id)
                          ? "Represented"
                          : data.card_idols.some((c) => c.idol_id === i.id)
                            ? "No live cards"
                            : "Registered · no cards"}
                      </Badge>
                    ),
                  },
                  {
                    key: "active",
                    label: "Artist status",
                    render: (i) => (i.active ? "Active" : "Inactive"),
                  },
                  {
                    key: "actions",
                    label: "Actions",
                    render: (i) => recordActions("idols", i),
                  },
                ]}
              />
            </section>
          )}
          {page === "Idols" &&
            idol &&
            (() => {
              const cs = data.cards.filter((c) =>
                cardIdols(c, data).some((i) => i.id === idol.id),
              );
              const ps = data.packs
                .filter((p) => cs.some((c) => c.pack_id === p.id))
                .sort((a, b) =>
                  (b.release_date || "").localeCompare(a.release_date || ""),
                );
              return (
                <div className="stack">
                  <div className="detail-toolbar">
                    <Badge tone={represented.has(idol.id) ? "green" : "amber"}>
                      {represented.has(idol.id)
                        ? "Represented"
                        : cs.length
                          ? "No live cards"
                          : "Registered · no cards"}
                    </Badge>
                    <Badge>{idol.gender}</Badge>
                    <Badge>{idol.active ? "Active" : "Inactive"}</Badge>
                    {recordActions("idols", idol)}
                  </div>
                  <p>
                    {data.group_memberships
                      .filter((m) => m.idol_id === idol.id)
                      .map(
                        (m) =>
                          `${data.groups.find((g) => g.id === m.group_id)?.name} · ${m.membership_status}`,
                      )
                      .join(" / ") || "Soloist / no group membership"}
                  </p>
                  <div className="stat-grid">
                    <Stat label="Total cards" value={cs.length} />
                    <Stat label="Packs" value={ps.length} />
                    <Stat
                      label="Rarities"
                      value={new Set(cs.map((c) => c.rarity_id)).size}
                    />
                    <Stat
                      label="Live appearances"
                      value={
                        live.filter((c) =>
                          cardIdols(c, data).some((i) => i.id === idol.id),
                        ).length
                      }
                    />
                  </div>
                  <div className="dashboard-grid">
                    <section className="panel pad">
                      <h3>Pack history</h3>
                      {ps.length ? (
                        ps.map((p) => (
                          <button
                            key={p.id}
                            className="history-row"
                            onClick={() => go("Packs", p.id)}
                          >
                            <b>{p.name}</b>
                            <span>
                              {p.release_date || "Date not set"} · {p.status}
                            </span>
                          </button>
                        ))
                      ) : (
                        <p>No pack appearances yet.</p>
                      )}
                    </section>
                    <section className="panel pad">
                      <h3>Rarity history</h3>
                      {data.rarities
                        .filter((r) => cs.some((c) => c.rarity_id === r.id))
                        .map((r) => (
                          <div className="history-row" key={r.id}>
                            <Badge tone="violet">{r.label}</Badge>
                            <span>
                              {cs.filter((c) => c.rarity_id === r.id).length}{" "}
                              cards ·{" "}
                              {[
                                ...new Set(
                                  cs
                                    .filter((c) => c.rarity_id === r.id)
                                    .map(
                                      (c) =>
                                        data.packs.find(
                                          (p) => p.id === c.pack_id,
                                        )?.name,
                                    ),
                                ),
                              ].join(", ")}
                            </span>
                          </div>
                        ))}
                      {!cs.length && <p>No rarity history yet.</p>}
                    </section>
                  </div>
                  <MembershipEditor idolId={idol.id} data={data} done={done} />
                  <Cards data={data} scope={cs} {...cardActions} />
                </div>
              );
            })()}
          {page === "Import" && <Importer data={data} done={done} />}
          {page === "Export" && (
            <div className="export-grid">
              {[
                {
                  title: "Complete masterlist",
                  text: "All cards, with packs, idols, groups, rarity, picture status, sources, and notes.",
                  action: () =>
                    download(cardExport(data.cards, data), "masterlist"),
                },
                {
                  title: "Filtered cards",
                  text: "Use the Cards page to select exactly the records you want to export.",
                  action: () => go("Cards"),
                },
                {
                  title: "Group coverage",
                  text: "Representation and missing counts. Unconfigured rosters keep coverage blank.",
                  action: () =>
                    download(coverageRows, "group-coverage", "Coverage"),
                },
                {
                  title: "Complete group rosters",
                  text: "Registered members, membership status, card counts, and pack history.",
                  action: () =>
                    download(
                      data.groups.flatMap((g) => rosterExport(g)),
                      "group-rosters",
                      "Rosters",
                    ),
                },
                {
                  title: "Missing members",
                  text: "Unrepresented current members from configured rosters only.",
                  action: () =>
                    download(
                      data.groups
                        .filter((g) => g.roster_configured)
                        .flatMap((g) =>
                          rosterExport(g).filter(
                            (r) => r["Representation status"] === "Missing",
                          ),
                        ),
                      "missing-members",
                      "Missing members",
                    ),
                },
                {
                  title: "A specific pack or group",
                  text: "Open a pack or group to export its cards, roster, or missing members.",
                  action: () => go("Packs"),
                },
              ].map((item, i) => (
                <section className="panel pad export-card" key={item.title}>
                  <span className="export-number">0{i + 1}</span>
                  <h2>{item.title}</h2>
                  <p>{item.text}</p>
                  <button onClick={item.action}>
                    {i === 1 || i === 5
                      ? "Open catalog ↗"
                      : "↓ Download Excel"}
                  </button>
                </section>
              ))}
            </div>
          )}
          {page === "Settings" && (
            <div className="stack">
              <section className="panel pad">
                <h2>Representation scope</h2>
                <p>
                  Released packs count toward coverage by default. Enable this
                  to include all statuses, including archived packs.
                </p>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={data.settings.include_unreleased}
                    disabled={role !== "admin"}
                    onChange={async (e) => {
                      try {
                        await mutate({
                          action: "save",
                          table: "settings",
                          id: true,
                          values: { include_unreleased: e.target.checked },
                        });
                        done();
                      } catch (e) {
                        setNotice(
                          e instanceof Error ? e.message : "Unable to update",
                        );
                      }
                    }}
                  />
                  Include unreleased and archived packs
                </label>
                {role !== "admin" && (
                  <small>
                    Only admins can change workspace settings and rarities.
                  </small>
                )}
              </section>
              <section className="panel">
                <div className="section-title pad">
                  <div>
                    <h2>Rarities</h2>
                    <p>
                      Configurable percentages shared by cards and workbook
                      imports.
                    </p>
                  </div>
                  {role === "admin" && (
                    <button onClick={() => setEdit({ table: "rarities" })}>
                      ＋ Add rarity
                    </button>
                  )}
                </div>
                <DataTable
                  rows={data.rarities}
                  rowKey={(r) => r.id}
                  columns={[
                    {
                      key: "label",
                      label: "Label",
                      render: (r) => <Badge tone="violet">{r.label}</Badge>,
                    },
                    {
                      key: "number",
                      label: "Percentage",
                      sort: (r) => Number(r.numeric_value),
                      render: (r) => r.numeric_value,
                    },
                    {
                      key: "order",
                      label: "Sort order",
                      sort: (r) => r.sort_order,
                      render: (r) => r.sort_order,
                    },
                    {
                      key: "active",
                      label: "Active",
                      render: (r) => (r.active ? "Yes" : "No"),
                    },
                    {
                      key: "edit",
                      label: "Actions",
                      render: (r) =>
                        role === "admin"
                          ? recordActions("rarities", { ...r, name: r.label })
                          : "Admin only",
                    },
                  ]}
                />
              </section>
              <section className="panel pad">
                <h2>Team access</h2>
                <p>
                  Accounts are invite-only. Create a user in Supabase
                  Authentication, then assign their user ID a moderator or admin
                  profile. No service-role credentials are stored in this
                  application.
                </p>
                <p>
                  Your role: <Badge tone="violet">{role}</Badge>
                </p>
                {role === "admin" && <TeamAccess done={done} />}
              </section>
            </div>
          )}
        </main>
        <footer className="app-footer">
          <span>BIAS VAULT</span>
          <span>Your catalog. Your source of truth.</span>
        </footer>
      </div>
      {edit && (
        <RecordEditor
          table={edit.table}
          record={edit.record}
          close={() => setEdit(null)}
          done={done}
        />
      )}
      {cardEdit && (
        <CardEditor
          data={data}
          card={cardEdit.card}
          close={() => setCardEdit(null)}
          done={done}
        />
      )}
      {deletion && (
        <DeleteDialog
          {...deletion}
          close={() => setDeletion(null)}
          done={done}
        />
      )}
      {roster && (
        <Modal title="Full roster configuration" close={() => setRoster(null)}>
          <Importer data={data} groupName={roster.name} done={done} />
        </Modal>
      )}
    </div>
  );
}
function Stat({
  label,
  value,
  note,
  icon,
}: {
  label: string;
  value: number | string;
  note?: string;
  icon?: string;
}) {
  return (
    <div className="stat">
      <div>
        <span>{label}</span>
        {icon && <span className="stat-icon">{icon}</span>}
      </div>
      <strong>
        {typeof value === "number" ? value.toLocaleString() : value}
      </strong>
      {note && <small>{note}</small>}
    </div>
  );
}
function TeamAccess({ done }: { done: () => void }) {
  const [id, setId] = useState("");
  const [role, setRole] = useState("moderator");
  const [error, setError] = useState("");
  return (
    <form
      className="toolbar"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await mutate({ action: "profile", id, role });
          done();
          setId("");
          setError("");
        } catch (e) {
          setError(e instanceof Error ? e.message : "Unable to update");
        }
      }}
    >
      <label>
        Supabase user ID
        <input
          required
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder="User UUID"
          pattern="[0-9a-fA-F-]{36}"
        />
      </label>
      <label>
        Role
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option>moderator</option>
          <option>admin</option>
        </select>
      </label>
      <button className="primary">Assign role</button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
