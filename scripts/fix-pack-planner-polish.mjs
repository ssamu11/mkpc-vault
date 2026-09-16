import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const plannerFile = path.join(
  root,
  "components",
  "pack-planner.tsx",
);

const routeFile = path.join(
  root,
  "app",
  "api",
  "catalog",
  "route.ts",
);

const editorsFile = path.join(
  root,
  "components",
  "editors.tsx",
);

const cssFile = [
  path.join(root, "app", "globals.css"),
  path.join(root, "styles", "globals.css"),
].find(fs.existsSync);

for (const file of [
  plannerFile,
  routeFile,
  editorsFile,
]) {
  if (!fs.existsSync(file)) {
    throw new Error(
      `Missing file: ${file}`,
    );
  }

  const backup =
    file + ".before-pack-polish";

  if (!fs.existsSync(backup)) {
    fs.copyFileSync(
      file,
      backup,
    );
  }
}

/* =========================================================
   1. FIX SINGLE-CARD REROLL
   - current idol can NEVER be selected again
   - recent previous idols for that slot also excluded
========================================================= */

let planner =
  fs.readFileSync(
    plannerFile,
    "utf8",
  );

if (
  !planner.includes(
    "recentSlotKeys",
  )
) {
  const oldExclude = `    const excludeKeys =
      otherRows.map(
        (row) =>
          row.identity_key,
      );`;

  const newExclude = `    const recentSlotKeys =
      (
        undoMap[
          current.slot_no
        ] || []
      ).map(
        (row) =>
          row.identity_key,
      );

    const excludeKeys =
      Array.from(
        new Set([
          current.identity_key,
          ...recentSlotKeys,
          ...otherRows.map(
            (row) =>
              row.identity_key,
          ),
        ]),
      );`;

  if (
    !planner.includes(
      oldExclude,
    )
  ) {
    throw new Error(
      "Could not find reroll exclude block.",
    );
  }

  planner =
    planner.replace(
      oldExclude,
      newExclude,
    );
}

/* =========================================================
   2. REASON CHIP HELPER
========================================================= */

if (
  !planner.includes(
    "function reasonClass",
  )
) {
  const marker =
    `function rarityKey(`;

  const helper = `function reasonClass(
  text: string,
) {
  const value =
    text.toLowerCase();

  if (
    value.includes(
      "new rarity",
    )
  ) {
    return "reason-good";
  }

  if (
    value.includes(
      "existing card",
    )
  ) {
    return "reason-warn";
  }

  if (
    value.startsWith(
      "returning",
    )
  ) {
    return "reason-returning";
  }

  if (
    value.startsWith(
      "previous",
    )
  ) {
    return "reason-previous";
  }

  if (
    value.includes(
      "pack gap",
    )
  ) {
    return "reason-gap";
  }

  if (
    value.startsWith(
      "last ",
    )
  ) {
    return "reason-muted";
  }

  if (
    value.includes(
      "first appearance",
    ) ||
    value.includes(
      "missing member",
    )
  ) {
    return "reason-fresh";
  }

  return "reason-muted";
}

`;

  if (
    !planner.includes(
      marker,
    )
  ) {
    throw new Error(
      "Could not find rarityKey helper.",
    );
  }

  planner =
    planner.replace(
      marker,
      helper + marker,
    );
}

/* =========================================================
   3. REPLACE UGLY LONG REASON TEXT WITH CHIPS
========================================================= */

if (
  !planner.includes(
    "full-reason-chips",
  )
) {
  const reasonRegex =
    /<p className="full-reason">[\s\S]*?\{\s*row\.reason\s*\}[\s\S]*?<\/p>/;

  if (
    !reasonRegex.test(
      planner,
    )
  ) {
    throw new Error(
      "Could not find reason paragraph.",
    );
  }

  planner =
    planner.replace(
      reasonRegex,
      `<div className="full-reason-chips">
                            {(row.reason || "")
                              .split(" · ")
                              .filter(Boolean)
                              .map(
                                (
                                  part,
                                  index,
                                ) => (
                                  <span
                                    key={
                                      index
                                    }
                                    className={
                                      "full-reason-chip " +
                                      reasonClass(
                                        part,
                                      )
                                    }
                                  >
                                    {
                                      part
                                    }
                                  </span>
                                ),
                              )}
                          </div>`,
    );
}

fs.writeFileSync(
  plannerFile,
  planner,
  "utf8",
);

/* =========================================================
   4. DRAFT PACK DELETE
   Draft = delete pack + cards
   Released = still protected
========================================================= */

let route =
  fs.readFileSync(
    routeFile,
    "utf8",
  );

if (
  !route.includes(
    "delete_draft_pack_cascade",
  )
) {
  const deleteMarker =
    `      const { error } = await db.from(input.table).delete().eq("id", input.id);`;

  if (
    !route.includes(
      deleteMarker,
    )
  ) {
    throw new Error(
      "Could not find catalog delete handler.",
    );
  }

  route =
    route.replace(
      deleteMarker,
      `      if (
        input.table === "packs"
      ) {
        const {
          error,
        } =
          await db.rpc(
            "delete_draft_pack_cascade",
            {
              p_pack_id:
                input.id,
            },
          );

        if (error) {
          throw Error(
            error.message,
          );
        }

        return NextResponse.json({
          ok: true,
        });
      }

${deleteMarker}`,
    );
}

fs.writeFileSync(
  routeFile,
  route,
  "utf8",
);

/* =========================================================
   5. CLEANER DELETE MODAL COPY
========================================================= */

let editors =
  fs.readFileSync(
    editorsFile,
    "utf8",
  );

if (
  !editors.includes(
    "Draft packs will also remove",
  )
) {
  const oldCopy =
    /<p>\s*<strong>\{name\}<\/strong> will be permanently removed\. Linked card records\s*prevent group, idol, pack, or rarity deletion\.\s*<\/p>/;

  if (
    !oldCopy.test(
      editors,
    )
  ) {
    throw new Error(
      "Could not find delete dialog copy.",
    );
  }

  editors =
    editors.replace(
      oldCopy,
      `{table === "packs" ? (
        <p>
          <strong>
            {name}
          </strong>{" "}
          will be permanently removed.
          Draft packs will also remove
          every linked card inside the pack.
          Released packs remain protected.
        </p>
      ) : (
        <p>
          <strong>
            {name}
          </strong>{" "}
          will be permanently removed.
          Linked card records prevent
          group, idol, or rarity deletion.
        </p>
      )}`,
    );
}

fs.writeFileSync(
  editorsFile,
  editors,
  "utf8",
);

/* =========================================================
   6. VISUAL POLISH
========================================================= */

if (cssFile) {
  let css =
    fs.readFileSync(
      cssFile,
      "utf8",
    );

  if (
    !css.includes(
      "MKPC REASON CHIPS",
    )
  ) {
    css += `

/* ===== MKPC REASON CHIPS ===== */

.full-reason-chips {
  grid-column: 2 / -1;

  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;

  padding-top: 2px;
}

.full-reason-chip {
  display: inline-flex;
  align-items: center;

  min-height: 22px;
  padding: 4px 8px;

  border-radius: 6px;

  font-size: 9px;
  line-height: 1;
  font-weight: 550;

  white-space: nowrap;
}

.full-reason-chip.reason-returning {
  background: #f0effb;
  color: #6258a4;
}

.full-reason-chip.reason-good {
  background: #edf7ef;
  color: #39764c;
}

.full-reason-chip.reason-fresh {
  background: #eaf6ee;
  color: #39764c;
}

.full-reason-chip.reason-warn {
  background: #fff3e5;
  color: #8b612b;
}

.full-reason-chip.reason-previous {
  background: #eef3f8;
  color: #50697c;
}

.full-reason-chip.reason-gap {
  background: #edf4fa;
  color: #416f8b;
}

.full-reason-chip.reason-muted {
  background: #f4f4f1;
  color: #777772;
}

/*
  The live-edit buttons occupy column 5.
  Reasons now intentionally live on their
  own full-width line instead of becoming
  a tiny sixth grid column.
*/
.full-pack-row {
  row-gap: 7px;
}

/* ===== END MKPC REASON CHIPS ===== */
`;

    fs.writeFileSync(
      cssFile,
      css,
      "utf8",
    );
  }
}

/* =========================================================
   7. KEEP LOCAL MIGRATION HISTORY
========================================================= */

const migrationDir =
  path.join(
    root,
    "supabase",
    "migrations",
  );

fs.mkdirSync(
  migrationDir,
  {
    recursive: true,
  },
);

const migrationFile =
  path.join(
    migrationDir,
    "20260916151000_delete_draft_pack_cascade.sql",
  );

if (
  !fs.existsSync(
    migrationFile,
  )
) {
  fs.writeFileSync(
    migrationFile,
    `-- Already applied to the connected Supabase project.

create or replace function public.delete_draft_pack_cascade(
  p_pack_id uuid
)
returns integer
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_status text;
  v_count integer;
begin
  if not public.is_staff() then
    raise exception 'Moderator access required';
  end if;

  select status
  into v_status
  from public.packs
  where id = p_pack_id
  for update;

  if v_status is null then
    raise exception 'Pack not found';
  end if;

  if v_status <> 'draft' then
    raise exception
      'Only draft packs can be deleted with their cards';
  end if;

  select count(*)
  into v_count
  from public.cards
  where pack_id = p_pack_id;

  delete from public.cards
  where pack_id = p_pack_id;

  delete from public.packs
  where id = p_pack_id;

  return v_count;
end;
$$;
`,
    "utf8",
  );
}

console.log("");
console.log(
  "Pack Planner polish installed.",
);
console.log(
  "✓ reroll never repeats current/recent slot idols",
);
console.log(
  "✓ reason text changed to highlighted chips",
);
console.log(
  "✓ draft pack cascade deletion enabled",
);
console.log("");