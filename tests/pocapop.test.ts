import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { cardOdds, cardTier } from "../lib/pocapop";
import { planImport } from "../lib/catalog";
import type { Catalog } from "../lib/types";
import { generatePlan } from "../lib/planner";
import { mapSheet, previewPack } from "../lib/pack-import";
import { parseWorkbook } from "../lib/workbook";

test("PocaPop migration archives legacy data, seeds exact game catalog, and protects staff workflows", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;",
    );
    await db.exec(
      (await readFile("supabase/migrations/001_catalog.sql", "utf8")).replace(
        "create extension if not exists pgcrypto;",
        "",
      ),
    );
    const admin = "00000000-0000-0000-0000-000000000001";
    await db.exec(
      `insert into auth.users values('${admin}');insert into profiles values('${admin}','admin');insert into packs(name,pack_type) values('Old MKPC Pack','Legacy');`,
    );
    await db.exec(
      await readFile(
        "supabase/migrations/20260930041925_pocapop_catalog.sql",
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        "supabase/migrations/20260930051725_pocapop_workbook_import.sql",
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        "supabase/migrations/20260930061038_pocapop_import_identity_fix.sql",
        "utf8",
      ),
    );
    const q = async (sql: string) =>
      (await db.query<Record<string, unknown>>(sql)).rows;
    assert.equal((await q("select count(*) n from cards"))[0].n, 362);
    assert.equal((await q("select count(*) n from packs"))[0].n, 10);
    assert.equal((await q("select count(*) n from profiles"))[0].n, 1);
    assert.equal(
      (
        await q(
          "select payload->'packs' as packs from vault_archive.catalog_snapshots",
        )
      )[0].packs instanceof Array,
      true,
    );
    assert.equal(
      (await q("select count(*) n from packs where name='Old MKPC Pack'"))[0].n,
      0,
    );
    assert.equal(
      (
        await q(
          "select count(*) n from rarities where numeric_value is not null",
        )
      )[0].n,
      0,
    );
    assert.equal(
      (
        await q(
          "select count(*) n from cards where game_card_id is null or image_asset_id is null",
        )
      )[0].n,
      0,
    );
    assert.equal(
      (
        await q(
          "select count(*) n from (select pack_id,sum(weight)::numeric/max(total_weight) x from pack_rarities group by pack_id having sum(weight)<>max(total_weight)) t",
        )
      )[0].n,
      0,
    );
    assert.equal(
      (
        await q(
          "select count(*) n from pack_rarities t where card_count<>(select count(*) from cards c where c.pack_id=t.pack_id and c.rarity_id=t.rarity_id)",
        )
      )[0].n,
      0,
    );
    const catalog = {} as Catalog;
    for (const table of [
      "groups",
      "idols",
      "group_memberships",
      "packs",
      "rarities",
      "cards",
      "card_idols",
      "import_history",
      "pack_rarities",
    ])
      Object.assign(catalog, { [table]: await q(`select * from ${table}`) });
    catalog.settings = { include_unreleased: true };
    if (process.env.POCAPOP_WORKBOOK_PATH) {
      const bytes = await readFile(process.env.POCAPOP_WORKBOOK_PATH);
      const sheets = parseWorkbook(
        bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ),
        "cards",
      );
      assert.deepEqual(
        sheets.map((s) => s.rows.length),
        [48, 48, 48, 48, 48, 48, 48, 0, 0],
      );
      for (const sheet of sheets.filter((s) => s.rows.length)) {
        const preview = previewPack(
          mapSheet(sheet.name, sheet.rows, catalog),
          sheet.rows,
          catalog,
        );
        assert.equal(preview.rows.length, 48);
        assert.equal(
          preview.rows.every((r) =>
            /^[0-9]{1,16}$/.test(r.image_asset_id || ""),
          ),
          true,
        );
        console.log(
          sheet.name +
            ": " +
            preview.rows.filter((r) => r.change === "Update").length +
            " updates; " +
            preview.rows.filter((r) => r.change === "Unchanged").length +
            " unchanged; " +
            preview.rows
              .filter((r) => r.change === "Add")
              .map((r) => r.idol + " / " + r.group)
              .join(", "),
        );
        console.log(
          preview.issues
            .concat(
              preview.rows.flatMap((r) =>
                r.issues.map((e) => r.idol + ": " + e),
              ),
            )
            .join("\n"),
        );
      }
    }
    const crown = catalog.cards.find(
      (c) => c.game_card_id === "HB01-SOLO-IU-001",
    )!;
    assert.equal(cardTier(crown, catalog), "Crown");
    assert.equal(cardOdds(crown, catalog), 0.1);
    const mythic = catalog.cards.find(
      (c) => c.game_card_id === "RB01-TWICE-NAYEON-001",
    )!;
    assert.equal(cardOdds(mythic, catalog), 0.02);
    const row = {
      sheet: "Moonlit Hanbok",
      row: 1,
      slot: "new",
      rarity: "Crown",
      gender: "female",
      idol: "IU",
      group: "Solo",
      pic_status: "Selected",
      source_url: "",
      notes: "",
    };
    assert.equal(planImport([row], catalog, "cards")[0].issues.length, 0);
    assert.equal(
      planImport([{ ...row, rarity: "0.05%" }], catalog, "cards")[0].issues
        .length > 0,
      true,
    );
    await db.exec(
      `set role authenticated;select set_config('request.jwt.claim.sub','${admin}',false);`,
    );
    await db.query("select commit_import($1::jsonb)", [
      JSON.stringify({
        mode: "cards",
        filename: "test",
        rows: planImport([row], catalog, "cards"),
      }),
    ]);
    await db.query("select save_card($1::jsonb)", [
      JSON.stringify({
        ...crown,
        notes: "Edited caption",
        idol_ids: catalog.card_idols
          .filter((x) => x.card_id === crown.id)
          .map((x) => x.idol_id),
      }),
    ]);
    assert.equal(
      (await q(`select image_asset_id from cards where id='${crown.id}'`))[0]
        .image_asset_id,
      crown.image_asset_id,
    );
    const female = catalog.idols
      .filter(
        (i) => i.gender === "female" && !i.game_idol_id?.endsWith("-GROUP"),
      )
      .slice(0, 12);
    const male = catalog.idols.filter((i) => i.gender === "male").slice(0, 12);
    let n = 0,
      fi = 0,
      mi = 0;
    const draftRows = catalog.rarities
      .sort((a, b) => a.sort_order - b.sort_order)
      .flatMap((r) => {
        const count =
          (
            { Rare: 10, Epic: 8, Legendary: 4, Mythic: 2 } as Record<
              string,
              number
            >
          )[r.game_key || ""] || 0;
        return Array.from({ length: count }, (_, j) => ({
          slot: String(++n),
          rarity_id: r.id,
          idol_id: j < count / 2 ? female[fi++].id : male[mi++].id,
        }));
      });
    await assert.rejects(
      () =>
        db.query("select save_pocapop_draft($1::jsonb)", [
          JSON.stringify({
            name: "Broken",
            game_pack_id: "HB02",
            pack_type: "Premium",
            rows: draftRows.map((x) => ({ ...x, idol_id: female[0].id })),
          }),
        ]),
      /equal female and male/,
    );
    await db.query("select save_pocapop_draft($1::jsonb)", [
      JSON.stringify({
        name: "New Hanbok",
        game_pack_id: "HB02",
        pack_type: "Premium",
        rows: draftRows.map((r) => ({ ...r, image_asset_id: "123456789" })),
      }),
    ]);
    assert.equal(
      (
        await q(
          "select count(*) n from cards c join packs p on p.id=c.pack_id where p.game_pack_id='HB02'",
        )
      )[0].n,
      24,
    );
    assert.equal(
      (
        await q(
          "select count(*) n from cards c join packs p on p.id=c.pack_id where p.game_pack_id='HB02' and c.image_asset_id='123456789' and c.premium_tier is not null",
        )
      )[0].n,
      24,
    );
    const plan = generatePlan(catalog, {
      kind: "Rebirth",
      mode: "balanced",
      groupLimit: 2,
      cooldown: 1,
      seed: 42,
      excluded: [],
    });
    const workbookRows = plan.map((r) => {
      const idol = catalog.idols.find((i) => i.id === r.idol_id)!;
      const group = catalog.groups.find((g) =>
        catalog.group_memberships.some(
          (m) =>
            m.idol_id === idol.id &&
            m.group_id === g.id &&
            m.membership_status === "current",
        ),
      );
      return {
        sheet: "Rebirth 8",
        row: Number(r.slot) + 4,
        slot: r.slot,
        rarity: catalog.rarities.find((t) => t.id === r.rarity_id)!.game_key!,
        gender: idol.gender,
        idol: idol.stage_name,
        group: group?.name || "",
        pic_status: "",
        source_url: "",
        notes: "",
        image_asset_id: "123456789",
      };
    });
    const mapping = {
      sheet: "Rebirth 8",
      name: "Test Rebirth",
      code: "RB08",
      type: "Rebirth" as const,
      selected: true,
    };
    let preview = previewPack(mapping, workbookRows, catalog);
    assert.deepEqual(preview.issues, []);
    assert.equal(
      preview.rows.every((r) => !r.issues.length),
      true,
    );
    const invoke = async () =>
      db.query<{
        import_pocapop_workbook: {
          created: number;
          updated: number;
          skipped: number;
        };
      }>("select import_pocapop_workbook($1::jsonb)", [
        JSON.stringify({
          filename: "test.xlsx",
          packs: [
            {
              ...mapping,
              existing_id: preview.existing_id,
              rows: preview.rows,
            },
          ],
        }),
      ]);
    assert.deepEqual((await invoke()).rows[0].import_pocapop_workbook, {
      created: 48,
      updated: 0,
      skipped: 0,
    });
    for (const table of ["packs", "cards", "card_idols"])
      Object.assign(catalog, { [table]: await q(`select * from ${table}`) });
    preview = previewPack(mapping, workbookRows, catalog);
    assert.equal(
      preview.rows.every((r) => r.change === "Unchanged"),
      true,
    );
    assert.deepEqual((await invoke()).rows[0].import_pocapop_workbook, {
      created: 0,
      updated: 0,
      skipped: 48,
    });
    preview.rows[0].image_asset_id = "987654321";
    assert.deepEqual((await invoke()).rows[0].import_pocapop_workbook, {
      created: 0,
      updated: 1,
      skipped: 47,
    });
    await assert.rejects(invoke, /Card changed/);
    preview.rows[0].existing_card_id = null;
    await assert.rejects(invoke, /silently replaced/);
    assert.equal(
      (
        await q(
          "select count(*) n from cards c join packs p on p.id=c.pack_id where p.game_pack_id='RB08'",
        )
      )[0].n,
      48,
    );
    await assert.rejects(
      () =>
        db.query("select save_pocapop_draft($1::jsonb)", [
          JSON.stringify({
            name: "Invalid slots",
            game_pack_id: "HB03",
            pack_type: "Premium",
            rows: draftRows.map((r) => ({ ...r, slot: "1" })),
          }),
        ]),
      /repeated slot/,
    );
    assert.equal(
      (await q("select count(*) n from packs where game_pack_id='HB03'"))[0].n,
      0,
    );
    await db.exec(
      "reset role;insert into auth.users values('00000000-0000-0000-0000-000000000099');set role authenticated;select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000099',false);",
    );
    await assert.rejects(
      () => db.query("select import_pocapop_workbook('{}'::jsonb)"),
      /Moderator access required/,
    );
    await assert.rejects(
      () => db.query("select save_pocapop_draft('{}'::jsonb)"),
      /Moderator access required/,
    );
    await db.exec("reset role;set role anon;");
    await assert.rejects(
      () => q("select * from pack_rarities"),
      /permission denied/,
    );
    await assert.rejects(
      () => q("select * from vault_archive.catalog_snapshots"),
      /permission denied/,
    );
    await assert.rejects(
      () => db.query("select save_pocapop_draft('{}'::jsonb)"),
      /permission denied/,
    );
    await assert.rejects(
      () => db.query("select import_pocapop_workbook('{}'::jsonb)"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
