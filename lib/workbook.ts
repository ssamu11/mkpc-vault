import * as XLSX from "xlsx";
import { clean, normalize } from "./catalog";
import type { ImportRow } from "./types";
const aliases: Record<string, string[]> = {
  game_pack_id: ["pack id", "packid", "game pack id"],
  pack_name: ["pack name", "pack"],
  game_idol_id: ["idol id", "idolid", "game idol id"],
  game_group_id: ["group id", "groupid", "game group id"],
  game_card_id: ["card id", "cardid", "game card id"],
  image_asset_id: ["image asset id", "imageassetid", "image asset", "asset id"],
  slot: ["slot", "slot no", "slot number", "no"],
  rarity: ["rarity", "rarity %", "chance", "drop rate"],
  gender: ["gender", "sex"],
  idol: ["idol", "idol name", "stage name", "member"],
  group: ["group", "group / act", "group/act", "act", "group name"],
  pic_status: ["pic status", "picture status", "photo status"],
  source_url: [
    "source",
    "source url",
    "source / pinterest url",
    "source/pinterest url",
    "pinterest",
    "pinterest url",
    "url",
  ],
  notes: ["notes", "note"],
  membership_status: [
    "membership_status",
    "membership status",
    "member status",
  ],
};
const key = (s: unknown) =>
  normalize(s)
    .replace(/[_\n]+/g, " ")
    .replace(/\s*\/\s*/g, " / ");
export type ParsedSheet = {
  name: string;
  rows: ImportRow[];
  error: string | null;
  skipped: number;
};
export function parseWorkbook(
  buffer: ArrayBuffer,
  mode: "cards" | "roster",
): ParsedSheet[] {
  const wb = XLSX.read(buffer, {
    type: "array",
    cellNF: true,
    cellText: true,
    cellDates: false,
  });
  if (wb.SheetNames.length > 200)
    throw Error(
      "This workbook has more than 200 sheets. Split it before importing.",
    );
  return wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name];
    const offset = XLSX.utils.decode_range(ws["!ref"] || "A1").s;
    const data = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      raw: true,
      defval: "",
    });
    const hi = data
      .slice(0, 30)
      .findIndex(
        (row) =>
          row.some((v) => aliases.idol.some((a) => key(a) === key(v))) &&
          row.some((v) =>
            (mode === "cards" ? aliases.rarity : aliases.group).some(
              (a) => key(a) === key(v),
            ),
          ),
      );
    if (hi < 0)
      return {
        name,
        rows: [],
        error:
          "No recognizable header found in the first 30 rows. Expected Idol and " +
          (mode === "cards" ? "Rarity" : "Group") +
          ".",
        skipped: 0,
      };
    const columns: Record<string, number> = {};
    data[hi].forEach((v, i) => {
      const found = Object.entries(aliases).find(([, values]) =>
        values.some((a) => key(a) === key(v)),
      );
      if (found) columns[found[0]] = i;
    });
    let skipped = 0;
    const rows: ImportRow[] = [];
    for (let index = hi + 1; index < data.length; index++) {
      const row = data[index];
      if (!row.some((v) => clean(v))) {
        skipped++;
        continue;
      }
      // Repeated header bands are not data rows.
      if (
        key(row[columns.idol]) === "idol" &&
        key(row[columns.rarity]) === "rarity"
      ) {
        skipped++;
        continue;
      }
      const get = (field: string) =>
        columns[field] === undefined ? "" : clean(row[columns[field]]);
      const id = (field: string) => {
        const value = row[columns[field]];
        return typeof value === "number" && !Number.isSafeInteger(value)
          ? "INVALID_NUMERIC_ID"
          : get(field);
      };
      if (
        mode === "cards" &&
        !get("idol") &&
        !get("group") &&
        !id("game_idol_id") &&
        !id("image_asset_id") &&
        !id("game_card_id") &&
        !get("notes")
      ) {
        skipped++;
        continue;
      }
      let rarity = get("rarity");
      const cell =
        columns.rarity === undefined
          ? undefined
          : ws[
              XLSX.utils.encode_cell({
                r: index + offset.r,
                c: columns.rarity + offset.c,
              })
            ];
      if (cell?.t === "n" && typeof cell.z === "string" && cell.z.includes("%"))
        rarity = String(Number(cell.v) * 100) + "%";
      let source = get("source_url");
      const sourceCell =
        columns.source_url === undefined
          ? undefined
          : ws[
              XLSX.utils.encode_cell({
                r: index + offset.r,
                c: columns.source_url + offset.c,
              })
            ];
      if (sourceCell?.l?.Target) source = sourceCell.l.Target;
      const genderMap: Record<string, string> = {
        f: "female",
        m: "male",
        female: "female",
        male: "male",
        girl: "female",
        boy: "male",
      };
      rows.push({
        sheet: name,
        row: index + offset.r + 1,
        game_pack_id: id("game_pack_id"),
        pack_name: get("pack_name"),
        game_idol_id: id("game_idol_id"),
        game_group_id: id("game_group_id"),
        game_card_id: id("game_card_id"),
        image_asset_id: id("image_asset_id"),
        slot: get("slot"),
        rarity,
        gender:
          genderMap[normalize(get("gender"))] ||
          normalize(get("gender")) ||
          "unknown",
        idol: get("idol"),
        group: ["solo", "soloist", "—", "-"].includes(normalize(get("group")))
          ? ""
          : get("group"),
        pic_status: get("pic_status"),
        source_url: source,
        notes: get("notes"),
        membership_status: normalize(get("membership_status")) || "current",
      });
      if (rows.length > 10000)
        throw Error(
          "A sheet exceeds 10,000 rows. Split this workbook before importing.",
        );
    }
    return { name, rows, error: null, skipped };
  });
}
export function exportWorkbook(
  rows: Record<string, unknown>[],
  sheet = "Cards",
) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(
    rows.length ? rows : [{ Message: "No matching records" }],
  );
  ws["!cols"] = Object.keys(rows[0] || {}).map((k) => ({
    wch: Math.min(60, Math.max(16, k.length + 3)),
  }));
  XLSX.utils.book_append_sheet(wb, ws, sheet);
  return XLSX.write(wb, { type: "array", bookType: "xlsx" });
}
