"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createBrowserClient } from "@supabase/ssr";

type DiscoveryGroup = {
  kpopping_group_id: string;
  reference_group_name: string;
  status: string | null;
  entity_type: string | null;
  group_type: string | null;
  debut_date: string | null;
  kpopping_url: string | null;

  bias_group_count: number;
  bias_group_names: string[] | null;

  in_game: boolean;

  roster_size: number;
  represented_members: number;
  missing_members: number;

  coverage_percent: number | string | null;
};

type MissingMember = {
  kpopping_group_id: string;
  reference_group_name: string;
  bias_group_names: string[] | null;

  kpopping_artist_id: string;
  stage_name: string;

  role: string | null;
  position: string | null;
};

type NeverRepresentedIdol = {
  kpopping_artist_id: string;
  stage_name: string;

  kpopping_group_id: string;
  group_name: string;

  group_type: string | null;
  group_status: string | null;

  group_url: string | null;
  artist_url: string | null;
};

type ReleaseInfo = {
  release_id: string;
  data_as_of: string | null;
};

type Tab =
  | "incomplete"
  | "missing"
  | "groups"
  | "idols";

const PAGE_SIZE = 100;

const COLORS = {
  canvas: "#F3F1E8",
  paper: "#FBFAF5",
  ink: "#17382E",
  forest: "#1D4034",
  forestDark: "#153229",
  lime: "#C8FF78",
  limeSoft: "#E4F9BD",
  line: "#D8D7CD",
  muted: "#6F786F",
};

function humanize(value: string | null) {
  if (!value) return "—";

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function formatPercentage(
  value: number | string | null
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "—";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return `${number.toFixed(1)}%`;
}

function formatDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(
    `${value}T00:00:00`
  );

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en",
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    }
  ).format(date);
}

export default function DiscoveryPage() {
  const supabase = useMemo(() => {
    const url =
      process.env
        .NEXT_PUBLIC_SUPABASE_URL;

    const key =
      process.env
        .NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      process.env
        .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!url || !key) {
      throw new Error(
        "Supabase environment variables are missing."
      );
    }

    return createBrowserClient(
      url,
      key
    );
  }, []);

  const [tab, setTab] =
    useState<Tab>("incomplete");

  const [query, setQuery] =
    useState("");

  const [
    incompleteGroups,
    setIncompleteGroups,
  ] = useState<DiscoveryGroup[]>([]);

  const [
    missingMembers,
    setMissingMembers,
  ] = useState<MissingMember[]>([]);

  const [
    groupsNotInGame,
    setGroupsNotInGame,
  ] = useState<DiscoveryGroup[]>([]);

  const [
    neverRepresented,
    setNeverRepresented,
  ] = useState<
    NeverRepresentedIdol[]
  >([]);

  const [release, setRelease] =
    useState<ReleaseInfo | null>(
      null
    );

  const [
    visibleCount,
    setVisibleCount,
  ] = useState(PAGE_SIZE);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [tab, query]);

  useEffect(() => {
    let cancelled = false;

    async function fetchAll(
      table: string
    ): Promise<any[]> {
      const result: any[] = [];
      let from = 0;

      while (true) {
        const {
          data,
          error,
        } = await supabase
          .from(table)
          .select("*")
          .range(
            from,
            from + 999
          );

        if (error) {
          throw new Error(
            `${table}: ${error.message}`
          );
        }

        if (!data?.length) {
          break;
        }

        result.push(...data);

        if (
          data.length < 1000
        ) {
          break;
        }

        from += 1000;
      }

      return result;
    }

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [
          incomplete,
          missing,
          groups,
          idols,
          releaseResult,
        ] = await Promise.all([
          fetchAll(
            "kpopping_incomplete_groups"
          ),

          fetchAll(
            "kpopping_missing_members"
          ),

          fetchAll(
            "kpopping_groups_not_in_game"
          ),

          fetchAll(
            "kpopping_never_represented_idols"
          ),

          supabase
            .from(
              "kpopping_releases"
            )
            .select(
              "release_id,data_as_of"
            )
            .eq(
              "active",
              true
            )
            .limit(1)
            .maybeSingle(),
        ]);

        if (
          releaseResult.error
        ) {
          throw new Error(
            releaseResult.error.message
          );
        }

        if (cancelled) {
          return;
        }

        setIncompleteGroups(
          incomplete as DiscoveryGroup[]
        );

        setMissingMembers(
          missing as MissingMember[]
        );

        setGroupsNotInGame(
          groups as DiscoveryGroup[]
        );

        setNeverRepresented(
          idols as NeverRepresentedIdol[]
        );

        setRelease(
          releaseResult.data as
            | ReleaseInfo
            | null
        );
      } catch (err) {
        if (cancelled) {
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : "Could not load Discovery."
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const normalizedQuery =
    query
      .trim()
      .toLowerCase();

  const filteredIncomplete =
    useMemo(() => {
      return incompleteGroups
        .filter((group) => {
          if (
            !normalizedQuery
          ) {
            return true;
          }

          return (
            group.reference_group_name
              .toLowerCase()
              .includes(
                normalizedQuery
              ) ||
            (
              group.bias_group_names ??
              []
            )
              .join(" ")
              .toLowerCase()
              .includes(
                normalizedQuery
              )
          );
        })
        .sort(
          (a, b) =>
            b.missing_members -
              a.missing_members ||
            a.reference_group_name.localeCompare(
              b.reference_group_name
            )
        );
    }, [
      incompleteGroups,
      normalizedQuery,
    ]);

  const filteredGroups =
    useMemo(() => {
      return groupsNotInGame
        .filter((group) => {
          if (
            !normalizedQuery
          ) {
            return true;
          }

          return group.reference_group_name
            .toLowerCase()
            .includes(
              normalizedQuery
            );
        })
        .sort((a, b) => {
          const dateA =
            a.debut_date ?? "";

          const dateB =
            b.debut_date ?? "";

          return (
            dateB.localeCompare(
              dateA
            ) ||
            a.reference_group_name.localeCompare(
              b.reference_group_name
            )
          );
        });
    }, [
      groupsNotInGame,
      normalizedQuery,
    ]);

  const filteredIdols =
    useMemo(() => {
      return neverRepresented
        .filter((idol) => {
          if (
            !normalizedQuery
          ) {
            return true;
          }

          return (
            idol.stage_name
              .toLowerCase()
              .includes(
                normalizedQuery
              ) ||
            idol.group_name
              .toLowerCase()
              .includes(
                normalizedQuery
              )
          );
        })
        .sort(
          (a, b) =>
            a.group_name.localeCompare(
              b.group_name
            ) ||
            a.stage_name.localeCompare(
              b.stage_name
            )
        );
    }, [
      neverRepresented,
      normalizedQuery,
    ]);

  const missingByGroup =
    useMemo(() => {
      const groups = new Map<
        string,
        {
          groupName: string;
          members: MissingMember[];
        }
      >();

      for (const member of missingMembers) {
        if (
          normalizedQuery &&
          !member.stage_name
            .toLowerCase()
            .includes(
              normalizedQuery
            ) &&
          !member.reference_group_name
            .toLowerCase()
            .includes(
              normalizedQuery
            )
        ) {
          continue;
        }

        const existing =
          groups.get(
            member.kpopping_group_id
          );

        if (existing) {
          existing.members.push(
            member
          );
        } else {
          groups.set(
            member.kpopping_group_id,
            {
              groupName:
                member.reference_group_name,

              members: [
                member,
              ],
            }
          );
        }
      }

      return [
        ...groups.values(),
      ].sort(
        (a, b) =>
          b.members.length -
            a.members.length ||
          a.groupName.localeCompare(
            b.groupName
          )
      );
    }, [
      missingMembers,
      normalizedQuery,
    ]);

  const visibleIncomplete =
    filteredIncomplete.slice(
      0,
      visibleCount
    );

  const visibleGroups =
    filteredGroups.slice(
      0,
      visibleCount
    );

  const visibleIdols =
    filteredIdols.slice(
      0,
      visibleCount
    );

  const visibleMissing =
    missingByGroup.slice(
      0,
      visibleCount
    );

  function totalForTab() {
    switch (tab) {
      case "incomplete":
        return filteredIncomplete.length;

      case "missing":
        return missingByGroup.length;

      case "groups":
        return filteredGroups.length;

      case "idols":
        return filteredIdols.length;
    }
  }

  const total =
    totalForTab();

  return (
    <main
      className="min-h-screen"
      style={{
        background:
          COLORS.canvas,
        color: COLORS.ink,
      }}
    >
      <div className="mx-auto max-w-[1440px] px-6 py-8 md:px-10 lg:px-14 lg:py-10">
        {/* TOP BAR */}

        <div className="flex flex-col gap-6 border-b pb-8 md:flex-row md:items-start md:justify-between">
          <div>
            <Link
              href="/"
              className="mb-8 inline-flex items-center gap-2 text-sm font-medium transition-opacity hover:opacity-60"
              style={{
                color:
                  COLORS.forest,
              }}
            >
              <span>←</span>
              <span>
                Bias Vault
              </span>
            </Link>

            <p
              className="text-[11px] font-semibold uppercase tracking-[0.24em]"
              style={{
                color:
                  COLORS.muted,
              }}
            >
              Catalog intelligence
            </p>

            <h1
              className="mt-3 text-5xl font-semibold tracking-[-0.05em] md:text-6xl"
              style={{
                color:
                  COLORS.forestDark,
              }}
            >
              Discovery
            </h1>

            <p
              className="mt-4 max-w-2xl text-[15px] leading-7"
              style={{
                color:
                  COLORS.muted,
              }}
            >
              Find roster gaps,
              unrepresented idols,
              and groups that have
              not entered your card
              universe yet.
            </p>
          </div>

          <div
            className="min-w-[220px] rounded-[22px] p-5"
            style={{
              background:
                COLORS.forest,
              color: "#fff",
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl text-lg"
                style={{
                  background:
                    COLORS.lime,
                  color:
                    COLORS.forestDark,
                }}
              >
                ✦
              </div>

              <div>
                <div className="text-sm font-semibold">
                  Kpopping+ Core
                </div>

                <div className="mt-1 text-xs opacity-60">
                  Release{" "}
                  {release
                    ?.release_id ??
                    "—"}
                </div>
              </div>
            </div>

            <div className="mt-5 border-t border-white/15 pt-4 text-xs leading-5 opacity-70">
              Released packs only
              <br />
              Starter · Rebirth
              1–15
            </div>
          </div>
        </div>

        {/* STATS */}

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            index="01"
            title="Incomplete groups"
            value={
              incompleteGroups.length
            }
            description="Groups already represented, but still missing current members."
          />

          <SummaryCard
            index="02"
            title="Missing members"
            value={
              missingMembers.length
            }
            description="Current roster members without a released card."
          />

          <SummaryCard
            index="03"
            title="Groups not in game"
            value={
              groupsNotInGame.length
            }
            description="Active groups not yet mapped into Bias Vault."
          />

          <SummaryCard
            index="04"
            title="Never represented"
            value={
              neverRepresented.length
            }
            description="Current idols with no released appearance yet."
          />
        </div>

        {/* MAIN PANEL */}

        <section
          className="mt-8 overflow-hidden rounded-[28px] border"
          style={{
            borderColor:
              COLORS.line,
            background:
              COLORS.paper,
          }}
        >
          <div className="border-b px-5 py-5 md:px-7">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap gap-2">
                <TabButton
                  active={
                    tab ===
                    "incomplete"
                  }
                  count={
                    incompleteGroups.length
                  }
                  onClick={() =>
                    setTab(
                      "incomplete"
                    )
                  }
                >
                  Incomplete
                </TabButton>

                <TabButton
                  active={
                    tab ===
                    "missing"
                  }
                  count={
                    missingMembers.length
                  }
                  onClick={() =>
                    setTab(
                      "missing"
                    )
                  }
                >
                  Missing Members
                </TabButton>

                <TabButton
                  active={
                    tab ===
                    "groups"
                  }
                  count={
                    groupsNotInGame.length
                  }
                  onClick={() =>
                    setTab(
                      "groups"
                    )
                  }
                >
                  Not In Game
                </TabButton>

                <TabButton
                  active={
                    tab ===
                    "idols"
                  }
                  count={
                    neverRepresented.length
                  }
                  onClick={() =>
                    setTab(
                      "idols"
                    )
                  }
                >
                  Never Represented
                </TabButton>
              </div>

              <div className="relative w-full xl:w-[340px]">
                <span
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm"
                  style={{
                    color:
                      COLORS.muted,
                  }}
                >
                  ⌕
                </span>

                <input
                  value={query}
                  onChange={(
                    event
                  ) =>
                    setQuery(
                      event.target
                        .value
                    )
                  }
                  placeholder="Search group or idol"
                  className="w-full rounded-full border bg-white py-3 pl-10 pr-4 text-sm outline-none transition"
                  style={{
                    borderColor:
                      COLORS.line,
                    color:
                      COLORS.ink,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="p-5 md:p-7">
            {loading ? (
              <EmptyState>
                Loading catalog
                intelligence…
              </EmptyState>
            ) : error ? (
              <EmptyState>
                {error}
              </EmptyState>
            ) : (
              <>
                {tab ===
                  "incomplete" && (
                  <div className="grid gap-3 xl:grid-cols-2">
                    {visibleIncomplete.map(
                      (group) => (
                        <CoverageCard
                          key={
                            group.kpopping_group_id
                          }
                          group={
                            group
                          }
                        />
                      )
                    )}
                  </div>
                )}

                {tab ===
                  "missing" && (
                  <div className="grid gap-3 xl:grid-cols-2">
                    {visibleMissing.map(
                      (group) => (
                        <MissingGroupCard
                          key={
                            group.groupName
                          }
                          groupName={
                            group.groupName
                          }
                          members={
                            group.members
                          }
                        />
                      )
                    )}
                  </div>
                )}

                {tab ===
                  "groups" && (
                  <DiscoveryTable>
                    <thead>
                      <tr
                        className="text-left text-[10px] uppercase tracking-[0.16em]"
                        style={{
                          color:
                            COLORS.muted,
                        }}
                      >
                        <th className="px-5 py-4 font-semibold">
                          Group
                        </th>

                        <th className="hidden px-5 py-4 font-semibold sm:table-cell">
                          Type
                        </th>

                        <th className="hidden px-5 py-4 font-semibold md:table-cell">
                          Debut
                        </th>

                        <th className="px-5 py-4 text-right font-semibold">
                          Roster
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {visibleGroups.map(
                        (
                          group,
                          index
                        ) => (
                          <tr
                            key={
                              group.kpopping_group_id
                            }
                            className="border-t"
                            style={{
                              borderColor:
                                COLORS.line,
                            }}
                          >
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <span
                                  className="text-[10px] tabular-nums"
                                  style={{
                                    color:
                                      COLORS.muted,
                                  }}
                                >
                                  {String(
                                    index +
                                      1
                                  ).padStart(
                                    2,
                                    "0"
                                  )}
                                </span>

                                <span className="font-semibold">
                                  {
                                    group.reference_group_name
                                  }
                                </span>
                              </div>
                            </td>

                            <td
                              className="hidden px-5 py-4 text-sm sm:table-cell"
                              style={{
                                color:
                                  COLORS.muted,
                              }}
                            >
                              {humanize(
                                group.group_type
                              )}
                            </td>

                            <td
                              className="hidden px-5 py-4 text-sm md:table-cell"
                              style={{
                                color:
                                  COLORS.muted,
                              }}
                            >
                              {formatDate(
                                group.debut_date
                              )}
                            </td>

                            <td className="px-5 py-4 text-right font-semibold tabular-nums">
                              {
                                group.roster_size
                              }
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </DiscoveryTable>
                )}

                {tab ===
                  "idols" && (
                  <DiscoveryTable>
                    <thead>
                      <tr
                        className="text-left text-[10px] uppercase tracking-[0.16em]"
                        style={{
                          color:
                            COLORS.muted,
                        }}
                      >
                        <th className="px-5 py-4 font-semibold">
                          Idol
                        </th>

                        <th className="px-5 py-4 font-semibold">
                          Group
                        </th>

                        <th className="hidden px-5 py-4 text-right font-semibold sm:table-cell">
                          Type
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {visibleIdols.map(
                        (idol) => (
                          <tr
                            key={`${idol.kpopping_group_id}-${idol.kpopping_artist_id}`}
                            className="border-t"
                            style={{
                              borderColor:
                                COLORS.line,
                            }}
                          >
                            <td className="px-5 py-4 font-semibold">
                              {
                                idol.stage_name
                              }
                            </td>

                            <td
                              className="px-5 py-4 text-sm"
                              style={{
                                color:
                                  COLORS.muted,
                              }}
                            >
                              {
                                idol.group_name
                              }
                            </td>

                            <td
                              className="hidden px-5 py-4 text-right text-sm sm:table-cell"
                              style={{
                                color:
                                  COLORS.muted,
                              }}
                            >
                              {humanize(
                                idol.group_type
                              )}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </DiscoveryTable>
                )}

                {total === 0 && (
                  <EmptyState>
                    No matching
                    results.
                  </EmptyState>
                )}

                {visibleCount <
                  total && (
                  <div className="mt-7 flex justify-center">
                    <button
                      type="button"
                      onClick={() =>
                        setVisibleCount(
                          (
                            current
                          ) =>
                            current +
                            PAGE_SIZE
                        )
                      }
                      className="rounded-full px-6 py-3 text-sm font-semibold transition hover:-translate-y-0.5"
                      style={{
                        background:
                          COLORS.forest,
                        color:
                          COLORS.lime,
                      }}
                    >
                      Show more
                    </button>
                  </div>
                )}

                <div
                  className="mt-6 text-center text-xs"
                  style={{
                    color:
                      COLORS.muted,
                  }}
                >
                  Showing{" "}
                  {Math.min(
                    visibleCount,
                    total
                  ).toLocaleString()}{" "}
                  of{" "}
                  {total.toLocaleString()}
                </div>
              </>
            )}
          </div>
        </section>

        <footer
          className="mt-8 flex flex-col gap-2 border-t pt-5 text-xs md:flex-row md:items-center md:justify-between"
          style={{
            borderColor:
              COLORS.line,
            color:
              COLORS.muted,
          }}
        >
          <span>
            Data provided by
            Kpopping+ · Release{" "}
            {release?.release_id ??
              "2026-09"}
          </span>

          <span>
            Bias Vault /
            Moderator Workspace
          </span>
        </footer>
      </div>
    </main>
  );
}

function SummaryCard({
  index,
  title,
  value,
  description,
}: {
  index: string;
  title: string;
  value: number;
  description: string;
}) {
  return (
    <article
      className="min-h-[190px] rounded-[24px] border p-5 transition-transform duration-200 hover:-translate-y-1"
      style={{
        background:
          COLORS.paper,
        borderColor:
          COLORS.line,
      }}
    >
      <div className="flex items-center justify-between">
        <span
          className="text-[10px] font-semibold tracking-[0.2em]"
          style={{
            color:
              COLORS.muted,
          }}
        >
          {index}
        </span>

        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{
            background:
              COLORS.lime,
            boxShadow: `0 0 0 5px ${COLORS.limeSoft}`,
          }}
        />
      </div>

      <div className="mt-8 flex items-end justify-between gap-4">
        <div>
          <div
            className="text-sm font-semibold"
            style={{
              color:
                COLORS.forest,
            }}
          >
            {title}
          </div>

          <p
            className="mt-2 max-w-[240px] text-xs leading-5"
            style={{
              color:
                COLORS.muted,
            }}
          >
            {description}
          </p>
        </div>

        <div
          className="text-4xl font-semibold tracking-[-0.05em] tabular-nums"
          style={{
            color:
              COLORS.forestDark,
          }}
        >
          {value.toLocaleString()}
        </div>
      </div>
    </article>
  );
}

function TabButton({
  active,
  count,
  children,
  onClick,
}: {
  active: boolean;
  count: number;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition"
      style={{
        background: active
          ? COLORS.forest
          : "#FFFFFF",

        color: active
          ? "#FFFFFF"
          : COLORS.forest,

        borderColor: active
          ? COLORS.forest
          : COLORS.line,
      }}
    >
      <span>
        {children}
      </span>

      <span
        className="rounded-full px-2 py-0.5 text-[10px] tabular-nums"
        style={{
          background: active
            ? COLORS.lime
            : COLORS.canvas,

          color:
            COLORS.forestDark,
        }}
      >
        {count.toLocaleString()}
      </span>
    </button>
  );
}

function CoverageCard({
  group,
}: {
  group: DiscoveryGroup;
}) {
  const coverage =
    Number(
      group.coverage_percent
    ) || 0;

  return (
    <article
      className="rounded-[22px] border bg-white p-5"
      style={{
        borderColor:
          COLORS.line,
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3
            className="text-lg font-semibold"
            style={{
              color:
                COLORS.forestDark,
            }}
          >
            {
              group.reference_group_name
            }
          </h3>

          <p
            className="mt-1 text-xs"
            style={{
              color:
                COLORS.muted,
            }}
          >
            {
              group.represented_members
            }{" "}
            represented ·{" "}
            {
              group.missing_members
            }{" "}
            missing ·{" "}
            {group.roster_size}{" "}
            total
          </p>
        </div>

        <div
          className="rounded-full px-3 py-1.5 text-sm font-semibold tabular-nums"
          style={{
            background:
              COLORS.limeSoft,

            color:
              COLORS.forestDark,
          }}
        >
          {formatPercentage(
            group.coverage_percent
          )}
        </div>
      </div>

      <div
        className="mt-5 h-2 overflow-hidden rounded-full"
        style={{
          background:
            "#E8E7DF",
        }}
      >
        <div
          className="h-full rounded-full"
          style={{
            background:
              COLORS.forest,

            width: `${Math.max(
              0,
              Math.min(
                coverage,
                100
              )
            )}%`,
          }}
        />
      </div>

      <div className="mt-4 flex items-center justify-between text-[11px]">
        <span
          style={{
            color:
              COLORS.muted,
          }}
        >
          Released coverage
        </span>

        <span
          className="font-semibold"
          style={{
            color:
              COLORS.forest,
          }}
        >
          {group.missing_members ===
          0
            ? "Complete"
            : `${group.missing_members} left`}
        </span>
      </div>
    </article>
  );
}

function MissingGroupCard({
  groupName,
  members,
}: {
  groupName: string;
  members: MissingMember[];
}) {
  const sorted = [
    ...members,
  ].sort((a, b) =>
    a.stage_name.localeCompare(
      b.stage_name
    )
  );

  return (
    <article
      className="rounded-[22px] border bg-white p-5"
      style={{
        borderColor:
          COLORS.line,
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <h3
          className="text-lg font-semibold"
          style={{
            color:
              COLORS.forestDark,
          }}
        >
          {groupName}
        </h3>

        <span
          className="rounded-full px-3 py-1 text-xs font-semibold"
          style={{
            background:
              COLORS.limeSoft,

            color:
              COLORS.forestDark,
          }}
        >
          {members.length}{" "}
          missing
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {sorted.map(
          (member) => (
            <span
              key={
                member.kpopping_artist_id
              }
              className="rounded-full border px-3 py-1.5 text-xs font-medium"
              style={{
                borderColor:
                  COLORS.line,

                background:
                  COLORS.canvas,

                color:
                  COLORS.forest,
              }}
            >
              {
                member.stage_name
              }
            </span>
          )
        )}
      </div>
    </article>
  );
}

function DiscoveryTable({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div
      className="overflow-hidden rounded-[20px] border bg-white"
      style={{
        borderColor:
          COLORS.line,
      }}
    >
      <table className="w-full border-collapse text-left">
        {children}
      </table>
    </div>
  );
}

function EmptyState({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div
      className="rounded-[20px] border border-dashed px-6 py-16 text-center text-sm"
      style={{
        borderColor:
          COLORS.line,

        color:
          COLORS.muted,
      }}
    >
      {children}
    </div>
  );
}