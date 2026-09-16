"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Badge, DataTable, Empty } from "./ui";

type DiscoveryGroup = {
  kpopping_group_id: string;
  reference_group_name: string;
  status: string | null;
  entity_type: string | null;
  group_type: string | null;
  debut_date: string | null;
  disband_date: string | null;
  kpopping_url: string | null;

  bias_group_count: number;
  bias_group_ids: string[] | null;
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

  bias_group_ids: string[] | null;
  bias_group_names: string[] | null;

  kpopping_artist_id: string;
  stage_name: string;

  role: string | null;
  position: string | null;
};

type NeverRepresented = {
  kpopping_artist_id: string;
  stage_name: string;

  kpopping_group_id: string;
  group_name: string;

  group_type: string | null;
  group_status: string | null;

  group_url: string | null;
  artist_url: string | null;
};

type ArtistIdentity = {
  idol_id: string;

  bias_vault_name: string;
  bias_vault_normalized_name: string;

  kpopping_artist_id: string;
  kpopping_name: string;
  kpopping_normalized_name: string;

  match_method: string;
  confirmed: boolean;

  known_aliases: string[] | null;
};

type Release = {
  release_id: string;
  data_as_of: string | null;
};

type Tab =
  | "incomplete"
  | "missing"
  | "groups"
  | "idols";

function localGroupName(row: {
  bias_group_names?: string[] | null;
  reference_group_name?: string;
  group_name?: string;
}) {
  return (
    row.bias_group_names?.[0] ||
    row.reference_group_name ||
    row.group_name ||
    "—"
  );
}

function prettyType(value: string | null) {
  if (!value) return "—";

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

function formatDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(value + "T00:00:00");

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export default function Discovery() {
  const supabase = useMemo(() => {
    const url =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const key =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      process.env
        .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!url || !key) {
      throw new Error(
        "Supabase environment variables are missing.",
      );
    }

    return createBrowserClient(url, key);
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
  ] = useState<NeverRepresented[]>([]);

  const [
    identities,
    setIdentities,
  ] = useState<ArtistIdentity[]>([]);

  const [release, setRelease] =
    useState<Release | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  /*
   * ---------------------------------------------------------
   * LOAD DISCOVERY DATA
   * ---------------------------------------------------------
   */

  useEffect(() => {
    let cancelled = false;

    async function fetchAll(
      table: string,
    ) {
      const rows: Record<
        string,
        unknown
      >[] = [];

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
            from + 999,
          );

        if (error) {
          throw new Error(
            table +
              ": " +
              error.message,
          );
        }

        if (!data?.length) {
          break;
        }

        rows.push(...data);

        if (data.length < 1000) {
          break;
        }

        from += 1000;
      }

      return rows;
    }

    async function load() {
      try {
        setLoading(true);
        setError("");

        const [
          incompleteRows,
          missingRows,
          groupRows,
          idolRows,
          identityRows,
          releaseResult,
        ] = await Promise.all([
          fetchAll(
            "kpopping_incomplete_groups",
          ),

          fetchAll(
            "kpopping_missing_members",
          ),

          fetchAll(
            "kpopping_groups_not_in_game",
          ),

          fetchAll(
            "kpopping_never_represented_idols",
          ),

          fetchAll(
            "kpopping_artist_identity",
          ),

          supabase
            .from(
              "kpopping_releases",
            )
            .select(
              "release_id,data_as_of",
            )
            .eq("active", true)
            .limit(1)
            .maybeSingle(),
        ]);

        if (
          releaseResult.error
        ) {
          throw new Error(
            releaseResult.error.message,
          );
        }

        if (cancelled) {
          return;
        }

        setIncompleteGroups(
          incompleteRows as unknown as DiscoveryGroup[],
        );

        setMissingMembers(
          missingRows as unknown as MissingMember[],
        );

        setGroupsNotInGame(
          groupRows as unknown as DiscoveryGroup[],
        );

        setNeverRepresented(
          idolRows as unknown as NeverRepresented[],
        );

        setIdentities(
          identityRows as unknown as ArtistIdentity[],
        );

        setRelease(
          releaseResult.data as Release | null,
        );
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error
              ? e.message
              : "Unable to load Discovery.",
          );
        }
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

  /*
   * ---------------------------------------------------------
   * LOCAL NAME PRIORITY
   * ---------------------------------------------------------
   *
   * Important rule:
   *
   * Bias Vault name = display name
   * Kpopping name   = reference name only
   *
   * Example:
   *
   * Chaewon -> Kim Chaewon
   * Chanmi   -> Im Do Hwa
   * Monday   -> LUNEDI
   *
   * We never rename the local catalog here.
   */

  const localArtistNames =
    useMemo(() => {
      const map = new Map<
        string,
        string
      >();

      for (const identity of identities) {
        if (!identity.confirmed) {
          continue;
        }

        if (
          !map.has(
            identity.kpopping_artist_id,
          )
        ) {
          map.set(
            identity.kpopping_artist_id,
            identity.bias_vault_name,
          );
        }
      }

      return map;
    }, [identities]);

  function displayArtistName(
    kpoppingArtistId: string,
    kpoppingName: string,
  ) {
    return (
      localArtistNames.get(
        kpoppingArtistId,
      ) || kpoppingName
    );
  }

  /*
   * ---------------------------------------------------------
   * FILTERS
   * ---------------------------------------------------------
   */

  const q =
    query.trim().toLowerCase();

  const incompleteRows =
    useMemo(() => {
      return [
        ...incompleteGroups,
      ]
        .filter((row) => {
          if (!q) {
            return true;
          }

          const text =
            localGroupName(row) +
            " " +
            row.reference_group_name;

          return text
            .toLowerCase()
            .includes(q);
        })
        .sort(
          (a, b) =>
            b.missing_members -
              a.missing_members ||
            localGroupName(
              a,
            ).localeCompare(
              localGroupName(b),
            ),
        );
    }, [
      incompleteGroups,
      q,
    ]);

  const missingRows =
    useMemo(() => {
      return missingMembers
        .map((row) => {
          return {
            ...row,

            display_name:
              displayArtistName(
                row.kpopping_artist_id,
                row.stage_name,
              ),

            display_group:
              localGroupName(row),
          };
        })
        .filter((row) => {
          if (!q) {
            return true;
          }

          const text =
            row.display_name +
            " " +
            row.stage_name +
            " " +
            row.display_group;

          return text
            .toLowerCase()
            .includes(q);
        })
        .sort(
          (a, b) =>
            a.display_group.localeCompare(
              b.display_group,
            ) ||
            a.display_name.localeCompare(
              b.display_name,
            ),
        );
    }, [
      missingMembers,
      localArtistNames,
      q,
    ]);

  const groupRows =
    useMemo(() => {
      return [
        ...groupsNotInGame,
      ]
        .filter((row) => {
          if (!q) {
            return true;
          }

          return row.reference_group_name
            .toLowerCase()
            .includes(q);
        })
        .sort(
          (a, b) =>
            (
              b.debut_date ||
              ""
            ).localeCompare(
              a.debut_date ||
                "",
            ) ||
            a.reference_group_name.localeCompare(
              b.reference_group_name,
            ),
        );
    }, [
      groupsNotInGame,
      q,
    ]);

  const idolRows =
    useMemo(() => {
      return neverRepresented
        .map((row) => {
          return {
            ...row,

            display_name:
              displayArtistName(
                row.kpopping_artist_id,
                row.stage_name,
              ),
          };
        })
        .filter((row) => {
          if (!q) {
            return true;
          }

          const text =
            row.display_name +
            " " +
            row.stage_name +
            " " +
            row.group_name;

          return text
            .toLowerCase()
            .includes(q);
        })
        .sort(
          (a, b) =>
            a.group_name.localeCompare(
              b.group_name,
            ) ||
            a.display_name.localeCompare(
              b.display_name,
            ),
        );
    }, [
      neverRepresented,
      localArtistNames,
      q,
    ]);

  /*
   * ---------------------------------------------------------
   * LOADING / ERROR
   * ---------------------------------------------------------
   */

  if (loading) {
    return (
      <section className="panel">
        <Empty title="Loading Discovery…">
          <p>
            Comparing Bias Vault
            with the current
            Kpopping+ Core roster.
          </p>
        </Empty>
      </section>
    );
  }

  if (error) {
    return (
      <section className="panel">
        <Empty title="Discovery could not load">
          <p>{error}</p>
        </Empty>
      </section>
    );
  }

  /*
   * ---------------------------------------------------------
   * UI
   * ---------------------------------------------------------
   */

  return (
    <div className="stack">
      <div className="stat-grid">
        <DiscoveryStat
          label="Incomplete groups"
          value={
            incompleteGroups.length
          }
          note="In-game groups with current members still missing"
          icon="◈"
        />

        <DiscoveryStat
          label="Missing members"
          value={
            missingMembers.length
          }
          note="Current members without a released appearance"
          icon="♧"
        />

        <DiscoveryStat
          label="Groups not in game"
          value={
            groupsNotInGame.length
          }
          note="Active groups not yet represented in Bias Vault"
          icon="＋"
        />

        <DiscoveryStat
          label="Never represented"
          value={
            neverRepresented.length
          }
          note="Current idols with no released card appearance"
          icon="✦"
        />
      </div>

      <div className="notice">
        <strong>
          Bias Vault names stay yours.
        </strong>

        <p>
          Kpopping+ provides
          current artist identities
          and roster data while Bias
          Vault keeps the display
          names already used by your
          game. Name changes never
          automatically rename your
          local catalog.
          {" "}
          Coverage currently uses
          released packs only.
          {" "}
          Reference release:{" "}
          <b>
            {release?.release_id ||
              "—"}
          </b>.
        </p>
      </div>

      <section className="panel">
        <div className="table-toolbar">
          <div className="toolbar">
            <button
              className={
                tab ===
                "incomplete"
                  ? "primary"
                  : ""
              }
              onClick={() =>
                setTab(
                  "incomplete",
                )
              }
            >
              Incomplete ·{" "}
              {incompleteGroups.length.toLocaleString()}
            </button>

            <button
              className={
                tab === "missing"
                  ? "primary"
                  : ""
              }
              onClick={() =>
                setTab(
                  "missing",
                )
              }
            >
              Missing ·{" "}
              {missingMembers.length.toLocaleString()}
            </button>

            <button
              className={
                tab === "groups"
                  ? "primary"
                  : ""
              }
              onClick={() =>
                setTab(
                  "groups",
                )
              }
            >
              Not in game ·{" "}
              {groupsNotInGame.length.toLocaleString()}
            </button>

            <button
              className={
                tab === "idols"
                  ? "primary"
                  : ""
              }
              onClick={() =>
                setTab(
                  "idols",
                )
              }
            >
              Never represented ·{" "}
              {neverRepresented.length.toLocaleString()}
            </button>
          </div>

          <input
            className="search"
            aria-label="Search Discovery"
            placeholder="Find a group or idol…"
            value={query}
            onChange={(e) =>
              setQuery(
                e.target.value,
              )
            }
          />
        </div>

        {tab ===
          "incomplete" && (
          <DataTable
            rows={
              incompleteRows
            }
            rowKey={(row) =>
              row.kpopping_group_id
            }
            columns={[
              {
                key: "group",
                label: "Group",

                sort: (row) =>
                  localGroupName(
                    row,
                  ),

                render: (row) => {
                  const local =
                    localGroupName(
                      row,
                    );

                  return (
                    <span>
                      <b>{local}</b>

                      {local !==
                        row.reference_group_name && (
                        <small className="muted">
                          {" "}
                          · Kpopping:{" "}
                          {
                            row.reference_group_name
                          }
                        </small>
                      )}
                    </span>
                  );
                },
              },

              {
                key: "represented",
                label:
                  "Represented",

                sort: (row) =>
                  row.represented_members,

                render: (row) =>
                  row.represented_members,
              },

              {
                key: "roster",
                label:
                  "Current roster",

                sort: (row) =>
                  row.roster_size,

                render: (row) =>
                  row.roster_size,
              },

              {
                key: "missing",
                label: "Missing",

                sort: (row) =>
                  row.missing_members,

                render: (row) => (
                  <Badge
                    tone={
                      row.missing_members >
                      0
                        ? "amber"
                        : "green"
                    }
                  >
                    {
                      row.missing_members
                    }
                  </Badge>
                ),
              },

              {
                key: "coverage",
                label: "Coverage",

                sort: (row) =>
                  Number(
                    row.coverage_percent ||
                      0,
                  ),

                render: (row) => {
                  if (
                    row.coverage_percent ===
                    null
                  ) {
                    return "—";
                  }

                  const percent =
                    Number(
                      row.coverage_percent,
                    );

                  return (
                    <div className="coverage-value">
                      <b>
                        {percent.toFixed(
                          1,
                        )}
                        %
                      </b>

                      <div className="progress">
                        <span
                          style={{
                            width:
                              percent +
                              "%",
                          }}
                        />
                      </div>
                    </div>
                  );
                },
              },
            ]}
          />
        )}

        {tab === "missing" && (
          <DataTable
            rows={missingRows}
            rowKey={(row) =>
              row.kpopping_group_id +
              "-" +
              row.kpopping_artist_id
            }
            columns={[
              {
                key: "idol",
                label: "Member",

                sort: (row) =>
                  row.display_name,

                render: (row) => (
                  <span>
                    <b>
                      {
                        row.display_name
                      }
                    </b>

                    {row.display_name !==
                      row.stage_name && (
                      <small className="muted">
                        {" "}
                        · Kpopping:{" "}
                        {
                          row.stage_name
                        }
                      </small>
                    )}
                  </span>
                ),
              },

              {
                key: "group",
                label: "Group",

                sort: (row) =>
                  row.display_group,

                render: (row) =>
                  row.display_group,
              },

              {
                key: "status",
                label: "Status",

                render: () => (
                  <Badge tone="amber">
                    Missing
                  </Badge>
                ),
              },
            ]}
          />
        )}

        {tab === "groups" && (
          <DataTable
            rows={groupRows}
            rowKey={(row) =>
              row.kpopping_group_id
            }
            columns={[
              {
                key: "group",
                label: "Group",

                sort: (row) =>
                  row.reference_group_name,

                render: (row) => (
                  <b>
                    {
                      row.reference_group_name
                    }
                  </b>
                ),
              },

              {
                key: "type",
                label: "Type",

                sort: (row) =>
                  row.group_type ||
                  "",

                render: (row) => (
                  <Badge tone="violet">
                    {prettyType(
                      row.group_type,
                    )}
                  </Badge>
                ),
              },

              {
                key: "debut",
                label: "Debut",

                sort: (row) =>
                  row.debut_date ||
                  "",

                render: (row) =>
                  formatDate(
                    row.debut_date,
                  ),
              },

              {
                key: "roster",
                label:
                  "Current roster",

                sort: (row) =>
                  row.roster_size,

                render: (row) =>
                  row.roster_size,
              },

              {
                key: "status",
                label: "Status",

                render: (row) => (
                  <Badge tone="green">
                    {row.status ||
                      "active"}
                  </Badge>
                ),
              },
            ]}
          />
        )}

        {tab === "idols" && (
          <DataTable
            rows={idolRows}
            rowKey={(row) =>
              row.kpopping_group_id +
              "-" +
              row.kpopping_artist_id
            }
            columns={[
              {
                key: "idol",
                label: "Idol",

                sort: (row) =>
                  row.display_name,

                render: (row) => (
                  <span>
                    <b>
                      {
                        row.display_name
                      }
                    </b>

                    {row.display_name !==
                      row.stage_name && (
                      <small className="muted">
                        {" "}
                        · Kpopping:{" "}
                        {
                          row.stage_name
                        }
                      </small>
                    )}
                  </span>
                ),
              },

              {
                key: "group",
                label:
                  "Current group",

                sort: (row) =>
                  row.group_name,

                render: (row) =>
                  row.group_name,
              },

              {
                key: "type",
                label: "Type",

                render: (row) =>
                  prettyType(
                    row.group_type,
                  ),
              },

              {
                key: "status",
                label:
                  "Representation",

                render: () => (
                  <Badge tone="amber">
                    Not represented
                  </Badge>
                ),
              },
            ]}
          />
        )}
      </section>
    </div>
  );
}

function DiscoveryStat({
  label,
  value,
  note,
  icon,
}: {
  label: string;
  value: number;
  note: string;
  icon: string;
}) {
  return (
    <div className="stat">
      <div>
        <span>{label}</span>

        <span className="stat-icon">
          {icon}
        </span>
      </div>

      <strong>
        {value.toLocaleString()}
      </strong>

      <small>{note}</small>
    </div>
  );
}
