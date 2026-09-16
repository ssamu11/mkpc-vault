import fs from "node:fs";
import path from "node:path";

const file = path.join(
  process.cwd(),
  "components",
  "pack-planner.tsx",
);

if (!fs.existsSync(file)) {
  throw new Error(
    "components/pack-planner.tsx not found",
  );
}

const backup =
  file + ".before-live-edit";

if (!fs.existsSync(backup)) {
  fs.copyFileSync(
    file,
    backup,
  );
}

let s =
  fs.readFileSync(
    file,
    "utf8",
  );

if (
  s.includes(
    "pack_planner_search_candidates",
  )
) {
  console.log(
    "Live editing is already installed.",
  );
  process.exit(0);
}

/* -----------------------------------------
   useEffect
----------------------------------------- */

if (
  !s.includes(
    "useEffect,",
  )
) {
  s = s.replace(
    `import {
  useMemo,
  useState,
} from "react";`,
    `import {
  useEffect,
  useMemo,
  useState,
} from "react";`,
  );
}

/* -----------------------------------------
   PackRow extra metadata
----------------------------------------- */

s = s.replace(
  `  reason:
    | string
    | null;
};`,
  `  reason:
    | string
    | null;

  edited?: boolean;
  total_appearances?: number;
};`,
);

/* -----------------------------------------
   Candidate type
----------------------------------------- */

const candidateType = `

type PlannerCandidate = {
  identity_key: string;
  display_name: string;
  gender: string;

  group_name:
    | string
    | null;

  popularity_tier: string;

  generation:
    | number
    | null;

  planner_status: string;

  total_appearances: number;

  last_pack_name:
    | string
    | null;

  last_pack_number:
    | number
    | null;

  last_rarity_id:
    | string
    | null;

  previous_rarity:
    | string
    | null;

  target_used: boolean;
  source_category: string;
  score: number;
  eligible: boolean;
};
`;

const savedDraftMarker =
  "type SavedDraft =";

if (
  !s.includes(
    savedDraftMarker,
  )
) {
  throw new Error(
    "SavedDraft type not found. Make sure you are using the latest Pack Planner file.",
  );
}

s = s.replace(
  savedDraftMarker,
  candidateType +
    "\n" +
    savedDraftMarker,
);

/* -----------------------------------------
   Editor states
----------------------------------------- */

const errorState =
  `  const [
    error,
    setError,
  ] =
    useState("");`;

if (
  !s.includes(
    errorState,
  )
) {
  throw new Error(
    "Error state marker not found.",
  );
}

const editorStates = `${errorState}

  const [
    replaceSlot,
    setReplaceSlot,
  ] =
    useState<number | null>(
      null,
    );

  const [
    candidateQuery,
    setCandidateQuery,
  ] =
    useState("");

  const [
    candidates,
    setCandidates,
  ] =
    useState<
      PlannerCandidate[]
    >([]);

  const [
    candidateLoading,
    setCandidateLoading,
  ] =
    useState(false);

  const [
    rowBusy,
    setRowBusy,
  ] =
    useState<number | null>(
      null,
    );

  const [
    undoMap,
    setUndoMap,
  ] =
    useState<
      Record<
        number,
        PackRow[]
      >
    >({});`;

s = s.replace(
  errorState,
  editorStates,
);

/* -----------------------------------------
   Editor logic
----------------------------------------- */

const statsMarker =
  `  const stats =
    useMemo(`;

if (
  !s.includes(
    statsMarker,
  )
) {
  throw new Error(
    "Stats marker not found.",
  );
}

const editorLogic = `

  function rowRarityId(
    row: PackRow,
  ) {
    const wanted =
      Number(
        row.rarity_value,
      );

    return data.rarities.find(
      (rarity) =>
        Number(
          rarity.numeric_value,
        ) === wanted,
    )?.id;
  }

  function rarityNumber(
    value:
      | string
      | number
      | null,
  ) {
    if (
      value === null
    ) {
      return null;
    }

    return Number(
      String(
        value,
      ).replace(
        "%",
        "",
      ),
    );
  }

  function warningsFor(
    candidate:
      PlannerCandidate,
    current:
      PackRow,
  ) {
    const warnings:
      string[] = [];

    const duplicate =
      rows.some(
        (row) =>
          row.slot_no !==
            current.slot_no &&
          row.identity_key ===
            candidate.identity_key,
      );

    if (duplicate) {
      warnings.push(
        "already in this pack",
      );
    }

    if (
      candidate.group_name
    ) {
      const sameGroup =
        rows.filter(
          (row) =>
            row.slot_no !==
              current.slot_no &&
            row.group_name ===
              candidate.group_name,
        ).length;

      if (
        sameGroup >= 2
      ) {
        warnings.push(
          "group already has 2 cards",
        );
      }
    }

    const target =
      rarityNumber(
        current.rarity_value,
      );

    const previous =
      rarityNumber(
        candidate.previous_rarity,
      );

    if (
      previous !== null &&
      target !== null &&
      previous === target
    ) {
      warnings.push(
        "same as previous rarity",
      );
    }

    if (
      previous !== null &&
      target !== null &&
      target <= 0.67 &&
      previous <= 0.67
    ) {
      warnings.push(
        "already had a low/chase rarity",
      );
    }

    if (
      candidate.target_used
    ) {
      warnings.push(
        "has used this rarity before",
      );
    }

    if (
      candidate.total_appearances >
      1
    ) {
      warnings.push(
        candidate.total_appearances +
          " existing cards",
      );
    }

    if (
      !candidate.eligible
    ) {
      warnings.push(
        "outside recommended rarity range",
      );
    }

    return warnings;
  }

  async function searchCandidates(
    current:
      PackRow,
    query: string,
  ) {
    const rarityId =
      rowRarityId(
        current,
      );

    if (
      !rarityId
    ) {
      setError(
        "Could not resolve this rarity.",
      );
      return;
    }

    setCandidateLoading(
      true,
    );

    const {
      data: result,
      error,
    } =
      await supabase.rpc(
        "pack_planner_search_candidates",
        {
          p_target_rarity_id:
            rarityId,

          p_target_pack_number:
            packNumber,

          p_gender:
            current.gender,

          p_query:
            query,

          p_seed:
            Math.floor(
              Math.random() *
                1000000000,
            ),

          p_limit: 60,
        },
      );

    if (error) {
      setCandidates([]);
      setError(
        error.message,
      );
    } else {
      setCandidates(
        (result ||
          []) as PlannerCandidate[],
      );
    }

    setCandidateLoading(
      false,
    );
  }

  function openReplace(
    row: PackRow,
  ) {
    setReplaceSlot(
      row.slot_no,
    );

    setCandidateQuery(
      "",
    );

    setCandidates(
      [],
    );

    setError(
      "",
    );
  }

  function pushUndo(
    row: PackRow,
  ) {
    setUndoMap(
      (old) => ({
        ...old,

        [row.slot_no]: [
          ...(old[
            row.slot_no
          ] || []),

          row,
        ],
      }),
    );
  }

  function candidateToRow(
    current:
      PackRow,
    candidate:
      PlannerCandidate,
  ): PackRow {
    const reasons = [
      "manual edit",

      candidate.total_appearances >
      0
        ? candidate.total_appearances +
          " existing card" +
          (candidate.total_appearances ===
          1
            ? ""
            : "s")
        : "first appearance",

      candidate.previous_rarity
        ? "previous " +
          candidate.previous_rarity
        : null,

      candidate.last_pack_name
        ? "last " +
          candidate.last_pack_name
        : null,
    ].filter(
      Boolean,
    );

    return {
      ...current,

      identity_key:
        candidate.identity_key,

      display_name:
        candidate.display_name,

      group_name:
        candidate.group_name,

      popularity_tier:
        candidate.popularity_tier,

      generation:
        candidate.generation,

      source_category:
        candidate.source_category,

      previous_rarity:
        candidate.previous_rarity,

      last_pack_name:
        candidate.last_pack_name,

      score:
        candidate.score,

      reason:
        reasons.join(
          " · ",
        ),

      total_appearances:
        candidate.total_appearances,

      edited: true,
    };
  }

  function applyCandidate(
    current:
      PackRow,
    candidate:
      PlannerCandidate,
  ) {
    pushUndo(
      current,
    );

    const next =
      candidateToRow(
        current,
        candidate,
      );

    setRows(
      (old) =>
        old.map(
          (row) =>
            row.slot_no ===
            current.slot_no
              ? next
              : row,
        ),
    );

    setReplaceSlot(
      null,
    );

    setCandidateQuery(
      "",
    );

    setCandidates(
      [],
    );

    setSaved(
      null,
    );
  }

  function undoSlot(
    slot: number,
  ) {
    const history =
      undoMap[
        slot
      ] || [];

    if (
      !history.length
    ) {
      return;
    }

    const previous =
      history[
        history.length -
          1
      ];

    setRows(
      (old) =>
        old.map(
          (row) =>
            row.slot_no ===
            slot
              ? previous
              : row,
        ),
    );

    setUndoMap(
      (old) => ({
        ...old,

        [slot]:
          history.slice(
            0,
            -1,
          ),
      }),
    );

    setSaved(
      null,
    );
  }

  async function rerollOne(
    current:
      PackRow,
  ) {
    const rarityId =
      rowRarityId(
        current,
      );

    if (
      !rarityId
    ) {
      setError(
        "Could not resolve this rarity.",
      );
      return;
    }

    setRowBusy(
      current.slot_no,
    );

    setError(
      "",
    );

    const otherRows =
      rows.filter(
        (row) =>
          row.slot_no !==
          current.slot_no,
      );

    const excludeKeys =
      otherRows.map(
        (row) =>
          row.identity_key,
      );

    const groupCount =
      new Map<
        string,
        number
      >();

    for (
      const row
      of otherRows
    ) {
      if (
        !row.group_name
      ) {
        continue;
      }

      groupCount.set(
        row.group_name,
        (groupCount.get(
          row.group_name,
        ) || 0) + 1,
      );
    }

    const blockedGroups =
      [
        ...groupCount.entries(),
      ]
        .filter(
          ([, count]) =>
            count >= 2,
        )
        .map(
          ([group]) =>
            group,
        );

    const {
      data: result,
      error,
    } =
      await supabase.rpc(
        "pack_planner_reroll_candidate",
        {
          p_target_rarity_id:
            rarityId,

          p_target_pack_number:
            packNumber,

          p_gender:
            current.gender,

          p_exclude_identity_keys:
            excludeKeys,

          p_blocked_groups:
            blockedGroups,

          p_seed:
            Math.floor(
              Math.random() *
                1000000000,
            ),
        },
      );

    if (error) {
      setError(
        error.message,
      );

      setRowBusy(
        null,
      );

      return;
    }

    const candidate =
      (
        result ||
        []
      )[0] as
        | PlannerCandidate
        | undefined;

    if (
      !candidate
    ) {
      setError(
        "No suitable replacement found for this slot.",
      );

      setRowBusy(
        null,
      );

      return;
    }

    pushUndo(
      current,
    );

    setRows(
      (old) =>
        old.map(
          (row) =>
            row.slot_no ===
            current.slot_no
              ? candidateToRow(
                  current,
                  candidate,
                )
              : row,
        ),
    );

    setSaved(
      null,
    );

    setRowBusy(
      null,
    );
  }

  const activeReplaceRow =
    replaceSlot === null
      ? null
      : rows.find(
          (row) =>
            row.slot_no ===
            replaceSlot,
        ) || null;

  useEffect(
    () => {
      if (
        !activeReplaceRow
      ) {
        return;
      }

      const timer =
        setTimeout(
          () => {
            searchCandidates(
              activeReplaceRow,
              candidateQuery,
            );
          },
          250,
        );

      return () =>
        clearTimeout(
          timer,
        );

      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [
      replaceSlot,
      candidateQuery,
      packNumber,
    ],
  );
`;

s = s.replace(
  statsMarker,
  editorLogic +
    "\n" +
    statsMarker,
);

/* -----------------------------------------
   Reset undo after whole pack generation
----------------------------------------- */

s = s.replace(
  `      setGenerated(
        true,
      );`,
  `      setGenerated(
        true,
      );

      setUndoMap({});
      setReplaceSlot(null);
      setCandidates([]);`,
);

/* -----------------------------------------
   Row buttons
----------------------------------------- */

const reasonMarker =
  `                          <p className="full-reason">
                            {
                              row.reason
                            }
                          </p>`;

if (
  !s.includes(
    reasonMarker,
  )
) {
  throw new Error(
    "Pack row marker not found.",
  );
}

const rowActions = `                          <div
                            style={{
                              display:
                                "flex",
                              gap: 6,
                              flexWrap:
                                "wrap",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                openReplace(
                                  row,
                                )
                              }
                              disabled={
                                rowBusy !==
                                null
                              }
                              style={{
                                fontSize:
                                  9,
                                padding:
                                  "5px 8px",
                              }}
                            >
                              Replace
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                rerollOne(
                                  row,
                                )
                              }
                              disabled={
                                rowBusy !==
                                null
                              }
                              style={{
                                fontSize:
                                  9,
                                padding:
                                  "5px 8px",
                              }}
                            >
                              {rowBusy ===
                              row.slot_no
                                ? "Rerolling..."
                                : "Reroll card"}
                            </button>

                            {(undoMap[
                              row
                                .slot_no
                            ] || [])
                              .length >
                              0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  undoSlot(
                                    row.slot_no,
                                  )
                                }
                                disabled={
                                  rowBusy !==
                                  null
                                }
                                style={{
                                  fontSize:
                                    9,
                                  padding:
                                    "5px 8px",
                                }}
                              >
                                Undo
                              </button>
                            )}
                          </div>

                          ${
                            reasonMarker
                          }`;

s = s.replace(
  reasonMarker,
  rowActions,
);

/* -----------------------------------------
   Manual badge
----------------------------------------- */

const genderTag =
  `                            <span>
                              {
                                row.gender
                              }
                            </span>`;

if (
  s.includes(
    genderTag,
  )
) {
  s = s.replace(
    genderTag,
    `                            {row.edited && (
                              <span
                                className="full-source fresh"
                              >
                                Manual edit
                              </span>
                            )}

${genderTag}`,
  );
}

/* -----------------------------------------
   Replace modal
----------------------------------------- */

const closingMarker =
  `      )}
    </div>
  );
}`;

if (
  !s.includes(
    closingMarker,
  )
) {
  throw new Error(
    "Component closing marker not found.",
  );
}

const modal = `      )}

      {activeReplaceRow && (
        <div
          onClick={() =>
            setReplaceSlot(
              null,
            )
          }
          style={{
            position:
              "fixed",
            inset: 0,
            zIndex: 1000,
            background:
              "rgba(20,20,20,.28)",
            display:
              "grid",
            placeItems:
              "center",
            padding: 24,
          }}
        >
          <div
            onClick={(
              event,
            ) =>
              event.stopPropagation()
            }
            style={{
              width:
                "min(760px, 96vw)",
              maxHeight:
                "82vh",
              overflow:
                "hidden",
              display:
                "grid",
              gridTemplateRows:
                "auto auto 1fr",
              background:
                "#fff",
              border:
                "1px solid #e6e6e1",
              borderRadius:
                14,
              boxShadow:
                "0 24px 70px rgba(0,0,0,.16)",
            }}
          >
            <div
              style={{
                display:
                  "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "center",
                padding:
                  "18px 20px",
                borderBottom:
                  "1px solid #ecece8",
              }}
            >
              <div>
                <strong
                  style={{
                    display:
                      "block",
                    fontSize:
                      15,
                  }}
                >
                  Replace slot{" "}
                  {
                    activeReplaceRow.slot_no
                  }
                </strong>

                <span
                  style={{
                    color:
                      "#92928d",
                    fontSize:
                      10,
                  }}
                >
                  {
                    activeReplaceRow.rarity_label
                  }{" "}
                  ·{" "}
                  {
                    activeReplaceRow.gender
                  }{" "}
                  · rarity and
                  gender locked
                </span>
              </div>

              <button
                type="button"
                onClick={() =>
                  setReplaceSlot(
                    null,
                  )
                }
              >
                Close
              </button>
            </div>

            <div
              style={{
                padding:
                  "14px 20px",
                borderBottom:
                  "1px solid #ecece8",
              }}
            >
              <input
                autoFocus
                value={
                  candidateQuery
                }
                onChange={(
                  event,
                ) =>
                  setCandidateQuery(
                    event
                      .target
                      .value,
                  )
                }
                placeholder="Search idol or group..."
                style={{
                  width:
                    "100%",
                }}
              />
            </div>

            <div
              style={{
                overflowY:
                  "auto",
                padding:
                  "8px 20px 20px",
              }}
            >
              {candidateLoading && (
                <p
                  style={{
                    color:
                      "#92928d",
                    fontSize:
                      11,
                    padding:
                      "18px 0",
                  }}
                >
                  Loading
                  candidates...
                </p>
              )}

              {!candidateLoading &&
                candidates
                  .filter(
                    (
                      candidate,
                    ) =>
                      candidate.identity_key !==
                      activeReplaceRow.identity_key,
                  )
                  .map(
                    (
                      candidate,
                    ) => {
                      const warnings =
                        warningsFor(
                          candidate,
                          activeReplaceRow,
                        );

                      return (
                        <div
                          key={
                            candidate.identity_key
                          }
                          style={{
                            display:
                              "grid",
                            gridTemplateColumns:
                              "minmax(180px,1fr) minmax(220px,1.5fr) auto",
                            alignItems:
                              "center",
                            gap: 14,
                            padding:
                              "12px 0",
                            borderBottom:
                              "1px solid #efefec",
                          }}
                        >
                          <div>
                            <strong
                              style={{
                                display:
                                  "block",
                                fontSize:
                                  12,
                              }}
                            >
                              {
                                candidate.display_name
                              }
                            </strong>

                            <span
                              style={{
                                color:
                                  "#969691",
                                fontSize:
                                  9,
                              }}
                            >
                              {candidate.group_name ||
                                "Solo / unassigned"}
                            </span>
                          </div>

                          <div
                            style={{
                              display:
                                "flex",
                              flexWrap:
                                "wrap",
                              gap: 5,
                            }}
                          >
                            <span
                              style={{
                                fontSize:
                                  8,
                                padding:
                                  "3px 6px",
                                background:
                                  "#f4f4f1",
                                borderRadius:
                                  5,
                              }}
                            >
                              Tier{" "}
                              {
                                candidate.popularity_tier
                              }
                            </span>

                            {candidate.previous_rarity && (
                              <span
                                style={{
                                  fontSize:
                                    8,
                                  padding:
                                    "3px 6px",
                                  background:
                                    "#f4f4f1",
                                  borderRadius:
                                    5,
                                }}
                              >
                                Previous{" "}
                                {
                                  candidate.previous_rarity
                                }
                              </span>
                            )}

                            <span
                              style={{
                                fontSize:
                                  8,
                                padding:
                                  "3px 6px",
                                background:
                                  "#f4f4f1",
                                borderRadius:
                                  5,
                              }}
                            >
                              {
                                candidate.total_appearances
                              }{" "}
                              card
                              {candidate.total_appearances ===
                              1
                                ? ""
                                : "s"}
                            </span>

                            {warnings.map(
                              (
                                warning,
                              ) => (
                                <span
                                  key={
                                    warning
                                  }
                                  style={{
                                    fontSize:
                                      8,
                                    padding:
                                      "3px 6px",
                                    background:
                                      "#fff4e8",
                                    color:
                                      "#8d642d",
                                    borderRadius:
                                      5,
                                  }}
                                >
                                  ⚠{" "}
                                  {
                                    warning
                                  }
                                </span>
                              ),
                            )}

                            {!warnings.length && (
                              <span
                                style={{
                                  fontSize:
                                    8,
                                  padding:
                                    "3px 6px",
                                  background:
                                    "#edf7ef",
                                  color:
                                    "#3b744b",
                                  borderRadius:
                                    5,
                                }}
                              >
                                ✓ clean
                                replacement
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            className={
                              warnings.length
                                ? ""
                                : "primary"
                            }
                            onClick={() =>
                              applyCandidate(
                                activeReplaceRow,
                                candidate,
                              )
                            }
                          >
                            {warnings.length
                              ? "Use anyway"
                              : "Select"}
                          </button>
                        </div>
                      );
                    },
                  )}

              {!candidateLoading &&
                !candidates.length && (
                  <p
                    style={{
                      color:
                        "#92928d",
                      fontSize:
                        11,
                      padding:
                        "18px 0",
                    }}
                  >
                    No candidates
                    found.
                  </p>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}`;

s = s.replace(
  closingMarker,
  modal,
);

fs.writeFileSync(
  file,
  s,
  "utf8",
);

console.log("");
console.log(
  "Live Pack Planner editing installed.",
);
console.log("");
console.log(
  "Features: Replace / Reroll card / Undo / live warnings.",
);
console.log("");