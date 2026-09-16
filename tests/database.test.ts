import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
test("SQL migration, RLS, transactional imports, rosters, duplicates and multi-idol cards", async (t) => {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`,
  );
  const sql = (
    await readFile("supabase/migrations/001_catalog.sql", "utf8")
  ).replace("create extension if not exists pgcrypto;", "");
  await db.exec(sql);
  const admin = "00000000-0000-0000-0000-000000000001",
    mod = "00000000-0000-0000-0000-000000000002",
    outsider = "00000000-0000-0000-0000-000000000003";
  await db.exec(
    `insert into auth.users values('${admin}'),('${mod}'),('${outsider}');insert into profiles values('${admin}','admin'),('${mod}','moderator');`,
  );
  async function asUser(id: string) {
    await db.exec(
      `reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);`,
    );
  }
  async function count(table: string) {
    return Number(
      (await db.query<{ n: number }>(`select count(*) n from ${table}`)).rows[0]
        .n,
    );
  }
  const row = {
    sheet: "Rebirth 1",
    slot: "1",
    rarityValue: 5,
    idol: "Seoyeon",
    group: "tripleS",
    gender: "female",
    pic_status: "Selected",
    source_url: "https://example.com",
    notes: "test",
  };
  async function commit(rows: unknown[], mode = "cards") {
    return db.query("select commit_import($1::jsonb) result", [
      JSON.stringify({ rows, mode, filename: "test.xlsx" }),
    ]);
  }
  await t.test("anonymous cannot access or mutate catalog", async () => {
    await db.exec("set role anon");
    await assert.rejects(
      () => db.query("select * from cards"),
      /permission denied/,
    );
    await assert.rejects(() => commit([row]), /permission denied/);
  });
  await t.test(
    "authenticated users without a staff profile see no data",
    async () => {
      await asUser(outsider);
      assert.equal(await count("rarities"), 0);
      await assert.rejects(() => commit([row]), /Moderator access required/);
    },
  );
  await t.test(
    "moderator can import and groups remain unconfigured",
    async () => {
      await asUser(mod);
      await commit([row]);
      assert.equal(await count("cards"), 1);
      assert.equal(await count("idols"), 1);
      assert.equal(
        (
          await db.query<{ roster_configured: boolean }>(
            "select roster_configured from groups",
          )
        ).rows[0].roster_configured,
        false,
      );
      assert.equal(
        (await db.query<{ status: string }>("select status from packs")).rows[0]
          .status,
        "draft",
      );
    },
  );
  await t.test(
    "case-insensitive repeated import creates no duplicate",
    async () => {
      await commit([{ ...row, group: "TRIPLES", idol: "seoyeon" }]);
      assert.equal(await count("cards"), 1);
      assert.equal(await count("groups"), 1);
      assert.equal(await count("idols"), 1);
      assert.equal(
        (await db.query<{ name: string }>("select name from groups")).rows[0]
          .name,
        "tripleS",
      );
    },
  );
  await t.test(
    "different slots and rarity allow repeated artists",
    async () => {
      await commit([
        { ...row, slot: "2" },
        { ...row, slot: "3", rarityValue: 0.05 },
      ]);
      assert.equal(await count("cards"), 3);
      assert.equal(await count("idols"), 1);
    },
  );
  await t.test(
    "failed multi-row import rolls back all rows and created entities",
    async () => {
      await assert.rejects(() =>
        commit([
          { ...row, idol: "Xinyu", slot: "8" },
          { ...row, idol: "New Idol", slot: "9", rarityValue: 99 },
        ]),
      );
      assert.equal(await count("cards"), 3);
      assert.equal(await count("idols"), 1);
    },
  );
  await t.test(
    "roster creates zero-card idols and marks omitted members former",
    async () => {
      await commit(
        [
          { ...row, membership_status: "current" },
          { ...row, idol: "Hyerin", membership_status: "current" },
        ],
        "roster",
      );
      assert.equal(await count("idols"), 2);
      assert.equal(
        (
          await db.query<{ roster_configured: boolean }>(
            "select roster_configured from groups",
          )
        ).rows[0].roster_configured,
        true,
      );
      await commit(
        [{ ...row, idol: "Hyerin", membership_status: "current" }],
        "roster",
      );
      assert.equal(
        (
          await db.query<{ membership_status: string }>(
            "select m.membership_status from group_memberships m join idols i on i.id=m.idol_id where i.stage_name='Seoyeon'",
          )
        ).rows[0].membership_status,
        "former",
      );
      assert.equal(await count("cards"), 3);
    },
  );
  await t.test(
    "moderator cannot change rarity or promote own role",
    async () => {
      await assert.rejects(
        () =>
          db.query("insert into rarities(label,numeric_value) values('9%',9)"),
        /row-level security/,
      );
      await db.query("update profiles set role='admin'");
      assert.equal(
        (
          await db.query<{ role: string }>(
            "select role from profiles where id=$1",
            [mod],
          )
        ).rows[0].role,
        "moderator",
      );
    },
  );
  await t.test(
    "multi-idol and whole-group cards save without fake idols",
    async () => {
      const pid = (await db.query<{ id: string }>("select id from packs"))
        .rows[0].id;
      const rid = (
        await db.query<{ id: string }>("select id from rarities limit 1")
      ).rows[0].id;
      const gid = (await db.query<{ id: string }>("select id from groups"))
        .rows[0].id;
      const ids = (
        await db.query<{ id: string }>("select id from idols")
      ).rows.map((i) => i.id);
      await db.query("select save_card($1::jsonb)", [
        JSON.stringify({
          pack_id: pid,
          rarity_id: rid,
          group_id: gid,
          slot: "20",
          idol_ids: ids,
        }),
      ]);
      await db.query("select save_card($1::jsonb)", [
        JSON.stringify({
          pack_id: pid,
          rarity_id: rid,
          group_id: gid,
          slot: "21",
          idol_ids: [],
        }),
      ]);
      assert.equal(await count("cards"), 5);
      assert.equal(await count("card_idols"), 5);
      assert.equal(await count("idols"), 2);
      await assert.rejects(
        () =>
          db.query("select save_card($1::jsonb)", [
            JSON.stringify({
              pack_id: pid,
              rarity_id: rid,
              group_id: gid,
              slot: "20",
              idol_ids: ids,
            }),
          ]),
        /exact duplicate/,
      );
    },
  );
  await t.test("admin can configure additional rarities", async () => {
    await asUser(admin);
    await db.query("insert into rarities(label,numeric_value) values('9%',9)");
    assert.equal(await count("rarities"), 7);
  });
  await db.close();
});
