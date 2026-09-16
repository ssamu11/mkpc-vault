"use client";
import { useState } from "react";
import type { Catalog, Card } from "@/lib/types";
import { cardIdols, cardGroups, cardExport } from "@/lib/catalog";
import { Badge, DataTable, Select, download } from "./ui";
export default function Cards({
  data,
  scope,
  edit,
  remove,
}: {
  data: Catalog;
  scope?: Card[];
  edit: (c?: Card) => void;
  remove: (c: Card) => void;
}) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [show, setShow] = useState(false);
  const all = scope || data.cards;
  const rows = all.filter((c) => {
    const pack = data.packs.find((p) => p.id === c.pack_id);
    const idols = cardIdols(c, data),
      groups = cardGroups(c, data);
    const match = [
      pack?.name,
      c.card_name,
      ...idols.map((i) => i.stage_name),
      ...groups.map((g) => g.name),
    ]
      .join(" ")
      .toLowerCase()
      .includes(query.toLowerCase());
    if (!match) return false;
    return Object.entries(filters).every(
      ([key, value]) =>
        !value ||
        (key === "idol"
          ? idols.some((i) => i.id === value)
          : key === "group"
            ? groups.some((g) => g.id === value)
            : key === "gender"
              ? idols.some((i) => i.gender === value)
              : key === "pack_type"
                ? pack?.pack_type === value
                : key === "pack_status"
                  ? pack?.status === value
                  : key === "pack"
                    ? c.pack_id === value
                    : key === "rarity"
                      ? c.rarity_id === value
                      : c.pic_status === value),
    );
  });
  const opts = (items: { id: string; name: string }[]) =>
    items.map((i) => ({ value: i.id, label: i.name }));
  const unique = (s: string[]) =>
    [...new Set(s)]
      .filter(Boolean)
      .sort()
      .map((x) => ({ value: x, label: x }));
  const defs = [
    {
      key: "idol",
      label: "Idols",
      options: opts(data.idols.map((i) => ({ id: i.id, name: i.stage_name }))),
    },
    { key: "group", label: "Groups", options: opts(data.groups) },
    { key: "pack", label: "Packs", options: opts(data.packs) },
    {
      key: "pack_type",
      label: "Pack types",
      options: unique(data.packs.map((p) => p.pack_type)),
    },
    {
      key: "rarity",
      label: "Rarities",
      options: data.rarities.map((r) => ({ value: r.id, label: r.label })),
    },
    {
      key: "gender",
      label: "Genders",
      options: unique(["female", "male", "other", "unknown"]),
    },
    {
      key: "pic_status",
      label: "Picture statuses",
      options: unique(data.cards.map((c) => c.pic_status || "")),
    },
    {
      key: "pack_status",
      label: "Pack statuses",
      options: unique(["planning", "draft", "ready", "released", "archived"]),
    },
  ];
  return (
    <section className="panel">
      <div className="table-toolbar">
        <input
          className="search"
          aria-label="Search cards"
          placeholder="Search idols, groups, or packs…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button onClick={() => setShow(!show)}>
          ☷ Filters {Object.values(filters).filter(Boolean).length || ""}
        </button>
        <button
          onClick={() => download(cardExport(rows, data), "filtered-cards")}
        >
          ↓ Export {rows.length}
        </button>
        <button className="primary" onClick={() => edit()}>
          ＋ Add card
        </button>
      </div>
      {show && (
        <div className="filters">
          {defs.map((f) => (
            <Select
              key={f.key}
              label={f.label}
              value={filters[f.key] || ""}
              options={f.options}
              onChange={(v) => setFilters({ ...filters, [f.key]: v })}
            />
          ))}
          <button
            onClick={() => {
              setFilters({});
              setQuery("");
            }}
          >
            Clear filters
          </button>
        </div>
      )}
      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        columns={[
          {
            key: "idol",
            label: "Idol / idols",
            sort: (c) =>
              cardIdols(c, data)
                .map((i) => i.stage_name)
                .join(" "),
            render: (c) => (
              <div className="identity">
                <span className="avatar">
                  {(
                    cardIdols(c, data)[0]?.stage_name ||
                    c.card_name ||
                    "G"
                  ).slice(0, 2)}
                </span>
                <span>
                  <b>
                    {cardIdols(c, data)
                      .map((i) => i.stage_name)
                      .join(" × ") ||
                      c.card_name ||
                      "Group card"}
                  </b>
                  <small>
                    {cardGroups(c, data)
                      .map((g) => g.name)
                      .join(" / ") || "Soloist"}
                  </small>
                </span>
              </div>
            ),
          },
          {
            key: "pack",
            label: "Pack",
            sort: (c) => data.packs.find((p) => p.id === c.pack_id)?.name || "",
            render: (c) => (
              <>
                {data.packs.find((p) => p.id === c.pack_id)?.name}
                <small>
                  {data.packs.find((p) => p.id === c.pack_id)?.pack_type} ·{" "}
                  {data.packs.find((p) => p.id === c.pack_id)?.status}
                </small>
              </>
            ),
          },
          {
            key: "slot",
            label: "Slot",
            sort: (c) => c.slot || "",
            render: (c) => c.slot || "—",
          },
          {
            key: "gender",
            label: "Gender",
            render: (c) =>
              [...new Set(cardIdols(c, data).map((i) => i.gender))].join(
                " / ",
              ) || "—",
          },
          {
            key: "rarity",
            label: "Rarity",
            sort: (c) =>
              Number(
                data.rarities.find((r) => r.id === c.rarity_id)
                  ?.numeric_value || 0,
              ),
            render: (c) => (
              <Badge tone="violet">
                {data.rarities.find((r) => r.id === c.rarity_id)?.label}
              </Badge>
            ),
          },
          {
            key: "pic",
            label: "Pic status",
            sort: (c) => c.pic_status || "",
            render: (c) => (
              <Badge
                tone={
                  c.pic_status?.toLowerCase() === "selected" ? "green" : "amber"
                }
              >
                {c.pic_status || "Not set"}
              </Badge>
            ),
          },
          {
            key: "source",
            label: "Source / notes",
            render: (c) => (
              <>
                {c.source_url && /^https?:\/\//i.test(c.source_url) ? (
                  <a href={c.source_url} target="_blank" rel="noreferrer">
                    Source ↗
                  </a>
                ) : (
                  "—"
                )}
                {c.notes && (
                  <small className="notes" title={c.notes}>
                    {c.notes}
                  </small>
                )}
              </>
            ),
          },
          {
            key: "actions",
            label: "Actions",
            render: (c) => (
              <div className="row-actions">
                <button onClick={() => edit(c)}>Edit</button>
                <button className="text-danger" onClick={() => remove(c)}>
                  Delete
                </button>
              </div>
            ),
          },
        ]}
      />
    </section>
  );
}
