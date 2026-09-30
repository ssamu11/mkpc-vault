import { test } from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { emptyCatalog, type Catalog, type ImportRow } from "../lib/types";
import { parseWorkbook } from "../lib/workbook";
import { mapSheet, previewPack } from "../lib/pack-import";
import { generatePlan, plannerPool, type PlannerOptions } from "../lib/planner";
import { tierKeys } from "../lib/pocapop";

function fixture(): Catalog {
  const data: Catalog = structuredClone(emptyCatalog);
  data.rarities = tierKeys.map((key, i) => ({
    id: "tier" + i,
    label: key,
    game_key: key,
    sort_order: i,
    numeric_value: null,
    active: true,
  }));
  for (const gender of ["female", "male"])
    for (let i = 0; i < 80; i++) {
      const id = gender + i,
        group = gender + "group" + Math.floor(i / 4);
      if (!data.groups.some((g) => g.id === group))
        data.groups.push({
          id: group,
          name: group,
          normalized_name: group,
          status: "active",
          roster_configured: true,
          game_group_id: "GROUP-" + group,
        });
      data.idols.push({
        id,
        stage_name: id,
        normalized_name: id,
        gender,
        active: true,
        game_idol_id: "IDOL-" + id,
      });
      data.group_memberships.push({
        id,
        group_id: group,
        idol_id: id,
        membership_status: "current",
      });
    }
  data.idols.push({
    id: "group-card",
    stage_name: "Group",
    normalized_name: "group",
    gender: "female",
    active: true,
    game_idol_id: "IDOL-TEST-GROUP",
  });
  return data;
}
const options: PlannerOptions = {
  kind: "Rebirth",
  mode: "balanced",
  groupLimit: 2,
  cooldown: 1,
  seed: 123,
  excluded: [],
};
function rowsFor(data: Catalog): ImportRow[] {
  return generatePlan(data, options).map((r) => {
    const artist = data.idols.find((i) => i.id === r.idol_id)!;
    const group = data.groups.find((g) =>
      data.group_memberships.some(
        (m) => m.idol_id === artist.id && m.group_id === g.id,
      ),
    )!;
    return {
      sheet: "Rebirth 8",
      row: Number(r.slot) + 4,
      slot: r.slot,
      rarity: data.rarities.find((t) => t.id === r.rarity_id)!.game_key!,
      gender: r.gender,
      idol: artist.stage_name,
      group: group.name,
      pic_status: "",
      source_url: "",
      notes: "",
      image_asset_id: "139873489567145",
    };
  });
}
test("Workbook reads B4 headers, exact numeric IDs, and excludes empty templates", () => {
  const wb = XLSX.utils.book_new(),
    ws = XLSX.utils.aoa_to_sheet([]);
  XLSX.utils.sheet_add_aoa(ws, [["REBIRTH 6"]], { origin: "B2" });
  XLSX.utils.sheet_add_aoa(
    ws,
    [
      [
        "Slot",
        "Rarity",
        "Gender",
        "Idol Name",
        "Group Name",
        "Idol ID",
        "Group ID",
        "Card ID",
        "Image Asset ID",
        "Notes",
      ],
      [
        1,
        "Mythic",
        "Female",
        "Nayeon",
        "TWICE",
        "",
        "",
        "",
        139873489567145,
        "",
      ],
      [2, "Mythic", "Male", "", "", "", "", "", "", ""],
    ],
    { origin: "B4" },
  );
  ws.J5.z = "0.00E+00";
  XLSX.utils.book_append_sheet(wb, ws, "Rebirth 8");
  const parsed = parseWorkbook(
    XLSX.write(wb, { type: "array", bookType: "xlsx" }),
    "cards",
  );
  assert.equal(parsed[0].rows.length, 1);
  assert.equal(parsed[0].rows[0].row, 5);
  assert.equal(parsed[0].rows[0].image_asset_id, "139873489567145");
  assert.equal(parsed[0].rows[0].gender, "female");
  assert.equal(
    mapSheet(parsed[0].name, parsed[0].rows, fixture()).code,
    "RB08",
  );
});
test("New full sheets preview additions; duplicate artists and bad IDs block import", () => {
  const data = fixture(),
    rows = rowsFor(data),
    mapping = { ...mapSheet("Rebirth 8", rows, data), name: "Afterglow" };
  const preview = previewPack(mapping, rows, data);
  assert.deepEqual(preview.issues, []);
  assert.equal(
    preview.rows.every((r) => !r.issues.length && r.change === "Add"),
    true,
  );
  const bad = previewPack(
    mapping,
    rows.map((r, i) =>
      i === 1 ? { ...rows[0], slot: "2", image_asset_id: "1.39E+14" } : r,
    ),
    data,
  );
  assert.match(bad.rows[1].issues.join(" "), /already appears/);
  assert.match(bad.rows[1].issues.join(" "), /exact digits/);
});
test("Existing sheets match PackID and artist, not local slot; imports are idempotent", () => {
  const data = fixture(),
    rows = rowsFor(data);
  data.packs.push({
    id: "existing",
    name: "Adrenaline",
    game_pack_id: "RB01",
    pack_type: "Rebirth",
    pack_number: 1,
    release_date: null,
    status: "ready",
    notes: null,
  });
  for (const [i, r] of rows.entries()) {
    const idol = data.idols.find((a) => a.stage_name === r.idol)!;
    data.cards.push({
      id: "card" + i,
      pack_id: "existing",
      rarity_id: data.rarities.find((t) => t.game_key === r.rarity)!.id,
      slot: String(313 + i),
      image_asset_id: r.image_asset_id,
      game_card_id: "RB01-" + i,
      updated_at: "2026-09-30T00:00:00Z",
      card_name: null,
      group_id: null,
      pic_status: "Selected",
      source_url: null,
      notes: null,
    });
    data.card_idols.push({ card_id: "card" + i, idol_id: idol.id });
  }
  const mapping = mapSheet("Rebirth 1", rows, data);
  assert.equal(mapping.name, "Adrenaline");
  const preview = previewPack(mapping, rows, data);
  assert.deepEqual(preview.issues, []);
  assert.equal(
    preview.rows.every((r) => r.change === "Unchanged"),
    true,
  );
  assert.equal(
    previewPack(
      mapping,
      rows.map((r, i) => (i === 0 ? { ...r, image_asset_id: "123456789" } : r)),
      data,
    ).rows[0].change,
    "Update",
  );
  assert.equal(
    previewPack(
      mapping,
      rows.map((r, i) => (i === 0 ? { ...r, idol: "new artist" } : r)),
      data,
    ).issues.length > 0,
    true,
  );
});
test("Planner enforces six tiers, equal genders, unique artists and group diversity", () => {
  const data = fixture(),
    rows = generatePlan(data, options);
  assert.equal(rows.length, 48);
  assert.equal(new Set(rows.map((r) => r.idol_id)).size, 48);
  for (const [i, n] of [18, 12, 8, 6, 2, 2].entries())
    for (const gender of ["female", "male"])
      assert.equal(
        rows.filter((r) => r.rarity_id === "tier" + i && r.gender === gender)
          .length,
        n / 2,
      );
  const pool = plannerPool(data),
    groups = new Map<string, number>();
  rows.forEach((r) => {
    const key = pool.find((p) => p.idol.id === r.idol_id)!.key;
    groups.set(key, (groups.get(key) || 0) + 1);
  });
  assert.equal(
    [...groups.values()].every((n) => n <= 2),
    true,
  );
  assert.equal(
    rows.some((r) => r.idol_id === "group-card"),
    false,
  );
  assert.deepEqual(generatePlan(data, options), rows);
  assert.notDeepEqual(generatePlan(data, { ...options, seed: 321 }), rows);
});
test("Planner preserves locks, respects exclusions and fails explicitly when impossible", () => {
  const data = fixture(),
    rows = generatePlan(data, options);
  const locked = { ...rows[0], locked: true, image_asset_id: "1234" };
  const again = generatePlan(
    data,
    { ...options, seed: 456, excluded: [rows[1].idol_id] },
    [locked],
  );
  assert.deepEqual(again[0], locked);
  assert.equal(
    again.some((r) => r.idol_id === rows[1].idol_id),
    false,
  );
  assert.throws(
    () =>
      generatePlan(data, { ...options, excluded: data.idols.map((i) => i.id) }),
    /No eligible/,
  );
  assert.throws(
    () =>
      generatePlan(data, { ...options, excluded: [locked.idol_id] }, [locked]),
    /locked slot/,
  );
});
test("Premium composition and latest-pack cooldown remain hard constraints", () => {
  const data = fixture(),
    plan = generatePlan(data, options);
  data.packs.push({
    id: "latest",
    game_pack_id: "RB07",
    name: "Ditto",
    pack_type: "Rebirth",
    pack_number: 7,
    status: "ready",
    release_date: null,
    notes: null,
  });
  data.cards.push({
    id: "lastcard",
    pack_id: "latest",
    rarity_id: plan[0].rarity_id,
    slot: "1",
    card_name: null,
    group_id: null,
    pic_status: null,
    source_url: null,
    notes: null,
  });
  data.card_idols.push({ card_id: "lastcard", idol_id: plan[0].idol_id });
  const premium = generatePlan(data, { ...options, kind: "Premium" });
  assert.equal(premium.length, 24);
  assert.equal(
    premium.some((r) => r.idol_id === plan[0].idol_id),
    false,
  );
  for (const [i, n] of [0, 0, 10, 8, 4, 2].entries())
    assert.equal(premium.filter((r) => r.rarity_id === "tier" + i).length, n);
  assert.throws(
    () => generatePlan(data, options, [{ ...plan[0], locked: true }]),
    /cooldown/,
  );
});
