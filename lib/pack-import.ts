import type { Catalog, ImportRow } from "./types";
import { clean, normalize, matchIdol } from "./catalog";
import { tierKeys, rebirthLayout, premiumLayout } from "./pocapop";

export type PackMapping = {
  sheet: string;
  code: string;
  name: string;
  type: "Rebirth" | "Premium";
  selected: boolean;
};
export type PreparedRow = ImportRow & {
  idol_id: string | null;
  group_id: string | null;
  rarity_id: string;
  existing_card_id: string | null;
  expected_updated_at: string | null;
  change: "Add" | "Update" | "Unchanged";
  issues: string[];
  changes: string[];
};
export type PackPreview = {
  mapping: PackMapping;
  existing_id: string | null;
  rows: PreparedRow[];
  issues: string[];
  warnings: string[];
};

export function mapSheet(
  sheet: string,
  rows: ImportRow[],
  data: Catalog,
): PackMapping {
  const match = sheet.match(/^(?:Rebirth|RB)\s*(\d+)$/i);
  const premium = sheet.match(/^(?:Premium|Hanbok|HB)\s*(\d+)$/i);
  const code =
    rows.find((r) => r.game_pack_id)?.game_pack_id ||
    (match
      ? `RB${match[1].padStart(2, "0")}`
      : premium
        ? `HB${premium[1].padStart(2, "0")}`
        : "");
  const existing = data.packs.find(
    (p) => p.game_pack_id === code || normalize(p.name) === normalize(sheet),
  );
  return {
    sheet,
    code: existing?.game_pack_id || code,
    name: existing?.name || rows.find((r) => r.pack_name)?.pack_name || "",
    type: existing?.pack_type === "Premium" || premium ? "Premium" : "Rebirth",
    selected: rows.length > 0,
  };
}

export function previewPack(
  mapping: PackMapping,
  source: ImportRow[],
  data: Catalog,
): PackPreview {
  const issues: string[] = [],
    warnings: string[] = [];
  const existing = data.packs.find((p) => p.game_pack_id === mapping.code);
  const layout = mapping.type === "Premium" ? premiumLayout : rebirthLayout;
  const target = layout.reduce((a, b) => a + b, 0);
  if (
    !new RegExp(
      mapping.type === "Premium" ? "^HB[0-9]{2,6}$" : "^RB[0-9]{2,6}$",
    ).test(mapping.code)
  )
    issues.push("PackID must match pack type (RB08 / HB02).");
  if (!clean(mapping.name)) issues.push("Pack name is required.");
  if (existing && (existing.pack_type !== mapping.type || existing.exclusive))
    issues.push("Pack type conflicts with the existing catalog.");
  if (
    !existing &&
    data.packs.some((p) => normalize(p.name) === normalize(mapping.name))
  )
    issues.push("This name belongs to another PackID.");
  if (source.length !== target)
    issues.push(`Expected ${target} filled rows; found ${source.length}.`);
  const slots = new Set<string>(),
    artists = new Set<string>(),
    cardIds = new Set<string>();
  const rows = source.map((r) => {
    const rowIssues: string[] = [],
      changes: string[] = [];
    const group = r.game_group_id
      ? data.groups.find((g) => g.game_group_id === r.game_group_id)
      : data.groups.find((g) => normalize(g.name) === normalize(r.group));
    const match = matchIdol(r.idol, r.group, data);
    const idol = r.game_idol_id
      ? data.idols.find((i) => i.game_idol_id === r.game_idol_id)
      : data.idols.find((i) => i.id === match.id);
    if (!clean(r.idol)) rowIssues.push("Idol name is required.");
    if (r.game_idol_id && !idol)
      rowIssues.push("Unknown Idol ID. Leave blank for a new artist.");
    if (r.game_group_id && r.game_group_id !== "GROUP-SOLO" && !group)
      rowIssues.push("Unknown Group ID.");
    if (
      idol &&
      (normalize(idol.stage_name) !== normalize(r.idol) ||
        idol.gender !== r.gender)
    )
      rowIssues.push("Idol ID/name/gender do not match the catalog.");
    if (group && r.group && normalize(group.name) !== normalize(r.group))
      rowIssues.push("Group ID and group name do not match.");
    if (
      r.game_idol_id &&
      group &&
      !data.group_memberships.some(
        (m) => m.idol_id === idol?.id && m.group_id === group.id,
      )
    )
      rowIssues.push("Idol ID belongs to another group.");
    if (!["female", "male"].includes(r.gender))
      rowIssues.push("Gender must be female or male.");
    if (
      !/^\d+$/.test(r.slot) ||
      +r.slot < 1 ||
      +r.slot > target ||
      slots.has(String(+r.slot))
    )
      rowIssues.push("Slot must be unique and inside this pack.");
    slots.add(String(+r.slot));
    const identity = idol?.id || `${normalize(r.group)}|${normalize(r.idol)}`;
    if (artists.has(identity))
      rowIssues.push("This idol already appears in the pack.");
    artists.add(identity);
    const aliases: Record<string, string> = {
      petal: "Rare",
      silk: "Epic",
      royal: "Legendary",
      crown: "Mythic",
    };
    const key =
      (mapping.type === "Premium" && aliases[normalize(r.rarity)]) || r.rarity;
    const rarity = data.rarities.find(
      (t) => t.active && normalize(t.game_key || t.label) === normalize(key),
    );
    if (
      !rarity ||
      !layout[tierKeys.indexOf(rarity.game_key as (typeof tierKeys)[number])]
    )
      rowIssues.push("Rarity does not belong to this pack layout.");
    if (r.image_asset_id && !/^[0-9]{1,16}$/.test(r.image_asset_id))
      rowIssues.push("Image Asset ID must contain exact digits.");
    if (r.game_pack_id && r.game_pack_id !== mapping.code)
      rowIssues.push("Row PackID conflicts with sheet mapping.");
    if (
      r.game_card_id &&
      (!r.game_card_id.startsWith(mapping.code + "-") ||
        cardIds.has(r.game_card_id))
    )
      rowIssues.push("Card ID must be unique and start with this PackID.");
    if (r.game_card_id) cardIds.add(r.game_card_id);
    const candidates =
      existing && idol
        ? data.cards.filter(
            (c) =>
              c.pack_id === existing.id &&
              data.card_idols.filter((a) => a.card_id === c.id).length === 1 &&
              data.card_idols.some(
                (a) => a.card_id === c.id && a.idol_id === idol.id,
              ),
          )
        : [];
    const byId = r.game_card_id
      ? data.cards.find((c) => c.game_card_id === r.game_card_id)
      : undefined;
    if (
      byId &&
      (byId.pack_id !== existing?.id ||
        !data.card_idols.some(
          (a) => a.card_id === byId.id && a.idol_id === idol?.id,
        ))
    )
      rowIssues.push("Card ID belongs to another pack or artist.");
    if (!byId && candidates.length > 1)
      rowIssues.push("Multiple cards match this artist; provide Card ID.");
    const card = byId || (candidates.length === 1 ? candidates[0] : undefined);
    if (existing && !card)
      rowIssues.push(
        "Artist does not match this pack. Resolve identity or edit its lineup explicitly.",
      );
    if (card) {
      if (card.rarity_id !== rarity?.id) changes.push("Tier");
      if (r.image_asset_id && r.image_asset_id !== card.image_asset_id)
        changes.push("Photo");
      if (r.game_card_id && r.game_card_id !== card.game_card_id)
        changes.push("CardID");
      if (r.notes && clean(r.notes) !== clean(card.notes))
        changes.push("Notes");
      if (r.pic_status && r.pic_status !== card.pic_status)
        changes.push("Picture status");
    }
    return {
      ...r,
      idol_id: idol?.id || null,
      group_id: group?.id || null,
      rarity_id: rarity?.id || "",
      existing_card_id: card?.id || null,
      expected_updated_at: card?.updated_at || null,
      change: card
        ? changes.length
          ? ("Update" as const)
          : ("Unchanged" as const)
        : ("Add" as const),
      issues: rowIssues,
      changes,
    };
  });
  tierKeys.forEach((key, i) => {
    if (!layout[i]) return;
    const tier = rows.filter(
      (r) => data.rarities.find((t) => t.id === r.rarity_id)?.game_key === key,
    );
    if (
      tier.length !== layout[i] ||
      tier.filter((r) => r.gender === "female").length !== layout[i] / 2 ||
      tier.filter((r) => r.gender === "male").length !== layout[i] / 2
    )
      issues.push(
        `${key}: expected ${layout[i]} cards, ${layout[i] / 2} female / ${layout[i] / 2} male.`,
      );
  });
  if (rows.some((r) => !r.image_asset_id))
    warnings.push(
      "Rows without image IDs remain draft photo work. Existing photos are retained.",
    );
  if (
    existing &&
    data.cards.filter((c) => c.pack_id === existing.id).length !== target
  )
    issues.push(
      "Existing pack size differs. Resolve its catalog before workbook updates.",
    );
  if (existing && rows.some((r) => r.change === "Add"))
    issues.push(
      "Existing pack has a different lineup. Edit its cards explicitly; import will not replace artists silently.",
    );
  return { mapping, existing_id: existing?.id || null, rows, issues, warnings };
}
