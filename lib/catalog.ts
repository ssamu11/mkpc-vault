import type { Catalog, Card, Group, ImportRow, PlanRow } from "./types";
import { cardOdds, cardTier } from "./pocapop";
export const clean = (s: unknown) =>
  String(s ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
export const normalize = (s: unknown) => clean(s).toLocaleLowerCase("en-US");
export function rarityNumber(s: string) {
  const text = clean(s).replace(/%$/, "").trim();
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const n = Number(text);
  return n >= 0 && n <= 100 ? n : null;
}
export function packInfo(name: string) {
  const m = clean(name).match(/^(.*?)\s+(\d+)$/);
  return {
    name: clean(name),
    pack_type: m ? m[1] : clean(name),
    pack_number: m ? Number(m[2]) : null,
  };
}
export function cardIdols(c: Card, d: Catalog) {
  const ids = new Set(
    d.card_idols.filter((x) => x.card_id === c.id).map((x) => x.idol_id),
  );
  return d.idols.filter((i) => ids.has(i.id));
}
export function cardGroups(c: Card, d: Catalog) {
  if (c.group_id) return d.groups.filter((g) => g.id === c.group_id);
  const ids = new Set(cardIdols(c, d).map((i) => i.id));
  const gs = new Set(
    d.group_memberships
      .filter((m) => ids.has(m.idol_id))
      .map((m) => m.group_id),
  );
  return d.groups.filter((g) => gs.has(g.id));
}
export function liveCards(d: Catalog) {
  return d.settings.include_unreleased
    ? d.cards
    : d.cards.filter((c) =>
        d.packs.some((p) => p.id === c.pack_id && p.status === "released"),
      );
}
export function coverage(group: Group, d: Catalog) {
  const live = liveCards(d).filter(
    (c) =>
      c.group_id === group.id ||
      (!c.group_id && cardGroups(c, d).some((g) => g.id === group.id)),
  );
  const representedIds = new Set(
    live.flatMap((c) => cardIdols(c, d).map((i) => i.id)),
  );
  const current = d.group_memberships.filter(
    (m) => m.group_id === group.id && m.membership_status === "current",
  );
  const represented = current.filter((m) => representedIds.has(m.idol_id));
  const missing = current.filter((m) => !representedIds.has(m.idol_id));
  return {
    total: group.roster_configured ? current.length : null,
    represented: represented.length,
    missing: group.roster_configured ? missing : null,
    percentage:
      group.roster_configured && current.length
        ? (represented.length / current.length) * 100
        : null,
    cards: live.length,
  };
}
export function matchIdol(name: string, group: string, d: Catalog) {
  const candidates = d.idols.filter(
    (i) => normalize(i.stage_name) === normalize(name),
  );
  const rawGroup = clean(group);
  const groupName = ["solo", "soloist"].includes(normalize(rawGroup))
    ? ""
    : rawGroup;
  const g = groupName
    ? d.groups.find((x) => normalize(x.name) === normalize(groupName))
    : undefined;

  if (g) {
    const scoped = candidates
      .filter((i) =>
        d.group_memberships.some(
          (m) => m.group_id === g.id && m.idol_id === i.id,
        ),
      )
      .sort((a, b) => a.id.localeCompare(b.id));

    // The import identity is stage name + group. Pack is deliberately NOT part
    // of the identity, so the same idol can appear in Rebirth 1, 8, 20, etc.
    // while still pointing to one idol record.
    if (scoped.length) {
      return {
        id: scoped[0].id,
        ambiguous: false,
        sameNameElsewhere: false,
        duplicateInScope: scoped.length > 1,
      };
    }

    // The same stage name in another group is a different scoped identity, not
    // an error. The server will create a separate idol for this group.
    return {
      id: null,
      ambiguous: false,
      sameNameElsewhere: candidates.length > 0,
      duplicateInScope: false,
    };
  }

  if (groupName) {
    // Group does not exist yet. It still acts as a deterministic identity scope.
    return {
      id: null,
      ambiguous: false,
      sameNameElsewhere: candidates.length > 0,
      duplicateInScope: false,
    };
  }

  // Blank/Solo/Soloist is its own identity scope. Reuse one existing ungrouped
  // idol across any number of packs; grouped idols with the same name do not
  // make the solo row ambiguous.
  const solo = candidates
    .filter((i) => !d.group_memberships.some((m) => m.idol_id === i.id))
    .sort((a, b) => a.id.localeCompare(b.id));
  if (solo.length) {
    return {
      id: solo[0].id,
      ambiguous: false,
      sameNameElsewhere: false,
      duplicateInScope: solo.length > 1,
    };
  }

  return {
    id: null,
    ambiguous: false,
    sameNameElsewhere: candidates.length > 0,
    duplicateInScope: false,
  };
}
export function planImport(
  rows: ImportRow[],
  d: Catalog,
  mode: "cards" | "roster",
): PlanRow[] {
  const seen = new Set<string>();
  return rows.map((row) => {
    const r = { ...row };
    const issues: string[] = [],
      warnings: string[] = [];
    if (!clean(r.idol)) issues.push("Idol is required.");
    if (mode === "roster" && !clean(r.group))
      issues.push("Group is required for roster imports.");
    if (
      r.gender &&
      !["female", "male", "other", "unknown"].includes(normalize(r.gender))
    )
      issues.push("Gender must be female, male, other, or unknown.");
    if (
      mode === "roster" &&
      !["current", "former", ""].includes(r.membership_status || "")
    )
      issues.push("Membership status must be current or former.");
    if (r.source_url) {
      try {
        const url = new URL(r.source_url);
        if (!["http:", "https:"].includes(url.protocol)) throw Error();
      } catch {
        issues.push("Source must be a valid http or https URL.");
      }
    }
    const rarityValue = rarityNumber(r.rarity);
    const packMatch = d.packs.find(p => normalize(p.name) === normalize(r.sheet));
    const packTier = d.pack_rarities?.find(t => t.pack_id === packMatch?.id && normalize(t.display_name) === normalize(r.rarity));
    const rarity = d.rarities.find(x => x.active && (x.id === packTier?.rarity_id || normalize(x.label) === normalize(r.rarity) || (x.game_key && normalize(x.game_key) === normalize(r.rarity)) || (rarityValue !== null && x.numeric_value !== null && Number(x.numeric_value) === rarityValue)));
    if (mode === "cards" && !rarity)
      issues.push("Choose an active PocaPop rarity tier or pack tier name.");
    const match = matchIdol(r.idol, r.group, d);
    // Stage-name collisions are resolved by identity scope (group/solo), not by
    // globally unique names. A collision is therefore never a blocking issue.
    if (match.sameNameElsewhere)
      warnings.push(
        clean(r.group) && !["solo", "soloist"].includes(normalize(r.group))
          ? `Another idol named ${clean(r.idol)} exists in a different group. ${clean(r.group)} will use its own idol identity.`
          : `Another idol named ${clean(r.idol)} exists in a group. The solo act will use its own idol identity.`,
      );
    if (match.duplicateInScope)
      warnings.push(
        `Multiple existing idol records match ${clean(r.idol)} in this exact identity scope. The canonical record will be reused; clean up the duplicate records when convenient.`,
      );
    const g = d.groups.find((x) => normalize(x.name) === normalize(r.group));
    const pack = d.packs.find((x) => normalize(x.name) === normalize(r.sheet));
    const key =
      mode === "cards"
        ? [
            normalize(r.sheet),
            normalize(r.slot),
            normalize(r.idol),
            normalize(r.group),
            rarity?.id ?? rarityValue,
          ].join("|")
        : [normalize(r.group), normalize(r.idol)].join("|");
    const exact =
      mode === "cards" &&
      Boolean(
        pack &&
          match.id &&
          d.cards.some(
            (c) =>
              c.pack_id === pack.id &&
              normalize(c.slot) === normalize(r.slot) &&
              c.rarity_id === rarity?.id &&
              cardIdols(c, d).length === 1 &&
              cardIdols(c, d)[0].id === match.id,
          ),
      );
    const duplicate = seen.has(key) || exact;
    seen.add(key);
    if (duplicate) warnings.push("Exact duplicate: this row will be skipped.");
    if (
      mode === "cards" &&
      pack &&
      r.slot &&
      d.cards.some(
        (c) => c.pack_id === pack.id && normalize(c.slot) === normalize(r.slot),
      ) &&
      !exact
    )
      warnings.push(
        "This pack slot is already used. Confirm this is intentional.",
      );
    if (mode === "cards" && !pack)
      warnings.push("New pack will be created as draft.");
    if (mode === "roster" && g && !duplicate)
      warnings.push(
        "Full roster confirmation replaces current membership; omitted members become former.",
      );
    return {
      ...r,
      issues,
      warnings,
      duplicate,
      existingIdol: match.id,
      newGroup: !!r.group && !g,
      newIdol: !match.id,
      rarityValue,
      rarityId: rarity?.id,
    };
  });
}
export function cardExport(cards: Card[], d: Catalog) {
  return cards.map((c) => {
    const p = d.packs.find((x) => x.id === c.pack_id);
    return {
      CardID: c.game_card_id ?? "",
      PackID: p?.game_pack_id ?? "",
      ImageAssetId: c.image_asset_id ?? "",
      CatalogStatus: c.catalog_status ?? "",
      Pack: p?.name ?? "",
      "Pack Type": p?.pack_type ?? "",
      "Pack Status": p?.status ?? "",
      Slot: c.slot ?? "",
      Idol: cardIdols(c, d)
        .map((i) => i.stage_name)
        .join(" x "),
      Group: cardGroups(c, d)
        .map((g) => g.name)
        .join(" / "),
      Gender: [...new Set(cardIdols(c, d).map((i) => i.gender))].join(" / "),
      Rarity: d.rarities.find((r) => r.id === c.rarity_id)?.game_key ?? d.rarities.find((r) => r.id === c.rarity_id)?.label ?? "",
      "Display Tier": cardTier(c, d),
      "Base Chance (%)": cardOdds(c, d) ?? "",
      "Pic Status": c.pic_status ?? "",
      "Source URL": c.source_url ?? "",
      Notes: c.notes ?? "",
    };
  });
}
