import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const plannerFile = path.join(
  root,
  "components",
  "pack-planner.tsx",
);

const workspaceFile = path.join(
  root,
  "components",
  "workspace.tsx",
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

if (!fs.existsSync(workspaceFile)) {
  throw new Error(
    "components/workspace.tsx not found",
  );
}

/* backup */

const plannerBackup =
  plannerFile + ".before-save-export";

if (!fs.existsSync(plannerBackup)) {
  fs.copyFileSync(
    plannerFile,
    plannerBackup,
  );
}

const workspaceBackup =
  workspaceFile + ".before-save-export";

if (!fs.existsSync(workspaceBackup)) {
  fs.copyFileSync(
    workspaceFile,
    workspaceBackup,
  );
}

let src =
  fs.readFileSync(
    plannerFile,
    "utf8",
  );

/* ==========================================
   XLSX IMPORT
========================================== */

if (
  !src.includes(
    'import * as XLSX from "xlsx";',
  )
) {
  src = src.replace(
    /import\s*\{\s*createBrowserClient\s*,?\s*\}\s*from\s*"@supabase\/ssr";/,
    (match) =>
      `${match}\nimport * as XLSX from "xlsx";`,
  );
}

/* ==========================================
   SAVED DRAFT TYPE
========================================== */

if (
  !src.includes(
    "type SavedDraft =",
  )
) {
  src = src.replace(
    /const rarityOrder\s*=/,
    `type SavedDraft = {
  pack_id: string;
  pack_name: string;
  cards_created: number;
  status: string;
};

const rarityOrder =`,
  );
}

/* ==========================================
   DONE CALLBACK
========================================== */

src = src.replace(
  /export default function PackPlanner\(\{\s*data,\s*\}:\s*\{\s*data:\s*Catalog;\s*\}\)\s*\{/,
  `export default function PackPlanner({
  data,
  done,
}: {
  data: Catalog;
  done?: () => void;
}) {`,
);

/* ==========================================
   SAVE STATES
========================================== */

if (
  !src.includes(
    "const [saving, setSaving]",
  )
) {
  src = src.replace(
    /const\s*\[\s*error,\s*setError\s*\]\s*=\s*useState\(\s*""\s*\);/,
    `const [saving, setSaving] = useState(false);

  const [saved, setSaved] =
    useState<SavedDraft | null>(null);

  const [error, setError] = useState("");`,
  );
}

/* clear old save whenever generating */

if (
  !src.includes(
    'setSaved(null);\n\n    const {',
  )
) {
  src = src.replace(
    /setError\(\s*""\s*\);\s*\n\s*const\s*\{/,
    `setError("");
    setSaved(null);

    const {`,
  );
}

/* ==========================================
   SAVE + EXPORT FUNCTIONS
========================================== */

if (
  !src.includes(
    "async function saveDraft()",
  )
) {
  const functions = `

  async function saveDraft() {
    if (rows.length !== 42) {
      setError(
        "Generate a complete 42-card pack before saving.",
      );
      return;
    }

    setSaving(true);
    setError("");

    const payload = rows
      .slice()
      .sort(
        (a, b) =>
          a.slot_no -
          b.slot_no,
      )
      .map((row) => ({
        slot_no:
          row.slot_no,

        rarity_label:
          row.rarity_label,

        rarity_value:
          Number(
            row.rarity_value,
          ),

        gender:
          row.gender,

        identity_key:
          row.identity_key,

        display_name:
          row.display_name,

        group_name:
          row.group_name,

        source_category:
          row.source_category,
      }));

    const {
      data: result,
      error,
    } =
      await supabase.rpc(
        "save_pack_planner_draft",
        {
          p_target_pack_number:
            packNumber,

          p_rows:
            payload,
        },
      );

    if (error) {
      setError(
        error.message,
      );
    } else {
      setSaved(
        result as SavedDraft,
      );

      done?.();
    }

    setSaving(false);
  }

  function legacyRarity(
    value: number | string,
  ) {
    const n =
      Number(value);

    if (n === 0.05)
      return "0.05%";

    if (n === 0.23)
      return "0.23%";

    if (n === 0.67)
      return "0.67%";

    if (n === 1.2)
      return "1.2%";

    if (n === 2.5)
      return "2.5%";

    if (n === 5)
      return "5%";

    return n + "%";
  }

  function exportExcel() {
    if (rows.length !== 42) {
      setError(
        "Generate a complete 42-card pack before exporting.",
      );
      return;
    }

    const sorted =
      rows
        .slice()
        .sort(
          (a, b) =>
            a.slot_no -
            b.slot_no,
        );

    /*
     * Same structure as the old
     * Rebirth workbook:
     *
     * Pack N
     *
     * Slot
     * Rarity
     * Gender
     * Idol
     * Group / Act
     * Pic Status
     * Source / Pinterest URL
     * Notes
     */

    const sheetRows = [
      [
        "Pack " +
          packNumber,
      ],

      [],

      [
        "Slot",
        "Rarity",
        "Gender",
        "Idol",
        "Group / Act",
        "Pic Status",
        "Source / Pinterest URL",
        "Notes",
      ],

      ...sorted.map(
        (row) => [
          row.slot_no,

          legacyRarity(
            row.rarity_value,
          ),

          row.gender ===
          "male"
            ? "Male"
            : row.gender ===
                "female"
              ? "Female"
              : row.gender,

          row.display_name,

          row.group_name ||
            "SOLO",

          "To Find",

          "",

          "",
        ],
      ),
    ];

    const workbook =
      XLSX.utils.book_new();

    const worksheet =
      XLSX.utils.aoa_to_sheet(
        sheetRows,
      );

    worksheet["!cols"] = [
      { wch: 8 },
      { wch: 10 },
      { wch: 10 },
      { wch: 22 },
      { wch: 24 },
      { wch: 14 },
      { wch: 34 },
      { wch: 28 },
    ];

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      (
        "Rebirth " +
        packNumber
      ).slice(
        0,
        31,
      ),
    );

    XLSX.writeFile(
      workbook,
      "Rebirth " +
        packNumber +
        ".xlsx",
    );
  }

`;

  src = src.replace(
    /(\s+const stats\s*=)/,
    `${functions}$1`,
  );
}

/* ==========================================
   TOOLBAR BUTTONS
========================================== */

if (
  !src.includes(
    "Export Excel",
  )
) {
  const buttons = `

          {generated &&
            rows.length === 42 && (
              <button
                disabled={
                  loading ||
                  saving
                }
                onClick={
                  exportExcel
                }
              >
                Export Excel
              </button>
            )}

          {generated &&
            rows.length === 42 && (
              <button
                className="primary"
                disabled={
                  loading ||
                  saving ||
                  !!saved
                }
                onClick={
                  saveDraft
                }
              >
                {saving
                  ? "Saving..."
                  : saved
                    ? "Saved"
                    : "Save as draft"}
              </button>
            )}
`;

  const toolbarEnd =
    `        </div>
      </section>

      <div className="full-planner-layout">`;

  if (
    !src.includes(
      toolbarEnd,
    )
  ) {
    throw new Error(
      "Could not find Pack Planner toolbar.",
    );
  }

  src = src.replace(
    toolbarEnd,
    `${buttons}        </div>
      </section>

      <div className="full-planner-layout">`,
  );
}

/* ==========================================
   SUCCESS MESSAGE
========================================== */

if (
  !src.includes(
    "full-planner-success",
  )
) {
  const success = `
      {saved && (
        <div className="full-planner-success">
          <strong>
            {saved.pack_name}
          </strong>

          <span>
            {saved.cards_created}
            {" "}cards saved · draft · Pic Status = To Find
          </span>
        </div>
      )}

`;

  src = src.replace(
    /\s*\{!generated\s*&&/,
    `
${success}      {!generated &&`,
  );
}

fs.writeFileSync(
  plannerFile,
  src,
  "utf8",
);

/* ==========================================
   WORKSPACE
========================================== */

let workspace =
  fs.readFileSync(
    workspaceFile,
    "utf8",
  );

workspace =
  workspace.replace(
    /<PackPlanner\s+data=\{data\}\s*\/>/,
    `<PackPlanner data={data} done={done} />`,
  );

workspace =
  workspace.replaceAll(
    "Rarity rotation & candidate planning",
    "Generate, save & export Rebirth packs",
  );

fs.writeFileSync(
  workspaceFile,
  workspace,
  "utf8",
);

/* ==========================================
   CSS
========================================== */

if (cssFile) {
  let css =
    fs.readFileSync(
      cssFile,
      "utf8",
    );

  if (
    !css.includes(
      "MKPC PACK SAVE EXPORT",
    )
  ) {
    css += `

/* ===== MKPC PACK SAVE EXPORT ===== */

.full-planner-success {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;

  padding: 11px 13px;

  border:
    1px solid #dcebdc;

  border-radius: 9px;

  background: #f3faf4;
}

.full-planner-success strong {
  color: #2f6b42;
  font-size: 11px;
}

.full-planner-success span {
  color: #64816b;
  font-size: 10px;
}

.full-planner-actions {
  flex-wrap: wrap;
}

.full-planner-actions button {
  white-space: nowrap;
}

/* ===== END MKPC PACK SAVE EXPORT ===== */
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
  "Save as draft + Excel export installed.",
);
console.log("");
console.log(
  "Backend RPC is already installed in Supabase.",
);
console.log("");