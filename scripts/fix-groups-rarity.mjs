import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const workspacePath = path.join(
  root,
  "components",
  "workspace.tsx",
);

const cardsPath = path.join(
  root,
  "components",
  "cards.tsx",
);

if (!fs.existsSync(workspacePath)) {
  throw new Error(
    "components/workspace.tsx not found. Run this from the Bias Vault project root.",
  );
}

if (!fs.existsSync(cardsPath)) {
  throw new Error(
    "components/cards.tsx not found. Run this from the Bias Vault project root.",
  );
}

/* ============================================================
 * BACKUPS
 * ============================================================
 */

const workspaceBackup = path.join(
  root,
  "components",
  "workspace.before-kpopping-groups.tsx",
);

const cardsBackup = path.join(
  root,
  "components",
  "cards.before-rarity-fix.tsx",
);

if (!fs.existsSync(workspaceBackup)) {
  fs.copyFileSync(
    workspacePath,
    workspaceBackup,
  );
}

if (!fs.existsSync(cardsBackup)) {
  fs.copyFileSync(
    cardsPath,
    cardsBackup,
  );
}

/* ============================================================
 * CARDS.TSX
 * ============================================================
 */

const cardsSource = String.raw`"use client";

import { useState } from "react";
import type { Catalog, Card } from "@/lib/types";
import {
  cardIdols,
  cardGroups,
  cardExport,
} from "@/lib/catalog";
import {
  Badge,
  DataTable,
  Select,
  download,
} from "./ui";

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
  const [query, setQuery] =
    useState("");

  const [filters, setFilters] =
    useState<
      Record<string, string>
    >({});

  const [show, setShow] =
    useState(false);

  const all =
    scope || data.cards;

  function rarityFor(
    card: Card,
  ) {
    return data.rarities.find(
      (rarity) =>
        rarity.id ===
        card.rarity_id,
    );
  }

  function rarityPercentage(
    card: Card,
  ) {
    const rarity =
      rarityFor(card);

    if (!rarity) {
      return "";
    }

    const raw =
      String(
        rarity.numeric_value ??
          "",
      ).trim();

    if (!raw) {
      return "";
    }

    return raw.endsWith("%")
      ? raw
      : raw + "%";
  }

  function rarityDisplay(
    card: Card,
  ) {
    const rarity =
      rarityFor(card);

    if (!rarity) {
      return "Unknown";
    }

    return (
      rarity.label ||
      rarityPercentage(card) ||
      "Unknown"
    );
  }

  function packFor(
    card: Card,
  ) {
    return data.packs.find(
      (pack) =>
        pack.id ===
        card.pack_id,
    );
  }

  const rows = all.filter(
    (card) => {
      const pack =
        packFor(card);

      const idols =
        cardIdols(
          card,
          data,
        );

      const groups =
        cardGroups(
          card,
          data,
        );

      const rarity =
        rarityFor(card);

      const match = [
        pack?.name,
        pack?.pack_type,
        card.card_name,
        card.slot,
        rarity?.label,
        rarity?.numeric_value,
        rarityPercentage(card),
        ...idols.map(
          (idol) =>
            idol.stage_name,
        ),
        ...groups.map(
          (group) =>
            group.name,
        ),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(
          query.toLowerCase(),
        );

      if (!match) {
        return false;
      }

      return Object.entries(
        filters,
      ).every(
        ([key, value]) =>
          !value ||
          (key === "idol"
            ? idols.some(
                (idol) =>
                  idol.id ===
                  value,
              )
            : key === "group"
              ? groups.some(
                  (group) =>
                    group.id ===
                    value,
                )
              : key ===
                  "gender"
                ? idols.some(
                    (idol) =>
                      idol.gender ===
                      value,
                  )
                : key ===
                    "pack_type"
                  ? pack?.pack_type ===
                    value
                  : key ===
                      "pack_status"
                    ? pack?.status ===
                      value
                    : key ===
                        "pack"
                      ? card.pack_id ===
                        value
                      : key ===
                          "rarity"
                        ? card.rarity_id ===
                          value
                        : card.pic_status ===
                          value),
      );
    },
  );

  const opts = (
    items: {
      id: string;
      name: string;
    }[],
  ) =>
    items.map((item) => ({
      value: item.id,
      label: item.name,
    }));

  const unique = (
    values: string[],
  ) =>
    [
      ...new Set(values),
    ]
      .filter(Boolean)
      .sort()
      .map((value) => ({
        value,
        label: value,
      }));

  const rarityOptions =
    data.rarities.map(
      (rarity) => {
        const raw =
          String(
            rarity.numeric_value ??
              "",
          ).trim();

        const percent =
          raw &&
          !raw.endsWith("%")
            ? raw + "%"
            : raw;

        const label =
          rarity.label ||
          percent;

        return {
          value: rarity.id,

          label:
            percent &&
            label !== percent
              ? label +
                " · " +
                percent
              : label,
        };
      },
    );

  const defs = [
    {
      key: "idol",
      label: "Idols",

      options: opts(
        data.idols.map(
          (idol) => ({
            id: idol.id,
            name:
              idol.stage_name,
          }),
        ),
      ),
    },

    {
      key: "group",
      label: "Groups",
      options: opts(
        data.groups,
      ),
    },

    {
      key: "pack",
      label: "Packs",
      options: opts(
        data.packs,
      ),
    },

    {
      key: "pack_type",
      label: "Pack types",

      options: unique(
        data.packs.map(
          (pack) =>
            pack.pack_type,
        ),
      ),
    },

    {
      key: "rarity",
      label: "Rarities",
      options:
        rarityOptions,
    },

    {
      key: "gender",
      label: "Genders",

      options: unique([
        "female",
        "male",
        "other",
        "unknown",
      ]),
    },

    {
      key: "pic_status",
      label:
        "Picture statuses",

      options: unique(
        data.cards.map(
          (card) =>
            card.pic_status ||
            "",
        ),
      ),
    },

    {
      key: "pack_status",
      label:
        "Pack statuses",

      options: unique([
        "planning",
        "draft",
        "ready",
        "released",
        "archived",
      ]),
    },
  ];

  return (
    <section className="panel">
      <div className="table-toolbar">
        <input
          className="search"
          aria-label="Search cards"
          placeholder="Search idols, rarity, groups, or packs…"
          value={query}
          onChange={(event) =>
            setQuery(
              event.target
                .value,
            )
          }
        />

        <button
          onClick={() =>
            setShow(!show)
          }
        >
          ☷ Filters{" "}
          {Object.values(
            filters,
          ).filter(Boolean)
            .length || ""}
        </button>

        <button
          onClick={() =>
            download(
              cardExport(
                rows,
                data,
              ),
              "filtered-cards",
            )
          }
        >
          ↓ Export{" "}
          {rows.length}
        </button>

        <button
          className="primary"
          onClick={() =>
            edit()
          }
        >
          ＋ Add card
        </button>
      </div>

      {show && (
        <div className="filters">
          {defs.map(
            (filter) => (
              <Select
                key={
                  filter.key
                }
                label={
                  filter.label
                }
                value={
                  filters[
                    filter.key
                  ] || ""
                }
                options={
                  filter.options
                }
                onChange={(
                  value,
                ) =>
                  setFilters({
                    ...filters,

                    [filter.key]:
                      value,
                  })
                }
              />
            ),
          )}

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
        rowKey={(card) =>
          card.id
        }
        columns={[
          {
            key: "idol",
            label:
              "Idol / idols",

            sort: (card) =>
              cardIdols(
                card,
                data,
              )
                .map(
                  (idol) =>
                    idol.stage_name,
                )
                .join(" "),

            render: (card) => (
              <div className="identity">
                <span className="avatar">
                  {(
                    cardIdols(
                      card,
                      data,
                    )[0]
                      ?.stage_name ||
                    card.card_name ||
                    "G"
                  ).slice(
                    0,
                    2,
                  )}
                </span>

                <span>
                  <b>
                    {cardIdols(
                      card,
                      data,
                    )
                      .map(
                        (idol) =>
                          idol.stage_name,
                      )
                      .join(
                        " × ",
                      ) ||
                      card.card_name ||
                      "Group card"}
                  </b>

                  <small>
                    {cardGroups(
                      card,
                      data,
                    )
                      .map(
                        (group) =>
                          group.name,
                      )
                      .join(
                        " / ",
                      ) ||
                      "Soloist"}
                  </small>
                </span>
              </div>
            ),
          },

          /*
           * Rarity deliberately appears
           * immediately after the idol.
           * It is core card identity.
           */

          {
            key: "rarity",
            label: "Rarity",

            sort: (card) =>
              Number(
                rarityFor(
                  card,
                )
                  ?.numeric_value ||
                  0,
              ),

            render: (card) => {
              const display =
                rarityDisplay(
                  card,
                );

              const percent =
                rarityPercentage(
                  card,
                );

              return (
                <div>
                  <Badge tone="violet">
                    {display}
                  </Badge>

                  {percent &&
                    percent !==
                      display && (
                      <small>
                        Drop rate{" "}
                        {percent}
                      </small>
                    )}
                </div>
              );
            },
          },

          {
            key: "pack",
            label: "Pack",

            sort: (card) =>
              packFor(card)
                ?.name || "",

            render: (card) => {
              const pack =
                packFor(card);

              return (
                <>
                  {pack?.name ||
                    "—"}

                  <small>
                    {pack?.pack_type ||
                      "Unknown"}{" "}
                    ·{" "}
                    {pack?.status ||
                      "unknown"}
                  </small>
                </>
              );
            },
          },

          {
            key: "slot",
            label: "Slot",

            sort: (card) =>
              card.slot ||
              "",

            render: (card) =>
              card.slot ||
              "—",
          },

          {
            key: "gender",
            label: "Gender",

            render: (card) =>
              [
                ...new Set(
                  cardIdols(
                    card,
                    data,
                  ).map(
                    (idol) =>
                      idol.gender,
                  ),
                ),
              ].join(" / ") ||
              "—",
          },

          {
            key: "pic",
            label:
              "Pic status",

            sort: (card) =>
              card.pic_status ||
              "",

            render: (card) => (
              <Badge
                tone={
                  card.pic_status?.toLowerCase() ===
                  "selected"
                    ? "green"
                    : "amber"
                }
              >
                {card.pic_status ||
                  "Not set"}
              </Badge>
            ),
          },

          {
            key: "source",
            label:
              "Source / notes",

            render: (card) => (
              <>
                {card.source_url &&
                /^https?:\/\//i.test(
                  card.source_url,
                ) ? (
                  <a
                    href={
                      card.source_url
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    Source ↗
                  </a>
                ) : (
                  "—"
                )}

                {card.notes && (
                  <small
                    className="notes"
                    title={
                      card.notes
                    }
                  >
                    {card.notes}
                  </small>
                )}
              </>
            ),
          },

          {
            key: "actions",
            label: "Actions",

            render: (card) => (
              <div className="row-actions">
                <button
                  onClick={() =>
                    edit(card)
                  }
                >
                  Edit
                </button>

                <button
                  className="text-danger"
                  onClick={() =>
                    remove(card)
                  }
                >
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
`;

fs.writeFileSync(
  cardsPath,
  cardsSource,
  "utf8",
);

console.log(
  "✓ Cards: rarity made prominent",
);

/* ============================================================
 * WORKSPACE PATCH
 * ============================================================
 */

let workspace =
  fs.readFileSync(
    workspacePath,
    "utf8",
  );

const PATCH_MARKER =
  "// BIAS_VAULT_REFERENCE_COVERAGE_PATCH";

if (
  !workspace.includes(
    PATCH_MARKER,
  )
) {
  /*
   * React hooks
   */

  workspace =
    workspace.replace(
      'import { useState } from "react";',
      'import { useEffect, useMemo, useState } from "react";',
    );

  /*
   * Supabase browser client
   */

  if (
    !workspace.includes(
      'createBrowserClient',
    )
  ) {
    workspace =
      workspace.replace(
        'import { useRouter } from "next/navigation";',
        'import { useRouter } from "next/navigation";\nimport { createBrowserClient } from "@supabase/ssr";',
      );
  }

  /*
   * Reference types
   */

  const typeMarker =
    'type Edit = { table: string; record?: Record<string, unknown> };';

  const referenceTypes = String.raw`
type ReferenceCoverage = {
  group_id: string;
  bias_group_name: string;
  kpopping_group_id: string;
  reference_group_name: string;

  roster_size: number;
  represented_members: number;
  missing_members: number;

  coverage_percent:
    | number
    | string
    | null;
};

type ReferenceMissingMember = {
  group_id: string;
  bias_group_name: string;

  kpopping_group_id: string;
  reference_group_name: string;

  kpopping_artist_id: string;
  kpopping_stage_name: string;

  local_idol_id:
    | string
    | null;

  bias_vault_name:
    | string
    | null;

  display_name: string;

  role:
    | string
    | null;

  position:
    | string
    | null;
};

type ReferenceMember = {
  group_id: string;
  bias_group_name: string;

  kpopping_group_id: string;
  kpopping_artist_id: string;

  kpopping_stage_name: string;

  local_idol_id:
    | string
    | null;

  bias_vault_name:
    | string
    | null;

  display_name: string;

  role:
    | string
    | null;

  position:
    | string
    | null;
};

`;

  workspace =
    workspace.replace(
      typeMarker,
      referenceTypes +
        typeMarker,
    );

  /*
   * First replace old coverage()
   * references.
   *
   * Do this BEFORE inserting
   * effectiveCoverage() so the
   * fallback call inside it is not
   * accidentally replaced.
   */

  workspace =
    workspace
      .replaceAll(
        "coverage(g, data)",
        "effectiveCoverage(g)",
      )
      .replaceAll(
        "coverage(a, data)",
        "effectiveCoverage(a)",
      )
      .replaceAll(
        "coverage(b, data)",
        "effectiveCoverage(b)",
      )
      .replaceAll(
        "coverage(group, data)",
        "effectiveCoverage(group)",
      );

  /*
   * Supabase reference data
   */

  const routerMarker =
    "  const router = useRouter();";

  const referenceState = String.raw`  const router = useRouter();

  ${PATCH_MARKER}

  const referenceSupabase =
    useMemo(() => {
      const url =
        process.env
          .NEXT_PUBLIC_SUPABASE_URL;

      const key =
        process.env
          .NEXT_PUBLIC_SUPABASE_ANON_KEY ??
        process.env
          .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

      if (!url || !key) {
        return null;
      }

      return createBrowserClient(
        url,
        key,
      );
    }, []);

  const [
    referenceCoverage,
    setReferenceCoverage,
  ] = useState<
    ReferenceCoverage[]
  >([]);

  const [
    referenceMissingMembers,
    setReferenceMissingMembers,
  ] = useState<
    ReferenceMissingMember[]
  >([]);

  const [
    referenceMembers,
    setReferenceMembers,
  ] = useState<
    ReferenceMember[]
  >([]);

  useEffect(() => {
    if (!referenceSupabase) {
      return;
    }

    let cancelled = false;

    async function readAll(
      table: string,
    ) {
      const rows: Record<
        string,
        unknown
      >[] = [];

      let from = 0;

      while (true) {
        const {
          data: page,
          error,
        } =
          await referenceSupabase!
            .from(table)
            .select("*")
            .range(
              from,
              from + 999,
            );

        if (error) {
          throw error;
        }

        if (!page?.length) {
          break;
        }

        rows.push(...page);

        if (
          page.length < 1000
        ) {
          break;
        }

        from += 1000;
      }

      return rows;
    }

    async function loadReferenceData() {
      try {
        const [
          coverageRows,
          missingRows,
          memberRows,
        ] = await Promise.all([
          readAll(
            "bias_group_reference_coverage",
          ),

          readAll(
            "bias_group_reference_missing_members",
          ),

          readAll(
            "bias_group_reference_members",
          ),
        ]);

        if (cancelled) {
          return;
        }

        setReferenceCoverage(
          coverageRows as unknown as ReferenceCoverage[],
        );

        setReferenceMissingMembers(
          missingRows as unknown as ReferenceMissingMember[],
        );

        setReferenceMembers(
          memberRows as unknown as ReferenceMember[],
        );
      } catch (error) {
        console.error(
          "Unable to load Kpopping reference coverage:",
          error,
        );
      }
    }

    loadReferenceData();

    return () => {
      cancelled = true;
    };
  }, [referenceSupabase]);`;

  workspace =
    workspace.replace(
      routerMarker,
      referenceState,
    );

  /*
   * Effective Kpopping coverage helper
   */

  const rosterFunctionStart =
    "  function groupRosterRows(g: Group) {";

  const helpers = String.raw`  function hasReferenceRoster(
    g: Group,
  ) {
    return referenceCoverage.some(
      (row) =>
        row.group_id === g.id,
    );
  }

  function effectiveCoverage(
    g: Group,
  ) {
    const fallback =
      coverage(g, data);

    const reference =
      referenceCoverage.find(
        (row) =>
          row.group_id ===
          g.id,
      );

    if (!reference) {
      return fallback;
    }

    const missing =
      referenceMissingMembers.filter(
        (member) =>
          member.group_id ===
          g.id,
      );

    return {
      ...fallback,

      represented:
        reference.represented_members,

      total:
        reference.roster_size,

      missing,

      percentage:
        reference.coverage_percent ===
        null
          ? null
          : Number(
              reference.coverage_percent,
            ),
    };
  }

  function rarityNameForCard(
    card: Card,
  ) {
    const rarity =
      data.rarities.find(
        (item) =>
          item.id ===
          card.rarity_id,
      );

    if (!rarity) {
      return "Unknown";
    }

    const raw =
      String(
        rarity.numeric_value ??
          "",
      ).trim();

    const percentage =
      raw
        ? raw.endsWith("%")
          ? raw
          : raw + "%"
        : "";

    if (
      rarity.label &&
      percentage &&
      rarity.label !==
        percentage
    ) {
      return (
        rarity.label +
        " · " +
        percentage
      );
    }

    return (
      rarity.label ||
      percentage ||
      "Unknown"
    );
  }

`;

  workspace =
    workspace.replace(
      rosterFunctionStart,
      helpers +
        rosterFunctionStart,
    );

  /*
   * Replace groupRosterRows()
   *
   * Kpopping current roster becomes
   * authoritative for mapped groups.
   */

  const groupRosterRegex =
    /  function groupRosterRows\(g: Group\) \{[\s\S]*?\n  \}\n  const coverageRows =/;

  const groupRosterReplacement = String.raw`  function groupRosterRows(
    g: Group,
  ) {
    const referenceRoster =
      referenceMembers.filter(
        (member) =>
          member.group_id ===
          g.id,
      );

    /*
     * For groups linked to
     * Kpopping+, current membership
     * comes from Kpopping.
     */
    if (
      referenceRoster.length
    ) {
      return referenceRoster.map(
        (member) => {
          const localIdol =
            member.local_idol_id
              ? data.idols.find(
                  (idol) =>
                    idol.id ===
                    member.local_idol_id,
                )
              : undefined;

          /*
           * Representation is identity
           * based, so cards from a
           * previous/different group
           * still count for the person.
           */
          const cards =
            localIdol
              ? live.filter(
                  (card) =>
                    cardIdols(
                      card,
                      data,
                    ).some(
                      (idol) =>
                        idol.id ===
                        localIdol.id,
                    ),
                )
              : [];

          const packs = [
            ...new Set(
              cards.map(
                (card) =>
                  data.packs.find(
                    (pack) =>
                      pack.id ===
                      card.pack_id,
                  )?.name ||
                  "",
              ),
            ),
          ].filter(Boolean);

          const cardDetails =
            cards.map(
              (card) => ({
                cardId:
                  card.id,

                pack:
                  data.packs.find(
                    (pack) =>
                      pack.id ===
                      card.pack_id,
                  )?.name ||
                  "Unknown pack",

                rarity:
                  rarityNameForCard(
                    card,
                  ),
              }),
            );

          const isMissing =
            referenceMissingMembers.some(
              (missing) =>
                missing.group_id ===
                  g.id &&
                missing.kpopping_artist_id ===
                  member.kpopping_artist_id,
            );

          return {
            id:
              "kpopping:" +
              member.kpopping_artist_id,

            idolId:
              localIdol?.id ||
              null,

            displayName:
              localIdol
                ?.stage_name ||
              member.display_name,

            gender:
              localIdol
                ?.gender ||
              "unknown",

            cards,
            packs,
            cardDetails,

            status:
              isMissing
                ? "Missing"
                : "Represented",

            membershipStatus:
              "current",

            referenceOnly:
              !localIdol,
          };
        },
      );
    }

    /*
     * Fallback for groups not linked
     * to Kpopping.
     */
    return data.group_memberships
      .filter(
        (membership) =>
          membership.group_id ===
          g.id,
      )
      .map((membership) => {
        const idol =
          data.idols.find(
            (idol) =>
              idol.id ===
              membership.idol_id,
          )!;

        const cards =
          live.filter(
            (card) =>
              cardIdols(
                card,
                data,
              ).some(
                (item) =>
                  item.id ===
                  idol.id,
              ) &&
              cardGroups(
                card,
                data,
              ).some(
                (item) =>
                  item.id ===
                  g.id,
              ),
          );

        const packs = [
          ...new Set(
            cards.map(
              (card) =>
                data.packs.find(
                  (pack) =>
                    pack.id ===
                    card.pack_id,
                )?.name ||
                "",
            ),
          ),
        ].filter(Boolean);

        const cardDetails =
          cards.map(
            (card) => ({
              cardId:
                card.id,

              pack:
                data.packs.find(
                  (pack) =>
                    pack.id ===
                    card.pack_id,
                )?.name ||
                "Unknown pack",

              rarity:
                rarityNameForCard(
                  card,
                ),
            }),
          );

        return {
          id:
            membership.id,

          idolId:
            idol.id,

          displayName:
            idol.stage_name,

          gender:
            idol.gender,

          cards,
          packs,
          cardDetails,

          status:
            membership.membership_status ===
            "former"
              ? "Former"
              : cards.length
                ? "Represented"
                : g.roster_configured
                  ? "Missing"
                  : "No live cards",

          membershipStatus:
            membership.membership_status,

          referenceOnly:
            false,
        };
      });
  }

  const coverageRows =`;

  if (
    !groupRosterRegex.test(
      workspace,
    )
  ) {
    throw new Error(
      "Could not locate groupRosterRows() in workspace.tsx. Restore the backup and send the current workspace.tsx.",
    );
  }

  workspace =
    workspace.replace(
      groupRosterRegex,
      groupRosterReplacement,
    );

  /*
   * Roster export
   */

  const oldRosterExport = String.raw`  const rosterExport = (g: Group) =>
    groupRosterRows(g).map((r) => ({
      Group: g.name,
      Idol: r.idol.stage_name,
      Gender: r.idol.gender,
      "Membership status": r.status === "Former" ? "former" : "current",
      Cards: r.cards.length,
      Packs: r.packs.join(", "),
      "Representation status": r.status,
    }));`;

  const newRosterExport = String.raw`  const rosterExport = (g: Group) =>
    groupRosterRows(g).map((r) => ({
      Group: g.name,

      Idol:
        r.displayName,

      Gender:
        r.gender,

      "Membership status":
        r.membershipStatus,

      Cards:
        r.cards.length,

      Packs:
        r.packs.join(", "),

      "Cards and rarities":
        r.cardDetails
          .map(
            (card) =>
              card.pack +
              ": " +
              card.rarity,
          )
          .join(", "),

      "Representation status":
        r.status,
    }));`;

  if (
    workspace.includes(
      oldRosterExport,
    )
  ) {
    workspace =
      workspace.replace(
        oldRosterExport,
        newRosterExport,
      );
  }

  /*
   * Groups filters:
   * reference roster counts as
   * configured.
   */

  workspace =
    workspace.replace(
      `                        (groupFilter === "configured"
                          ? g.roster_configured
                          : groupFilter === "unconfigured"
                            ? !g.roster_configured
                            : groupFilter === "missing"
                              ? !!c.missing?.length
                              : c.percentage === 100)`,
      `                        (groupFilter === "configured"
                          ? g.roster_configured || hasReferenceRoster(g)
                          : groupFilter === "unconfigured"
                            ? !g.roster_configured && !hasReferenceRoster(g)
                            : groupFilter === "missing"
                              ? !!c.missing?.length
                              : c.percentage === 100)`,
    );

  /*
   * Roster status badge
   */

  workspace =
    workspace.replace(
      `<Badge tone={g.roster_configured ? "green" : ""}>
                        {g.roster_configured ? "Configured" : "Not configured"}
                      </Badge>`,
      `<Badge
                        tone={
                          g.roster_configured ||
                          hasReferenceRoster(g)
                            ? "green"
                            : ""
                        }
                      >
                        {hasReferenceRoster(g)
                          ? "Kpopping+ roster"
                          : g.roster_configured
                            ? "Configured"
                            : "Not configured"}
                      </Badge>`,
    );

  /*
   * Dashboard configured-roster count
   */

  workspace =
    workspace.replace(
      `${"${data.groups.filter((g) => g.roster_configured).length}"} full rosters configured`,
      `${"${data.groups.filter((g) => g.roster_configured || hasReferenceRoster(g)).length}"} rosters available`,
    );

  /*
   * Don't display "roster not
   * configured" when Kpopping exists.
   */

  workspace =
    workspace.replaceAll(
      `!group.roster_configured && (`,
      `!group.roster_configured && !hasReferenceRoster(group) && (`,
    );

  workspace =
    workspace.replaceAll(
      `{group.roster_configured && (`,
      `{(group.roster_configured || hasReferenceRoster(group)) && (`,
    );

  /*
   * Replace Members table.
   */

  const oldMemberColumns = String.raw`                        columns={[
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
                        ]}`;

  const newMemberColumns = String.raw`                        columns={[
                          {
                            key: "member",
                            label: "Member",

                            sort: (r) =>
                              r.displayName,

                            render: (r) =>
                              r.idolId ? (
                                <button
                                  className="text-link"
                                  onClick={() =>
                                    go(
                                      "Idols",
                                      r.idolId,
                                    )
                                  }
                                >
                                  {r.displayName} ↗
                                </button>
                              ) : (
                                <span>
                                  <b>
                                    {r.displayName}
                                  </b>

                                  <small>
                                    Kpopping+ roster
                                  </small>
                                </span>
                              ),
                          },

                          {
                            key: "cards",
                            label: "Cards",

                            sort: (r) =>
                              r.cards.length,

                            render: (r) =>
                              r.cards.length,
                          },

                          {
                            key: "rarity",
                            label:
                              "Cards / rarity",

                            render: (r) =>
                              r.cardDetails
                                .length ? (
                                <div>
                                  {r.cardDetails.map(
                                    (
                                      card,
                                    ) => (
                                      <div
                                        key={
                                          card.cardId
                                        }
                                      >
                                        <Badge tone="violet">
                                          {
                                            card.rarity
                                          }
                                        </Badge>{" "}

                                        <small>
                                          {
                                            card.pack
                                          }
                                        </small>
                                      </div>
                                    ),
                                  )}
                                </div>
                              ) : (
                                "—"
                              ),
                          },

                          {
                            key: "status",
                            label: "Status",

                            render: (r) => (
                              <Badge
                                tone={
                                  r.status ===
                                  "Missing"
                                    ? "amber"
                                    : r.status ===
                                        "Represented"
                                      ? "green"
                                      : ""
                                }
                              >
                                {r.status}
                              </Badge>
                            ),
                          },
                        ]}`;

  if (
    workspace.includes(
      oldMemberColumns,
    )
  ) {
    workspace =
      workspace.replace(
        oldMemberColumns,
        newMemberColumns,
      );
  } else {
    console.warn(
      "⚠ Members columns block was not replaced automatically.",
    );
  }

  fs.writeFileSync(
    workspacePath,
    workspace,
    "utf8",
  );

  console.log(
    "✓ Groups now use Kpopping+ current roster",
  );

  console.log(
    "✓ Missing Members filter fixed",
  );

  console.log(
    "✓ Group member card rarity added",
  );
} else {
  console.log(
    "✓ Workspace Groups patch was already installed",
  );
}

console.log("");
console.log(
  "========================================",
);
console.log(
  "GROUPS + RARITY FIX COMPLETE",
);
console.log(
  "========================================",
);
console.log("");
console.log(
  "Backups:",
);
console.log(
  "  components/workspace.before-kpopping-groups.tsx",
);
console.log(
  "  components/cards.before-rarity-fix.tsx",
);
console.log("");
console.log(
  "Now run:",
);
console.log(
  "  npm run dev",
);