import { test } from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import {
  normalize,
  rarityNumber,
  packInfo,
  coverage,
  planImport,
  cardExport,
} from "../lib/catalog";
import { parseWorkbook, exportWorkbook } from "../lib/workbook";
import { emptyCatalog, type Catalog, type ImportRow } from "../lib/types";
export function fixture(): Catalog {
  return {
    ...structuredClone(emptyCatalog),
    groups: [
      {
        id: "g",
        name: "tripleS",
        normalized_name: "triples",
        status: "active",
        roster_configured: false,
      },
    ],
    idols: [
      {
        id: "a",
        stage_name: "Seoyeon",
        normalized_name: "seoyeon",
        gender: "female",
        active: true,
      },
      {
        id: "b",
        stage_name: "Hyerin",
        normalized_name: "hyerin",
        gender: "female",
        active: true,
      },
      {
        id: "f",
        stage_name: "Former",
        normalized_name: "former",
        gender: "female",
        active: true,
      },
    ],
    group_memberships: [
      { id: "ma", group_id: "g", idol_id: "a", membership_status: "current" },
      { id: "mb", group_id: "g", idol_id: "b", membership_status: "current" },
      { id: "mf", group_id: "g", idol_id: "f", membership_status: "former" },
    ],
    packs: [
      {
        id: "p",
        name: "Rebirth 1",
        pack_type: "Rebirth",
        pack_number: 1,
        release_date: null,
        status: "released",
        notes: null,
      },
      {
        id: "d",
        name: "Rebirth 2",
        pack_type: "Rebirth",
        pack_number: 2,
        release_date: null,
        status: "draft",
        notes: null,
      },
    ],
    rarities: [
      {
        id: "r",
        label: "5.00%",
        numeric_value: 5,
        sort_order: 0,
        active: true,
      },
    ],
    cards: [
      {
        id: "c",
        pack_id: "p",
        rarity_id: "r",
        group_id: "g",
        slot: "1",
        pic_status: "Selected",
        source_url: "https://example.com/photo",
        notes: "Source note",
        card_name: null,
      },
      {
        id: "draft",
        pack_id: "d",
        rarity_id: "r",
        group_id: "g",
        slot: "1",
        pic_status: "Selected",
        source_url: null,
        notes: null,
        card_name: null,
      },
    ],
    card_idols: [
      { card_id: "c", idol_id: "a" },
      { card_id: "draft", idol_id: "b" },
    ],
  };
}
const row: ImportRow = {
  sheet: "Rebirth 1",
  row: 2,
  slot: "1",
  rarity: "5%",
  gender: "female",
  idol: "Seoyeon",
  group: "TripleS",
  pic_status: "Selected",
  source_url: "",
  notes: "",
};
test("normalizes whitespace/case while preserving artist distinctions", () => {
  assert.equal(normalize("  TripleS\u00a0 "), "triples");
  assert.notEqual(normalize("Jin"), normalize("Jin Young"));
  assert.equal(rarityNumber("0.05%"), 0.05);
  assert.equal(rarityNumber("wat"), null);
  assert.deepEqual(packInfo("Rebirth 12"), {
    name: "Rebirth 12",
    pack_type: "Rebirth",
    pack_number: 12,
  });
});
test("unconfigured roster never claims coverage or missing members", () => {
  const d = fixture();
  const c = coverage(d.groups[0], d);
  assert.equal(c.total, null);
  assert.equal(c.missing, null);
  assert.equal(c.percentage, null);
  assert.equal(c.represented, 1);
});
test("coverage excludes draft appearances and former members", () => {
  const d = fixture();
  d.groups[0].roster_configured = true;
  let c = coverage(d.groups[0], d);
  assert.equal(c.total, 2);
  assert.equal(c.percentage, 50);
  assert.equal(c.missing?.[0].idol_id, "b");
  d.settings.include_unreleased = true;
  c = coverage(d.groups[0], d);
  assert.equal(c.percentage, 100);
  assert.equal(c.missing?.length, 0);
});
test("exact duplicate is skipped but repeated idol in another slot is allowed", () => {
  const p = planImport(
    [row, { ...row, slot: "2" }, { ...row, slot: "2" }],
    fixture(),
    "cards",
  );
  assert.equal(p[0].duplicate, true);
  assert.equal(p[0].newGroup, false);
  assert.equal(p[0].existingIdol, "a");
  assert.equal(p[1].duplicate, false);
  assert.equal(p[2].duplicate, true);
});
test("same stage name in another group requires resolution", () => {
  const p = planImport(
    [{ ...row, group: "Other Group" }],
    fixture(),
    "cards",
  )[0];
  assert.ok(p.issues.some((s) => s.includes("Ambiguous")));
});
test("unknown rarity and unsafe source are invalid", () => {
  const p = planImport(
    [{ ...row, rarity: "9.9%", source_url: "javascript:alert(1)" }],
    fixture(),
    "cards",
  )[0];
  assert.equal(p.issues.length, 2);
});
test("roster preview supports zero-card idols without altering the catalog", () => {
  const d = fixture();
  const p = planImport(
    [{ ...row, idol: "Xinyu", membership_status: "current" }],
    d,
    "roster",
  );
  assert.equal(p[0].newIdol, true);
  assert.equal(p[0].issues.length, 0);
  assert.equal(d.groups[0].roster_configured, false);
  assert.equal(d.idols.length, 3);
});
test("workbook parsing handles title rows, percent number formats, hyperlinks, and non-pack sheets", () => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ["Card planning"],
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
    [1, 0.05, "F", "Seoyeon", "TripleS", "Selected", "Photo", "Example"],
    [],
    [2, "0.05%", "M", "Example Idol", "Soloist", "To Find", "", ""],
  ]);
  ws.B4.z = "0.00%";
  ws.G4.l = { Target: "https://example.com/photo" };
  XLSX.utils.book_append_sheet(wb, ws, "Rebirth 12");
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([["Readme"]]),
    "Instructions",
  );
  const parsed = parseWorkbook(
    XLSX.write(wb, { type: "array", bookType: "xlsx" }),
    "cards",
  );
  assert.equal(parsed[0].rows[0].rarity, "5%");
  assert.equal(parsed[0].rows[0].source_url, "https://example.com/photo");
  assert.equal(parsed[0].rows[0].gender, "female");
  assert.equal(parsed[0].rows[1].rarity, "0.05%");
  assert.equal(parsed[0].rows[1].group, "");
  assert.equal(parsed[0].rows[0].row, 4);
  assert.ok(parsed[1].error);
});
test("roster CSV parsing accepts membership_status aliases", () => {
  const bytes = new TextEncoder().encode(
    "group,idol,gender,membership_status\ntripleS,Hyerin,female,current\ntripleS,Former,female,former",
  );
  const p = parseWorkbook(bytes.buffer, "roster");
  assert.equal(p[0].rows[1].membership_status, "former");
  assert.equal(p[0].rows[0].idol, "Hyerin");
});
test("multi-idol export remains one row and preserves notes and URLs", () => {
  const d = fixture();
  d.card_idols.push({ card_id: "c", idol_id: "b" });
  const rows = cardExport([d.cards[0]], d);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].Idol, "Seoyeon x Hyerin");
  const bytes = exportWorkbook(rows);
  const wb = XLSX.read(bytes, { type: "array" });
  const back = XLSX.utils.sheet_to_json(wb.Sheets.Cards);
  assert.deepEqual(back, rows);
});
