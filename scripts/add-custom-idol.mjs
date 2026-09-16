import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const plannerFile = path.join(
  root,
  "components",
  "pack-planner.tsx",
);

const cssFile = [
  path.join(root, "app", "globals.css"),
  path.join(root, "styles", "globals.css"),
].find(fs.existsSync);

if (!fs.existsSync(plannerFile)) {
  throw new Error(
    "components/pack-planner.tsx not found",
  );
}

const backup =
  plannerFile +
  ".before-custom-idol";

if (!fs.existsSync(backup)) {
  fs.copyFileSync(
    plannerFile,
    backup,
  );
}

let s =
  fs.readFileSync(
    plannerFile,
    "utf8",
  );

if (
  s.includes(
    "function applyCustomIdol",
  )
) {
  console.log(
    "Custom idol feature is already installed.",
  );

  process.exit(0);
}

/* =====================================================
   1. CUSTOM SOURCE LABEL
===================================================== */

s = s.replace(
  `function sourceLabel(
  source: string,
) {`,
  `function sourceLabel(
  source: string,
) {
  if (
    source === "custom"
  ) {
    return "Custom";
  }`,
);

s = s.replace(
  `function sourceClass(
  source: string,
) {`,
  `function sourceClass(
  source: string,
) {
  if (
    source === "custom"
  ) {
    return "custom";
  }`,
);

/* =====================================================
   2. CUSTOM FORM STATES
===================================================== */

const queryState = `  const [
    candidateQuery,
    setCandidateQuery,
  ] =
    useState("");`;

if (
  !s.includes(
    queryState,
  )
) {
  throw new Error(
    "candidateQuery state not found. Make sure live editing is installed first.",
  );
}

s = s.replace(
  queryState,
  `${queryState}

  const [
    customMode,
    setCustomMode,
  ] =
    useState(false);

  const [
    customName,
    setCustomName,
  ] =
    useState("");

  const [
    customGroup,
    setCustomGroup,
  ] =
    useState("");`,
);

/* =====================================================
   3. RESET CUSTOM FORM WHEN OPENING REPLACE
===================================================== */

const openReplaceReset = `    setCandidateQuery(
      "",
    );

    setCandidates(
      [],
    );

    setError(
      "",
    );`;

if (
  !s.includes(
    openReplaceReset,
  )
) {
  throw new Error(
    "openReplace reset block not found.",
  );
}

s = s.replace(
  openReplaceReset,
  `    setCandidateQuery(
      "",
    );

    setCandidates(
      [],
    );

    setCustomMode(
      false,
    );

    setCustomName(
      "",
    );

    setCustomGroup(
      "",
    );

    setError(
      "",
    );`,
);

/* =====================================================
   4. CUSTOM IDOL APPLY FUNCTION
===================================================== */

const applyCandidateMarker =
  `  function applyCandidate(`;

if (
  !s.includes(
    applyCandidateMarker,
  )
) {
  throw new Error(
    "applyCandidate function not found.",
  );
}

const customFunction = `  function applyCustomIdol(
    current: PackRow,
  ) {
    const name =
      customName.trim();

    const group =
      customGroup.trim();

    if (!name) {
      setError(
        "Custom idol name is required.",
      );
      return;
    }

    const duplicate =
      rows.some(
        (row) =>
          row.slot_no !==
            current.slot_no &&
          row.display_name
            .trim()
            .toLowerCase() ===
            name.toLowerCase() &&
          (row.group_name || "")
            .trim()
            .toLowerCase() ===
            group.toLowerCase(),
      );

    pushUndo(
      current,
    );

    const customKey =
      "custom:" +
      Date.now() +
      ":" +
      Math.random()
        .toString(36)
        .slice(2);

    const next: PackRow = {
      ...current,

      identity_key:
        customKey,

      display_name:
        name,

      group_name:
        group || null,

      popularity_tier:
        "—",

      generation:
        null,

      source_category:
        "custom",

      previous_rarity:
        null,

      last_pack_name:
        null,

      score:
        0,

      reason: [
        "custom entry",
        "not linked to Kpopping",
        group
          ? "group " + group
          : "solo / independent",
        duplicate
          ? "duplicate name already in pack"
          : null,
      ]
        .filter(Boolean)
        .join(" · "),

      total_appearances:
        0,

      edited:
        true,
    };

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

    setCustomMode(
      false,
    );

    setCustomName(
      "",
    );

    setCustomGroup(
      "",
    );

    setSaved(
      null,
    );

    setError(
      "",
    );
  }

`;

s = s.replace(
  applyCandidateMarker,
  customFunction +
    applyCandidateMarker,
);

/* =====================================================
   5. CUSTOM FORM INSIDE REPLACE MODAL
===================================================== */

const searchBlock = `            <div
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
            </div>`;

if (
  !s.includes(
    searchBlock,
  )
) {
  throw new Error(
    "Replace modal search block not found.",
  );
}

const newSearchBlock = `            <div
              style={{
                padding:
                  "14px 20px",
                borderBottom:
                  "1px solid #ecece8",
                display:
                  "grid",
                gap: 10,
              }}
            >
              <div
                style={{
                  display:
                    "flex",
                  gap: 8,
                  alignItems:
                    "center",
                }}
              >
                <input
                  autoFocus={
                    !customMode
                  }
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
                  disabled={
                    customMode
                  }
                  style={{
                    width:
                      "100%",
                  }}
                />

                <button
                  type="button"
                  onClick={() => {
                    setCustomMode(
                      !customMode,
                    );

                    setError(
                      "",
                    );
                  }}
                  style={{
                    whiteSpace:
                      "nowrap",
                  }}
                >
                  {customMode
                    ? "Back to search"
                    : "+ Custom idol"}
                </button>
              </div>

              {customMode && (
                <div className="planner-custom-box">
                  <div className="planner-custom-heading">
                    <div>
                      <strong>
                        Custom idol
                      </strong>

                      <span>
                        For artists not available in Kpopping
                      </span>
                    </div>

                    <span className="planner-custom-lock">
                      {
                        activeReplaceRow.rarity_label
                      }
                      {" · "}
                      {
                        activeReplaceRow.gender
                      }
                    </span>
                  </div>

                  <div className="planner-custom-fields">
                    <label>
                      Idol name

                      <input
                        autoFocus
                        value={
                          customName
                        }
                        onChange={(
                          event,
                        ) =>
                          setCustomName(
                            event
                              .target
                              .value,
                          )
                        }
                        placeholder="e.g. Jungt"
                      />
                    </label>

                    <label>
                      Group / Act

                      <input
                        value={
                          customGroup
                        }
                        onChange={(
                          event,
                        ) =>
                          setCustomGroup(
                            event
                              .target
                              .value,
                          )
                        }
                        placeholder="e.g. Santos Bravos"
                      />
                    </label>
                  </div>

                  <div className="planner-custom-note">
                    Gender and rarity follow this slot automatically.
                    Leave Group / Act blank for a solo or independent artist.
                  </div>

                  <button
                    type="button"
                    className="primary"
                    disabled={
                      !customName.trim()
                    }
                    onClick={() =>
                      applyCustomIdol(
                        activeReplaceRow,
                      )
                    }
                  >
                    Use custom idol
                  </button>
                </div>
              )}
            </div>`;

s = s.replace(
  searchBlock,
  newSearchBlock,
);

/* =====================================================
   6. HIDE NORMAL CANDIDATES WHILE CUSTOM FORM OPEN
===================================================== */

s = s.replace(
  `{candidateLoading && (`,
  `{!customMode &&
              candidateLoading && (`,
);

s = s.replace(
  `{!candidateLoading &&
                candidates`,
  `{!customMode &&
                !candidateLoading &&
                candidates`,
);

s = s.replace(
  `{!candidateLoading &&
                !candidates.length && (`,
  `{!customMode &&
                !candidateLoading &&
                !candidates.length && (`,
);

fs.writeFileSync(
  plannerFile,
  s,
  "utf8",
);

/* =====================================================
   7. CSS
===================================================== */

if (cssFile) {
  let css =
    fs.readFileSync(
      cssFile,
      "utf8",
    );

  if (
    !css.includes(
      "MKPC CUSTOM IDOL",
    )
  ) {
    css += `

/* ===== MKPC CUSTOM IDOL ===== */

.full-source.custom {
  background: #efefef;
  color: #343434;
}

.planner-custom-box {
  display: grid;
  gap: 12px;

  padding: 14px;

  border: 1px solid #e5e5e0;
  border-radius: 10px;

  background: #fafaf8;
}

.planner-custom-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.planner-custom-heading > div {
  display: grid;
  gap: 2px;
}

.planner-custom-heading strong {
  font-size: 12px;
  font-weight: 650;
}

.planner-custom-heading span {
  color: #94948f;
  font-size: 9px;
}

.planner-custom-lock {
  padding: 5px 8px;

  border-radius: 6px;

  background: #efedff;

  color: #6258a4 !important;

  font-size: 9px !important;
  font-weight: 600;
}

.planner-custom-fields {
  display: grid;
  grid-template-columns:
    1fr 1fr;
  gap: 10px;
}

.planner-custom-fields label {
  display: grid;
  gap: 5px;

  color: #777772;
  font-size: 9px;
}

.planner-custom-fields input {
  width: 100%;
}

.planner-custom-note {
  color: #92928d;
  font-size: 9px;
  line-height: 1.5;
}

.planner-custom-box .primary {
  justify-self: start;
}

@media (max-width: 650px) {
  .planner-custom-fields {
    grid-template-columns: 1fr;
  }
}

/* ===== END MKPC CUSTOM IDOL ===== */
`;

    fs.writeFileSync(
      cssFile,
      css,
      "utf8",
    );
  }
}

console.log("");
console.log(
  "Custom idol support installed.",
);
console.log(
  "✓ custom idol name",
);
console.log(
  "✓ custom group / act",
);
console.log(
  "✓ no Kpopping identity required",
);
console.log(
  "✓ works with Save as draft + Excel export",
);
console.log("");