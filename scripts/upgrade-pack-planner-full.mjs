import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const componentFile = path.join(
  root,
  "components",
  "pack-planner.tsx",
);

const cssFile = [
  path.join(root, "app", "globals.css"),
  path.join(root, "styles", "globals.css"),
].find(fs.existsSync);

if (!fs.existsSync(componentFile)) {
  throw new Error(
    "components/pack-planner.tsx not found",
  );
}

const backup =
  componentFile +
  ".before-full-generator";

if (!fs.existsSync(backup)) {
  fs.copyFileSync(
    componentFile,
    backup,
  );
}

const component = String.raw`"use client";

import {
  useMemo,
  useState,
} from "react";

import {
  createBrowserClient,
} from "@supabase/ssr";

import type {
  Catalog,
} from "@/lib/types";

type PackRow = {
  slot_no: number;
  rarity_label: string;
  rarity_value:
    | number
    | string;

  gender: string;

  identity_key: string;
  display_name: string;
  group_name:
    | string
    | null;

  popularity_tier: string;
  generation:
    | number
    | null;

  source_category: string;

  previous_rarity:
    | string
    | null;

  last_pack_name:
    | string
    | null;

  score: number;

  reason:
    | string
    | null;
};

const rarityOrder = [
  "0.05%",
  "0.23%",
  "0.67%",
  "1.20%",
  "2.50%",
  "5.00%",
];

const expected = {
  "0.05%": 2,
  "0.23%": 4,
  "0.67%": 6,
  "1.20%": 8,
  "2.50%": 10,
  "5.00%": 12,
};

function sourceLabel(
  source: string,
) {
  if (
    source ===
    "missing_member"
  ) {
    return "Missing member";
  }

  if (
    source ===
    "first_time_local"
  ) {
    return "First appearance";
  }

  if (
    source ===
    "new_artist"
  ) {
    return "New group";
  }

  return "Returning";
}

function sourceClass(
  source: string,
) {
  if (
    source ===
    "missing_member"
  ) {
    return "missing";
  }

  if (
    source ===
    "first_time_local"
  ) {
    return "fresh";
  }

  if (
    source ===
    "new_artist"
  ) {
    return "new";
  }

  return "returning";
}

function rarityKey(
  label: string,
) {
  const value =
    Number(
      label.replace(
        "%",
        "",
      ),
    );

  if (
    value === 0.05
  ) {
    return "0.05%";
  }

  if (
    value === 0.23
  ) {
    return "0.23%";
  }

  if (
    value === 0.67
  ) {
    return "0.67%";
  }

  if (
    value === 1.2
  ) {
    return "1.20%";
  }

  if (
    value === 2.5
  ) {
    return "2.50%";
  }

  if (
    value === 5
  ) {
    return "5.00%";
  }

  return label;
}

export default function PackPlanner({
  data,
}: {
  data: Catalog;
}) {
  const supabase =
    useMemo(
      () =>
        createBrowserClient(
          process.env
            .NEXT_PUBLIC_SUPABASE_URL!,
          process.env
            .NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        ),
      [],
    );

  const defaultPack =
    Math.max(
      0,
      ...data.packs.map(
        (pack) =>
          Number(
            pack.pack_number ||
              0,
          ),
      ),
    ) + 1;

  const [
    packNumber,
    setPackNumber,
  ] =
    useState(
      defaultPack,
    );

  const [
    seed,
    setSeed,
  ] =
    useState(1);

  const [
    rows,
    setRows,
  ] =
    useState<
      PackRow[]
    >([]);

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    generated,
    setGenerated,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  async function generate(
    nextSeed = seed,
  ) {
    setLoading(true);
    setError("");

    const {
      data: result,
      error,
    } =
      await supabase.rpc(
        "pack_planner_full_pack",
        {
          p_target_pack_number:
            packNumber,

          p_seed:
            nextSeed,
        },
      );

    if (
      error
    ) {
      setRows([]);
      setError(
        error.message,
      );
      setGenerated(false);
    } else {
      setRows(
        (result ||
          []) as PackRow[],
      );

      setGenerated(true);
    }

    setLoading(false);
  }

  async function reroll() {
    const next =
      seed + 1;

    setSeed(
      next,
    );

    await generate(
      next,
    );
  }

  const stats =
    useMemo(
      () => {
        const returning =
          rows.filter(
            (row) =>
              row.source_category ===
              "returning",
          ).length;

        const missing =
          rows.filter(
            (row) =>
              row.source_category ===
              "missing_member",
          ).length;

        const first =
          rows.filter(
            (row) =>
              row.source_category ===
              "first_time_local",
          ).length;

        const newGroups =
          rows.filter(
            (row) =>
              row.source_category ===
              "new_artist",
          ).length;

        const male =
          rows.filter(
            (row) =>
              row.gender ===
              "male",
          ).length;

        const female =
          rows.filter(
            (row) =>
              row.gender ===
              "female",
          ).length;

        const repeats =
          rows.filter(
            (row) =>
              row.previous_rarity &&
              rarityKey(
                row.previous_rarity,
              ) ===
                rarityKey(
                  row.rarity_label,
                ),
          ).length;

        const groups =
          new Set(
            rows
              .map(
                (row) =>
                  row.group_name,
              )
              .filter(Boolean),
          ).size;

        return {
          returning,
          fresh:
            missing +
            first +
            newGroups,

          missing,
          first,
          newGroups,

          male,
          female,

          repeats,
          groups,
        };
      },
      [rows],
    );

  const grouped =
    useMemo(
      () =>
        rarityOrder.map(
          (rarity) => ({
            rarity,

            rows:
              rows
                .filter(
                  (row) =>
                    rarityKey(
                      row.rarity_label,
                    ) ===
                    rarity,
                )
                .sort(
                  (
                    a,
                    b,
                  ) =>
                    a.slot_no -
                    b.slot_no,
                ),
          }),
        ),
      [rows],
    );

  return (
    <div className="full-planner">
      <section className="panel full-planner-toolbar">
        <div className="full-planner-target">
          <span>
            Target pack
          </span>

          <div>
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
              ) => {
                setPackNumber(
                  Math.max(
                    1,
                    Number(
                      e.target
                        .value ||
                        1,
                    ),
                  ),
                );

                setGenerated(
                  false,
                );

                setRows(
                  [],
                );
              }}
            />
          </div>
        </div>

        <div className="full-planner-actions">
          <button
            className="primary"
            disabled={
              loading
            }
            onClick={() =>
              generate()
            }
          >
            {loading
              ? "Generating..."
              : generated
                ? "Generate again"
                : "Generate pack"}
          </button>

          {generated && (
            <button
              disabled={
                loading
              }
              onClick={
                reroll
              }
            >
              Reroll
            </button>
          )}
        </div>
      </section>

      <div className="full-planner-layout">
        <span>
          0.05%
          <b>2</b>
        </span>

        <span>
          0.23%
          <b>4</b>
        </span>

        <span>
          0.67%
          <b>6</b>
        </span>

        <span>
          1.20%
          <b>8</b>
        </span>

        <span>
          2.50%
          <b>10</b>
        </span>

        <span>
          5.00%
          <b>12</b>
        </span>
      </div>

      {error && (
        <div className="notice full-planner-error">
          {error}
        </div>
      )}

      {!generated &&
        !loading && (
          <section className="panel full-planner-empty">
            <h2>
              Generate a full
              42-card pack
            </h2>

            <p>
              21 male · 21
              female · rarity
              rotation · fresh
              member priority
            </p>

            <button
              className="primary"
              onClick={() =>
                generate()
              }
            >
              Generate Rebirth{" "}
              {
                packNumber
              }
            </button>
          </section>
        )}

      {generated && (
        <>
          <section className="full-planner-health">
            <div>
              <span>
                Cards
              </span>

              <strong>
                {
                  rows.length
                }
                /42
              </strong>
            </div>

            <div>
              <span>
                Gender
              </span>

              <strong>
                {
                  stats.male
                }
                M ·{" "}
                {
                  stats.female
                }
                F
              </strong>
            </div>

            <div>
              <span>
                Fresh
              </span>

              <strong>
                {
                  stats.fresh
                }
              </strong>
            </div>

            <div>
              <span>
                Returning
              </span>

              <strong>
                {
                  stats.returning
                }
              </strong>
            </div>

            <div>
              <span>
                Missing members
              </span>

              <strong>
                {
                  stats.missing
                }
              </strong>
            </div>

            <div>
              <span>
                New groups
              </span>

              <strong>
                {
                  stats.newGroups
                }
              </strong>
            </div>

            <div>
              <span>
                Groups
              </span>

              <strong>
                {
                  stats.groups
                }
              </strong>
            </div>

            <div>
              <span>
                Rarity repeats
              </span>

              <strong>
                {
                  stats.repeats
                }
              </strong>
            </div>
          </section>

          {rows.length !==
            42 && (
            <div className="notice full-planner-warning">
              Generator returned{" "}
              {
                rows.length
              }{" "}
              cards instead of
              42. Review the
              candidate pool.
            </div>
          )}

          <div className="full-planner-groups">
            {grouped.map(
              ({
                rarity,
                rows:
                  rarityRows,
              }) => (
                <section
                  className="panel full-rarity-section"
                  key={
                    rarity
                  }
                >
                  <header>
                    <div>
                      <h2>
                        {
                          rarity
                        }
                      </h2>

                      <span>
                        {
                          rarityRows.length
                        }
                        /
                        {
                          expected[
                            rarity as keyof typeof expected
                          ]
                        }
                      </span>
                    </div>

                    <small>
                      {
                        rarityRows.filter(
                          (
                            row,
                          ) =>
                            row.gender ===
                            "male",
                        )
                          .length
                      }
                      M ·{" "}
                      {
                        rarityRows.filter(
                          (
                            row,
                          ) =>
                            row.gender ===
                            "female",
                        )
                          .length
                      }
                      F
                    </small>
                  </header>

                  <div className="full-rarity-list">
                    {rarityRows.map(
                      (
                        row,
                      ) => (
                        <div
                          className="full-pack-row"
                          key={
                            row.slot_no
                          }
                        >
                          <span className="full-slot">
                            {String(
                              row.slot_no,
                            ).padStart(
                              2,
                              "0",
                            )}
                          </span>

                          <div className="full-idol">
                            <strong>
                              {
                                row.display_name
                              }
                            </strong>

                            <span>
                              {row.group_name ||
                                "Solo / unassigned"}
                            </span>
                          </div>

                          <div className="full-tags">
                            <span
                              className={
                                "full-source " +
                                sourceClass(
                                  row.source_category,
                                )
                              }
                            >
                              {sourceLabel(
                                row.source_category,
                              )}
                            </span>

                            <span>
                              {
                                row.gender
                              }
                            </span>

                            <span>
                              Tier{" "}
                              {
                                row.popularity_tier
                              }
                            </span>

                            {row.generation && (
                              <span>
                                Gen{" "}
                                {
                                  row.generation
                                }
                              </span>
                            )}
                          </div>

                          <div className="full-history">
                            {row.previous_rarity ? (
                              <>
                                <span>
                                  previous
                                </span>

                                <b>
                                  {
                                    row.previous_rarity
                                  }
                                </b>
                              </>
                            ) : (
                              <>
                                <span>
                                  history
                                </span>

                                <b>
                                  none
                                </b>
                              </>
                            )}
                          </div>

                          <p className="full-reason">
                            {
                              row.reason
                            }
                          </p>
                        </div>
                      ),
                    )}
                  </div>
                </section>
              ),
            )}
          </div>
        </>
      )}
    </div>
  );
}
`;

fs.writeFileSync(
  componentFile,
  component,
  "utf8",
);

/* ======================================================
   CSS
====================================================== */

if (cssFile) {
  let css =
    fs.readFileSync(
      cssFile,
      "utf8",
    );

  const start =
    "/* ===== MKPC FULL PACK PLANNER START ===== */";

  const end =
    "/* ===== MKPC FULL PACK PLANNER END ===== */";

  const oldStart =
    css.indexOf(
      start,
    );

  const oldEnd =
    css.indexOf(
      end,
    );

  if (
    oldStart !== -1 &&
    oldEnd !== -1
  ) {
    css =
      css.slice(
        0,
        oldStart,
      ) +
      css.slice(
        oldEnd +
          end.length,
      );
  }

  css += `

${start}

.full-planner {
  display: grid;
  gap: 16px;
}

.full-planner-toolbar {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 20px;
  padding: 18px 20px;
}

.full-planner-target {
  display: grid;
  gap: 7px;
}

.full-planner-target > span {
  color: #96958f;
  font-size: 10px;
  font-weight: 600;
}

.full-planner-target > div {
  display: flex;
  align-items: center;
  gap: 9px;
}

.full-planner-target small {
  color: #656560;
  font-size: 13px;
}

.full-planner-target input {
  width: 78px;
}

.full-planner-actions {
  display: flex;
  gap: 8px;
}

.full-planner-layout {
  display: grid;
  grid-template-columns:
    repeat(6, 1fr);
  gap: 7px;
}

.full-planner-layout span {
  display: flex;
  align-items: center;
  justify-content: space-between;

  padding: 9px 11px;

  border: 1px solid #e7e7e3;
  border-radius: 8px;

  background: #fff;

  color: #777772;
  font-size: 10px;
}

.full-planner-layout b {
  color: #222220;
  font-size: 12px;
}

.full-planner-empty {
  display: grid;
  justify-items: center;
  padding: 70px 20px;
  text-align: center;
}

.full-planner-empty h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 650;
}

.full-planner-empty p {
  margin: 8px 0 20px;
  color: #92928d;
  font-size: 11px;
}

.full-planner-health {
  display: grid;
  grid-template-columns:
    repeat(8, 1fr);
  gap: 8px;
}

.full-planner-health > div {
  padding: 14px 15px;

  border: 1px solid #e7e7e3;
  border-radius: 10px;

  background: #fff;
}

.full-planner-health span {
  display: block;

  color: #999995;
  font-size: 9px;
  font-weight: 500;
}

.full-planner-health strong {
  display: block;

  margin-top: 7px;

  color: #242421;
  font-size: 17px;
  font-weight: 650;
  letter-spacing: -.02em;
}

.full-planner-groups {
  display: grid;
  gap: 12px;
}

.full-rarity-section {
  overflow: hidden;
}

.full-rarity-section > header {
  display: flex;
  align-items: center;
  justify-content: space-between;

  padding: 14px 16px;

  border-bottom: 1px solid #ecece8;

  background: #fafaf8;
}

.full-rarity-section > header > div {
  display: flex;
  align-items: center;
  gap: 9px;
}

.full-rarity-section h2 {
  margin: 0;

  font-size: 14px;
  font-weight: 650;
}

.full-rarity-section header span {
  padding: 3px 6px;

  border-radius: 5px;

  background: #efedff;

  color: #5c51a4;
  font-size: 9px;
  font-weight: 650;
}

.full-rarity-section header small {
  color: #999995;
  font-size: 9px;
}

.full-rarity-list {
  display: grid;
}

.full-pack-row {
  display: grid;

  grid-template-columns:
    34px
    minmax(170px, 1.1fr)
    minmax(210px, 1.4fr)
    90px
    minmax(210px, 1.6fr);

  gap: 14px;
  align-items: center;

  min-height: 62px;

  padding: 10px 16px;

  border-bottom:
    1px solid #efefec;
}

.full-pack-row:last-child {
  border-bottom: 0;
}

.full-pack-row:hover {
  background: #fafaf8;
}

.full-slot {
  color: #aaa9a4;
  font-size: 10px;
  font-variant-numeric:
    tabular-nums;
}

.full-idol {
  display: grid;
  gap: 3px;
}

.full-idol strong {
  color: #222220;
  font-size: 13px;
  font-weight: 650;
}

.full-idol span {
  color: #999995;
  font-size: 10px;
}

.full-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.full-tags span {
  padding: 3px 6px;

  border-radius: 5px;

  background: #f5f5f2;

  color: #777772;
  font-size: 8px;
}

.full-tags .full-source {
  font-weight: 650;
}

.full-source.returning {
  background: #f0effb;
  color: #6258a4;
}

.full-source.missing {
  background: #eaf6ee;
  color: #39764c;
}

.full-source.fresh {
  background: #edf5fa;
  color: #41718f;
}

.full-source.new {
  background: #faf1e5;
  color: #94692f;
}

.full-history {
  display: grid;
  gap: 2px;
}

.full-history span {
  color: #aaa9a4;
  font-size: 8px;
}

.full-history b {
  color: #666661;
  font-size: 10px;
  font-weight: 600;
}

.full-reason {
  margin: 0;

  color: #969691;
  font-size: 9px;
  line-height: 1.45;
}

.full-planner-error,
.full-planner-warning {
  border-radius: 9px;
}

.full-planner-warning {
  background: #fff8ec !important;
  color: #8a662f !important;
}

@media (max-width: 1200px) {
  .full-planner-health {
    grid-template-columns:
      repeat(4, 1fr);
  }

  .full-pack-row {
    grid-template-columns:
      32px
      minmax(160px, 1fr)
      minmax(190px, 1.2fr)
      80px;

  }

  .full-reason {
    grid-column:
      2 / -1;
  }
}

@media (max-width: 850px) {
  .full-planner-layout {
    grid-template-columns:
      repeat(3, 1fr);
  }

  .full-planner-health {
    grid-template-columns:
      repeat(2, 1fr);
  }

  .full-pack-row {
    grid-template-columns:
      28px
      1fr;
  }

  .full-tags,
  .full-history,
  .full-reason {
    grid-column: 2;
  }
}

@media (max-width: 600px) {
  .full-planner-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .full-planner-actions {
    width: 100%;
  }

  .full-planner-actions button {
    flex: 1;
  }

  .full-planner-layout {
    grid-template-columns:
      repeat(2, 1fr);
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
  "Full Pack Planner installed.",
);
console.log(
  "42-card generator enabled.",
);
console.log(
  "Restart npm run dev.",
);
console.log("");