import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const workspaceFile = path.join(
  root,
  "components",
  "workspace.tsx",
);

const plannerFile = path.join(
  root,
  "components",
  "pack-planner.tsx",
);

const cssFile = [
  path.join(root, "app", "globals.css"),
  path.join(root, "styles", "globals.css"),
].find(fs.existsSync);

if (!fs.existsSync(workspaceFile)) {
  throw new Error("components/workspace.tsx not found");
}

const backup =
  workspaceFile + ".before-pack-planner";

if (!fs.existsSync(backup)) {
  fs.copyFileSync(
    workspaceFile,
    backup,
  );
}

/* ======================================================
   PACK PLANNER COMPONENT
====================================================== */

const component = String.raw`"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  createBrowserClient,
} from "@supabase/ssr";

import type {
  Catalog,
} from "@/lib/types";

type Tier =
  | "S"
  | "A"
  | "B"
  | "C"
  | "D";

type Status =
  | "normal"
  | "cooldown"
  | "exclude";

type Candidate = {
  identity_key: string;
  display_name: string;
  aliases: string;
  gender: string;
  groups: string | null;

  popularity_tier: Tier;
  generation: number | null;
  planner_status: Status;

  total_appearances: number;

  last_pack_name: string | null;
  last_pack_number: number | null;
  last_rarity_label: string | null;

  used_rarities: string;

  score: number;
  eligible: boolean;
  same_as_last: boolean;

  reason: string;
};

const tiers: Tier[] = [
  "S",
  "A",
  "B",
  "C",
  "D",
];

const statuses: Status[] = [
  "normal",
  "cooldown",
  "exclude",
];

function rating(
  row: Candidate,
) {
  if (
    row.same_as_last
  ) {
    return "Avoid repeat";
  }

  if (
    !row.eligible
  ) {
    return "Outside rule";
  }

  if (
    row.score >= 70
  ) {
    return "Strong";
  }

  if (
    row.score >= 42
  ) {
    return "Good";
  }

  return "Review";
}

export default function PackPlanner({
  data,
}: {
  data: Catalog;
}) {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env
          .NEXT_PUBLIC_SUPABASE_URL!,
        process.env
          .NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      ),
    [],
  );

  const rarities = useMemo(
    () =>
      [...data.rarities]
        .filter(
          (r) => r.active,
        )
        .sort(
          (a, b) =>
            Number(
              a.numeric_value,
            ) -
            Number(
              b.numeric_value,
            ),
        ),
    [data.rarities],
  );

  const nextPack =
    Math.max(
      0,
      ...data.packs.map(
        (p) =>
          Number(
            p.pack_number || 0,
          ),
      ),
    ) + 1;

  const [
    packNumber,
    setPackNumber,
  ] = useState(
    nextPack,
  );

  const [
    rarityId,
    setRarityId,
  ] = useState(
    rarities[0]?.id || "",
  );

  const [
    gender,
    setGender,
  ] = useState("");

  const [
    query,
    setQuery,
  ] = useState("");

  const [
    showAvoided,
    setShowAvoided,
  ] = useState(false);

  const [
    rows,
    setRows,
  ] = useState<
    Candidate[]
  >([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    saving,
    setSaving,
  ] = useState("");

  async function load() {
    if (
      !rarityId
    ) {
      return;
    }

    setLoading(true);
    setError("");

    const {
      data: result,
      error,
    } =
      await supabase.rpc(
        "pack_planner_candidates",
        {
          p_target_rarity_id:
            rarityId,

          p_target_pack_number:
            packNumber,

          p_show_avoided:
            showAvoided,
        },
      );

    if (
      error
    ) {
      setError(
        error.message,
      );

      setRows([]);
    } else {
      setRows(
        (result ||
          []) as Candidate[],
      );
    }

    setLoading(false);
  }

  useEffect(
    () => {
      load();
    },
    [
      rarityId,
      packNumber,
      showAvoided,
    ],
  );

  async function update(
    row: Candidate,
    patch: Partial<{
      tier: Tier;
      generation:
        number | null;
      status: Status;
    }>,
  ) {
    setSaving(
      row.identity_key,
    );

    setError("");

    const {
      error,
    } =
      await supabase.rpc(
        "set_pack_planner_profile",
        {
          p_identity_key:
            row.identity_key,

          p_popularity_tier:
            patch.tier ??
            row.popularity_tier,

          p_generation:
            patch.generation !==
            undefined
              ? patch.generation
              : row.generation,

          p_planner_status:
            patch.status ??
            row.planner_status,
        },
      );

    if (
      error
    ) {
      setError(
        error.message,
      );
    } else {
      await load();
    }

    setSaving("");
  }

  const filtered =
    rows.filter(
      (row) => {
        if (
          gender &&
          row.gender !==
            gender
        ) {
          return false;
        }

        const text = [
          row.display_name,
          row.aliases,
          row.groups || "",
        ]
          .join(" ")
          .toLowerCase();

        return text.includes(
          query
            .trim()
            .toLowerCase(),
        );
      },
    );

  const rarity =
    rarities.find(
      (r) =>
        r.id ===
        rarityId,
    );

  const rarityValue =
    Number(
      rarity?.numeric_value ||
        0,
    );

  return (
    <div className="planner-stack">
      <section className="panel pad planner-controls">
        <label>
          <span>
            Target pack
          </span>

          <div className="planner-pack">
            <small>
              Rebirth
            </small>

            <input
              type="number"
              min={1}
              value={
                packNumber
              }
              onChange={(
                e,
              ) =>
                setPackNumber(
                  Math.max(
                    1,
                    Number(
                      e.target
                        .value ||
                        1,
                    ),
                  ),
                )
              }
            />
          </div>
        </label>

        <label>
          <span>
            Target rarity
          </span>

          <select
            value={
              rarityId
            }
            onChange={(
              e,
            ) =>
              setRarityId(
                e.target
                  .value,
              )
            }
          >
            {rarities.map(
              (r) => (
                <option
                  key={
                    r.id
                  }
                  value={
                    r.id
                  }
                >
                  {
                    r.label
                  }
                </option>
              ),
            )}
          </select>
        </label>

        <label>
          <span>
            Gender
          </span>

          <select
            value={
              gender
            }
            onChange={(
              e,
            ) =>
              setGender(
                e.target
                  .value,
              )
            }
          >
            <option value="">
              All
            </option>

            <option value="female">
              Female
            </option>

            <option value="male">
              Male
            </option>
          </select>
        </label>

        <label className="planner-search">
          <span>
            Search
          </span>

          <input
            value={
              query
            }
            onChange={(
              e,
            ) =>
              setQuery(
                e.target
                  .value,
              )
            }
            placeholder="Idol or group"
          />
        </label>

        <label className="planner-check">
          <input
            type="checkbox"
            checked={
              showAvoided
            }
            onChange={(
              e,
            ) =>
              setShowAvoided(
                e.target
                  .checked,
              )
            }
          />

          Show avoided
        </label>
      </section>

      <div className="planner-rule">
        {rarityValue <=
        0.05
          ? "0.05% · S/A · Gen 3–5 · no immediate same-rarity repeat"
          : rarityValue <=
              0.23
            ? "0.23% · S/A/B · Gen 3–5 · no immediate same-rarity repeat"
            : "Returning idols are rotated across rarities. Popular idols can also appear at lower rarity."}
      </div>

      {error && (
        <div className="notice">
          {error}
        </div>
      )}

      <div className="planner-head">
        <div>
          <h2>
            Suggestions
          </h2>

          <p>
            {
              filtered.length
            }{" "}
            candidates
          </p>
        </div>
      </div>

      {loading ? (
        <section className="panel pad">
          Loading…
        </section>
      ) : (
        <div className="planner-list">
          {filtered.map(
            (row) => {
              const label =
                rating(
                  row,
                );

              return (
                <article
                  className={
                    "planner-row " +
                    (row.same_as_last ||
                    !row.eligible
                      ? "avoid"
                      : "")
                  }
                  key={
                    row.identity_key
                  }
                >
                  <div className="planner-info">
                    <div className="planner-name">
                      <strong>
                        {
                          row.display_name
                        }
                      </strong>

                      <span>
                        {row.groups ||
                          "Solo / unassigned"}
                      </span>
                    </div>

                    <div className="planner-tags">
                      <span
                        className={
                          "quality " +
                          label
                            .toLowerCase()
                            .replaceAll(
                              " ",
                              "-",
                            )
                        }
                      >
                        {
                          label
                        }
                      </span>

                      <span>
                        {
                          row.gender
                        }
                      </span>

                      <span>
                        appearances ·{" "}
                        {
                          row.total_appearances
                        }
                      </span>

                      {row.used_rarities && (
                        <span>
                          used ·{" "}
                          {
                            row.used_rarities
                          }
                        </span>
                      )}
                    </div>

                    <p className="planner-reason">
                      {
                        row.reason
                      }
                    </p>
                  </div>

                  <div className="planner-profile">
                    <label>
                      <span>
                        Tier
                      </span>

                      <select
                        value={
                          row.popularity_tier
                        }
                        disabled={
                          saving ===
                          row.identity_key
                        }
                        onChange={(
                          e,
                        ) =>
                          update(
                            row,
                            {
                              tier: e
                                .target
                                .value as Tier,
                            },
                          )
                        }
                      >
                        {tiers.map(
                          (tier) => (
                            <option
                              key={
                                tier
                              }
                            >
                              {
                                tier
                              }
                            </option>
                          ),
                        )}
                      </select>
                    </label>

                    <label>
                      <span>
                        Gen
                      </span>

                      <select
                        value={
                          row.generation ??
                          ""
                        }
                        disabled={
                          saving ===
                          row.identity_key
                        }
                        onChange={(
                          e,
                        ) =>
                          update(
                            row,
                            {
                              generation:
                                e
                                  .target
                                  .value
                                  ? Number(
                                      e
                                        .target
                                        .value,
                                    )
                                  : null,
                            },
                          )
                        }
                      >
                        <option value="">
                          —
                        </option>

                        {[1,2,3,4,5].map(
                          (gen) => (
                            <option
                              key={
                                gen
                              }
                              value={
                                gen
                              }
                            >
                              {
                                gen
                              }
                            </option>
                          ),
                        )}
                      </select>
                    </label>

                    <label>
                      <span>
                        Status
                      </span>

                      <select
                        value={
                          row.planner_status
                        }
                        disabled={
                          saving ===
                          row.identity_key
                        }
                        onChange={(
                          e,
                        ) =>
                          update(
                            row,
                            {
                              status: e
                                .target
                                .value as Status,
                            },
                          )
                        }
                      >
                        {statuses.map(
                          (
                            status,
                          ) => (
                            <option
                              key={
                                status
                              }
                            >
                              {
                                status
                              }
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                  </div>
                </article>
              );
            },
          )}

          {!filtered.length &&
            !loading && (
              <section className="panel pad">
                No candidates match the current rules.
              </section>
            )}
        </div>
      )}
    </div>
  );
}
`;

fs.writeFileSync(
  plannerFile,
  component,
  "utf8",
);

/* ======================================================
   PATCH WORKSPACE
====================================================== */

let src =
  fs.readFileSync(
    workspaceFile,
    "utf8",
  );

if (
  !src.includes(
    'import PackPlanner from "./pack-planner";',
  )
) {
  if (
    src.includes(
      'import Cards from "./cards";',
    )
  ) {
    src =
      src.replace(
        'import Cards from "./cards";',
        'import Cards from "./cards";\nimport PackPlanner from "./pack-planner";',
      );
  } else {
    throw new Error(
      "Cards import not found.",
    );
  }
}

if (
  !src.includes(
    '["Pack Planner"',
  )
) {
  src =
    src.replace(
      /(\s*)\["Import",\s*"[^"]*"\],/,
      (
        match,
        indent,
      ) =>
        `${indent}["Pack Planner", ""],${match}`,
    );
}

/*
 * Keep separator before Import,
 * regardless of how many pages exist.
 */
src =
  src.replace(
    /index === \d+ \? "nav-break" : ""/g,
    'name === "Import" ? "nav-break" : ""',
  );

/*
 * Clean UI version.
 */
if (
  src.includes(
    "const pageSubtitle",
  ) &&
  !src.includes(
    '"Rarity rotation & candidate planning"',
  )
) {
  src =
    src.replace(
      /: page === "Import"\s*\?\s*"Import catalog data"/,
      `: page === "Pack Planner"
                ? "Rarity rotation & candidate planning"
                : page === "Import"
                  ? "Import catalog data"`,
    );
}

/*
 * Original headline fallback.
 */
if (
  !src.includes(
    "const pageSubtitle",
  )
) {
  src =
    src.replace(
      /: page === "Import"\s*\?\s*"[^"]*"/,
      `: page === "Pack Planner"
        ? "Pack Planner"
        : page === "Import"
          ? "Import"`,
    );
}

if (
  !src.includes(
    'page === "Pack Planner" && <PackPlanner',
  )
) {
  const anchor =
    '{page === "Import" && <Importer data={data} done={done} />}';

  if (
    !src.includes(
      anchor,
    )
  ) {
    throw new Error(
      "Import render anchor not found.",
    );
  }

  src =
    src.replace(
      anchor,
      `{page === "Pack Planner" && <PackPlanner data={data} />}
          ${anchor}`,
    );
}

fs.writeFileSync(
  workspaceFile,
  src,
  "utf8",
);

/* ======================================================
   CSS
====================================================== */

if (
  cssFile
) {
  let css =
    fs.readFileSync(
      cssFile,
      "utf8",
    );

  const start =
    "/* MKPC PACK PLANNER START */";

  const end =
    "/* MKPC PACK PLANNER END */";

  const old =
    new RegExp(
      `/\\* MKPC PACK PLANNER START \\*/[\\s\\S]*?/\\* MKPC PACK PLANNER END \\*/`,
      "g",
    );

  css =
    css.replace(
      old,
      "",
    );

  css += `

${start}

.planner-stack {
  display: grid;
  gap: 14px;
}

.planner-controls {
  display: grid;
  grid-template-columns:
    145px
    145px
    130px
    minmax(200px,1fr)
    auto;
  gap: 12px;
  align-items: end;
}

.planner-controls > label,
.planner-profile label {
  display: grid;
  gap: 6px;
}

.planner-controls label > span,
.planner-profile label > span {
  color: #92918c;
  font-size: 10px;
  font-weight: 600;
}

.planner-pack {
  display: flex;
  align-items: center;
  gap: 8px;
}

.planner-pack small {
  color: #777772;
}

.planner-pack input {
  width: 72px;
}

.planner-check {
  display: flex !important;
  grid-auto-flow: column;
  align-items: center;
  justify-content: start;
  gap: 7px !important;
  min-height: 36px;
  white-space: nowrap;
}

.planner-check input {
  width: auto !important;
}

.planner-rule {
  padding: 10px 12px;
  border: 1px solid #e7e4f3;
  border-radius: 9px;
  background: #faf9ff;
  color: #655d91;
  font-size: 11px;
}

.planner-head {
  display: flex;
  justify-content: space-between;
  padding: 5px 2px 2px;
}

.planner-head h2 {
  margin: 0;
  font-size: 15px;
}

.planner-head p {
  margin: 4px 0 0;
  color: #999995;
  font-size: 10px;
}

.planner-list {
  display: grid;
  gap: 8px;
}

.planner-row {
  display: grid;
  grid-template-columns:
    minmax(0,1fr)
    auto;
  gap: 20px;
  align-items: center;

  padding: 15px 16px;

  border: 1px solid #e7e7e3;
  border-radius: 11px;

  background: #fff;
}

.planner-row:hover {
  border-color: #d7d5e5;
}

.planner-row.avoid {
  opacity: .65;
}

.planner-name {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.planner-name strong {
  font-size: 14px;
  font-weight: 650;
}

.planner-name span {
  color: #999995;
  font-size: 11px;
}

.planner-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 8px;
}

.planner-tags span {
  padding: 3px 6px;
  border-radius: 6px;

  background: #f6f6f3;

  color: #777772;
  font-size: 9px;
}

.planner-tags .quality {
  font-weight: 650;
}

.planner-tags .strong {
  background: #eef8f1;
  color: #3f7650;
}

.planner-tags .good {
  background: #f0effc;
  color: #5d55a3;
}

.planner-tags .review {
  background: #faf3e7;
  color: #936d35;
}

.planner-tags .avoid-repeat,
.planner-tags .outside-rule {
  background: #f9ecec;
  color: #985555;
}

.planner-reason {
  margin: 8px 0 0;
  color: #999995;
  font-size: 10px;
}

.planner-profile {
  display: grid;
  grid-template-columns:
    64px
    64px
    105px;
  gap: 7px;
}

.planner-profile select {
  min-height: 32px !important;
  padding: 5px 7px !important;
  font-size: 11px !important;
}

@media (max-width: 1050px) {
  .planner-controls {
    grid-template-columns:
      1fr 1fr;
  }

  .planner-row {
    grid-template-columns:
      1fr;
  }

  .planner-profile {
    justify-content: start;
  }
}

@media (max-width: 600px) {
  .planner-controls {
    grid-template-columns:
      1fr;
  }

  .planner-profile {
    grid-template-columns:
      1fr 1fr 1fr;
  }
}

${end}
`;

  fs.writeFileSync(
    cssFile,
    css,
    "utf8",
  );
}

console.log("");
console.log(
  "Pack Planner installed.",
);
console.log(
  "Database engine is already live in Supabase.",
);
console.log(
  "Restart the dev server.",
);
console.log("");