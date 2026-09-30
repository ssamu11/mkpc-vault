import { test } from "node:test";
import assert from "node:assert/strict";
import { discoveryPool, type ReferenceRoster } from "../lib/planner-discovery";
import { generatePlan } from "../lib/planner";
import { emptyCatalog } from "../lib/types";
import { tierKeys } from "../lib/pocapop";
import { groupPopularity } from "../lib/planner-curation";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

function fixture() {
  const data = structuredClone(emptyCatalog);
  data.rarities = tierKeys.map((key, i) => ({ id: key, label: key, game_key: key, numeric_value: null, sort_order: i, active: true }));
  const ref: ReferenceRoster = { artists: [], groups: [], memberships: [], artistLinks: [], groupLinks: [], aliases: [] };
  const names = ["TWICE", "BLACKPINK", "IVE", "aespa", "Red Velvet", "ITZY", "BTS", "EXO", "SHINee", "Stray Kids", "ENHYPEN", "ATEEZ", "CSR", "AIMERS"];
  names.forEach((name, g) => {
    ref.groups.push({ kpopping_group_id: `g${g}`, name, group_type: g < 6 || g === 12 ? "girl_group" : "boy_group", entity_type: "human", status: "active", is_subunit: false });
    for (let n = 0; n < 8; n++) {
      const id = `a${g}_${n}`;
      ref.artists.push({ kpopping_artist_id: id, stage_name: `${name} artist ${n}`, normalized_name: `${name} artist ${n}`.toLowerCase(), status: "active", kpopping_url: null });
      ref.memberships.push({ kpopping_membership_id: id, kpopping_artist_id: id, kpopping_group_id: `g${g}`, role: "member", leave_date: null });
    }
  });
  return { data, ref };
}
test("Reference roster exposes real new artists without creating local catalog rows", () => {
  const { data, ref } = fixture();
  const pool = discoveryPool(data, ref);
  assert.equal(pool.length, 112);
  assert.equal(pool.every((c) => c.source === "reference" && !c.released), true);
  const rows = generatePlan(data, { kind: "Rebirth", mode: "balanced", groupLimit: 4, cooldown: 1, seed: 5, excluded: [], newPercent: 75 }, [], pool);
  assert.equal(rows.length, 48);
  assert.equal(data.idols.length, 0);
  assert.equal(rows.every((r) => r.reason === "New to PocaPop"), true);
});
test("Unreviewed groups, unknown genders and former memberships cannot slip into generation", () => {
  const { data, ref } = fixture();
  ref.groups[0].name = "Unreviewed obscure project";
  ref.groups[1].group_type = "co_ed";
  ref.memberships[16].leave_date = "2025-01-01";
  const pool = discoveryPool(data, ref);
  assert.equal(pool.length, 95);
  assert.equal(pool.some((c) => c.reference_group_id === "g0" || c.reference_group_id === "g1" || c.reference_artist_id === "a2_0"), false);
  assert.equal(groupPopularity("Never reviewed"), null);
  assert.equal(groupPopularity("CSR"), "nugu");
});
test("Confirmed aliases and overlapping groups reuse one local identity and released history", () => {
  const { data, ref } = fixture();
  data.groups.push({ id: "local-group", name: "TWICE", normalized_name: "twice", status: "active", roster_configured: false });
  data.idols.push({ id: "local-idol", stage_name: "Local display alias", normalized_name: "local display alias", gender: "female", active: true });
  data.group_memberships.push({ id: "membership", idol_id: "local-idol", group_id: "local-group", membership_status: "current" });
  ref.artistLinks.push({ idol_id: "local-idol", kpopping_artist_id: "a0_0", confirmed: true });
  ref.groupLinks.push({ group_id: "local-group", kpopping_group_id: "g0", confirmed: true });
  ref.memberships.push({ kpopping_membership_id: "overlap", kpopping_artist_id: "a0_0", kpopping_group_id: "g1", role: "member", leave_date: null });
  data.packs.push({ id: "released", name: "Adrenaline", pack_type: "Rebirth", pack_number: 1, status: "released", release_date: null, notes: null });
  data.cards.push({ id: "card", pack_id: "released", rarity_id: "Rare", slot: "1", card_name: null, group_id: "local-group", pic_status: null, source_url: null, notes: null });
  data.card_idols.push({ card_id: "card", idol_id: "local-idol" });
  const pool = discoveryPool(data, ref);
  assert.equal(pool.filter((c) => c.reference_artist_id === "a0_0").length, 1);
  const artist = pool.find((c) => c.idol.id === "local-idol")!;
  assert.equal(artist.idol.stage_name, "Local display alias");
  assert.equal(artist.released, 1);
  assert.equal(artist.source, "local");
});
test("Draft-only artists remain new; minimum new quota cannot fall back to an old-only pack", () => {
  const { data, ref } = fixture();
  const pool = discoveryPool(data, ref).map((c, i) => ({ ...c, released: i % 3 === 0 ? 1 : 0, pending: i % 3 === 1 ? 1 : 0 }));
  const options = { kind: "Rebirth" as const, mode: "balanced" as const, groupLimit: 4, cooldown: 0, seed: 1, excluded: [], newPercent: 75 };
  const rows = generatePlan(data, options, [], pool);
  for (const gender of ["female", "male"]) assert.ok(rows.filter((r) => r.gender === gender && !pool.find((p) => p.idol.id === r.idol_id)!.released).length >= 18);
  assert.throws(() => generatePlan(data, options, [], pool.map((c) => ({ ...c, released: 1 }))), /Not enough new/);
  assert.equal(generatePlan(data, { ...options, newPercent: 0 }, [], pool).length, 48);
});
test("Unconfirmed surname variants are withheld instead of advertised as new", () => {
  const { data, ref } = fixture();
  data.groups.push({ id: "local-group", name: "TWICE", normalized_name: "twice", status: "active", roster_configured: false });
  data.idols.push({ id: "local-idol", stage_name: "Yujin", normalized_name: "yujin", gender: "female", active: true });
  data.group_memberships.push({ id: "membership", idol_id: "local-idol", group_id: "local-group", membership_status: "current" });
  ref.artists[0].stage_name = "Choi Yujin";
  const pool = discoveryPool(data, ref);
  assert.equal(pool.some((p) => p.reference_artist_id === ref.artists[0].kpopping_artist_id), false);
  assert.equal(pool.some((p) => p.idol.id === "local-idol"), true);
});
test("Canonical group abbreviations do not create duplicate TXT identities", () => {
  const { data, ref } = fixture();
  ref.groups[6].name = "TOMORROW X TOGETHER";
  ref.artists[48].stage_name = "Yeonjun";
  data.groups.push({ id: "txt", name: "TXT", normalized_name: "txt", status: "active", roster_configured: false });
  data.idols.push({ id: "yeonjun", stage_name: "Yeonjun", normalized_name: "yeonjun", gender: "male", active: true });
  data.group_memberships.push({ id: "member", group_id: "txt", idol_id: "yeonjun", membership_status: "current" });
  const pool = discoveryPool(data, ref);
  assert.equal(pool.filter((c) => c.idol.stage_name === "Yeonjun").length, 1);
  assert.equal(pool.find((c) => c.idol.stage_name === "Yeonjun")!.idol.id, "yeonjun");
  assert.equal(pool.find((c) => c.reference_artist_id === ref.artists[49].kpopping_artist_id)!.group!.name, "TXT");
});
test("Moderator saves reference artists atomically, reuses identities, and nonstaff cannot write", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;");
    for (const file of ["001_catalog.sql", "20260930041925_pocapop_catalog.sql", "20260930051725_pocapop_workbook_import.sql", "20260930061038_pocapop_import_identity_fix.sql"])
      await db.exec((await readFile(`supabase/migrations/${file}`, "utf8")).replace("create extension if not exists pgcrypto;", ""));
    await db.exec(`
      create table kpopping_artists(kpopping_artist_id text primary key,stage_name text);
      create table kpopping_groups(kpopping_group_id text primary key,name text,group_type text,entity_type text,status text);
      create table kpopping_memberships(kpopping_membership_id text primary key,kpopping_artist_id text,kpopping_group_id text,leave_date date,role text);
      create table idol_kpopping_links(idol_id uuid primary key references idols,kpopping_artist_id text references kpopping_artists,match_method text,confirmed boolean);
      create table group_kpopping_links(group_id uuid primary key references groups,kpopping_group_id text references kpopping_groups,match_method text,confirmed boolean);
      alter table idol_kpopping_links enable row level security;
      alter table group_kpopping_links enable row level security;
      create policy staff_read on idol_kpopping_links for select to authenticated using(is_staff());
      create policy staff_read on group_kpopping_links for select to authenticated using(is_staff());
      grant select on kpopping_artists,kpopping_groups,kpopping_memberships,idol_kpopping_links,group_kpopping_links to authenticated;
    `);
    await db.exec(await readFile("supabase/migrations/20260930070816_pocapop_discovery_planner.sql", "utf8"));
    await db.exec(await readFile("supabase/migrations/20260930073350_pocapop_planner_group_aliases.sql", "utf8"));
    const { data, ref } = fixture();
    data.rarities = (await db.query<(typeof data.rarities)[number]>("select * from rarities")).rows;
    ref.groups[6].name = "TOMORROW X TOGETHER";
    for (const g of ref.groups) await db.query("insert into kpopping_groups values($1,$2,$3,$4,$5)", [g.kpopping_group_id,g.name,g.group_type,g.entity_type,g.status]);
    for (const a of ref.artists) await db.query("insert into kpopping_artists values($1,$2)", [a.kpopping_artist_id,a.stage_name]);
    for (const m of ref.memberships) await db.query("insert into kpopping_memberships values($1,$2,$3,$4,$5)", [m.kpopping_membership_id,m.kpopping_artist_id,m.kpopping_group_id,m.leave_date,m.role]);
    const mod = "00000000-0000-0000-0000-000000000099";
    await db.exec(`insert into auth.users values('${mod}');insert into profiles values('${mod}','moderator');set role authenticated;select set_config('request.jwt.claim.sub','${mod}',false);`);
    const pool = discoveryPool(data, ref);
    const options = { kind: "Premium" as const, mode: "balanced" as const, groupLimit: 4, cooldown: 0, seed: 1, excluded: [], newPercent: 75 };
    const plan = generatePlan(data, options, [], pool);
    const aliasArtist = pool.find((p) => p.reference_group_id === "g6" && !plan.some((r) => r.idol_id === p.idol.id))!;
    plan.find((r) => r.gender === "male")!.idol_id = aliasArtist.idol.id;
    function payload(rows: typeof plan, code: string) {
      return { name: `Discovery ${code}`, game_pack_id: code, pack_type: "Premium", rows: rows.map((r) => {
        const c = pool.find((p) => p.idol.id === r.idol_id)!;
        return { ...r, idol_id: "", new_artist: { kpopping_artist_id: c.reference_artist_id, kpopping_group_id: c.reference_group_id, stage_name: c.idol.stage_name, group_name: c.reference_group_id === "g6" ? "TXT" : c.group?.name, gender: c.idol.gender } };
      }) };
    }
    const count = async (table: string) => Number((await db.query<{ n: number }>(`select count(*) n from ${table}`)).rows[0].n);
    const before = await count("idols");
    await db.query("select save_pocapop_discovery_draft($1::jsonb)", [JSON.stringify(payload(plan, "HB98"))]);
    assert.equal(await count("idols"), before + 24);
    assert.equal(await count("idol_kpopping_links"), 24);
    assert.equal((await db.query("select * from groups where name='TOMORROW X TOGETHER'")).rows.length, 0);
    await db.query("select save_pocapop_discovery_draft($1::jsonb)", [JSON.stringify(payload(plan, "HB99"))]);
    assert.equal(await count("idols"), before + 24);
    const different = generatePlan(data, { ...options, excluded: plan.map((r) => r.idol_id) }, [], pool);
    const invalid = payload(different, "HB97");
    invalid.rows[23].image_asset_id = "not-an-asset";
    await assert.rejects(() => db.query("select save_pocapop_discovery_draft($1::jsonb)", [JSON.stringify(invalid)]), /Invalid image/);
    assert.equal(await count("idols"), before + 24);
    assert.equal(await count("idol_kpopping_links"), 24);
    assert.equal((await db.query("select * from packs where game_pack_id='HB97'")).rows.length, 0);
    await db.exec("reset role;set role anon");
    await assert.rejects(() => db.query("select save_pocapop_discovery_draft('{}'::jsonb)"), /permission denied/);
    await db.exec("reset role;set role authenticated;select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000098',false)");
    await assert.rejects(() => db.query("select save_pocapop_discovery_draft('{}'::jsonb)"), /Moderator access required/);
  } finally { await db.close(); }
});
